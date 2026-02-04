import Database from "better-sqlite3";
import { EmailModel } from "../../email/models/emailModel";
import { DealModel } from "../../pipelines/models/Deal";
import { PersonModel } from "../../management/persons/models/Person";
import { SuggestionModel } from "../models/SuggestionModel";


import { ClientProfileModel } from "../models/ClientProfileModel";

import { StructuredKBModel } from "../models/StructuredKBModel";
import { StructuredKBService } from "./structuredKBService";
import { contextExtractionService } from "./contextExtractionService";
import { inferenceService } from "./inferenceService";
import { contentGenerationService } from "./contentGenerationService";
import { qualityAssuranceService } from "./qualityAssuranceService";
import { intentMappingService } from "./intentMappingService";
import { EmailSuggestion, SuggestionRequest, PricingTier } from "../types";

export class SuggestionOrchestratorService {
    private emailModel: EmailModel;
    private dealModel: DealModel;
    private personModel: PersonModel;
    private suggestionModel: SuggestionModel;


    private clientProfileModel: ClientProfileModel;

    private structuredKBModel: StructuredKBModel;
    private structuredKBService: StructuredKBService;

    constructor(db: Database.Database) {
        this.emailModel = new EmailModel(db);
        this.dealModel = new DealModel(db);
        this.personModel = new PersonModel(db);
        this.suggestionModel = new SuggestionModel(db);


        this.clientProfileModel = new ClientProfileModel(db);

        this.structuredKBModel = new StructuredKBModel(db);
        this.structuredKBService = new StructuredKBService(this.structuredKBModel);

        // Initialize models
        this.suggestionModel.initialize();


        this.clientProfileModel.initialize();

        this.structuredKBModel.initialize();
    }

    async generateSuggestion(request: SuggestionRequest): Promise<EmailSuggestion> {
        let { dealId, personId, threadId, messageId, email } = request;

        // Check if this is a compose/refinement-only request (no context identifiers needed)
        const isRefinementOnly = !dealId && !personId && !email && !threadId && !messageId && request.customPrompt && request.customPrompt.trim().length > 0;

        // For refinement-only requests, skip context validation
        if (!isRefinementOnly) {
            if (!dealId && !personId && !threadId && !messageId) {
                if (email) {
                    const existing = this.personModel.findExistingEmail([email]);
                    if (existing) {
                        personId = existing.personId;
                    }
                }

                if (!personId) {
                    throw new Error("Either Deal ID, Person ID, Thread ID, Message ID, or a valid Contact Email is required for context.");
                }
            }
        }


        // 1. Fetch conversation history & primary context object
        let emails: any[] = [];
        let contextObject: any = null;


        // If messageId is provided, resolve thread or use single message
        if (messageId && !threadId) {
            const emailRecord = this.emailModel.findEmailByMessageId(messageId);
            if (emailRecord) {
                if (emailRecord.threadId) {
                    threadId = emailRecord.threadId;
                } else {
                    emails = [emailRecord];
                }

                // Resolve IDs if missing
                if (!dealId && emailRecord.dealIds && emailRecord.dealIds.length > 0) {
                    dealId = Number(emailRecord.dealIds[0]);
                }
                if (!personId && emailRecord.contactIds && emailRecord.contactIds.length > 0) {
                    personId = Number(emailRecord.contactIds[0]);
                }
                if (!email && emailRecord.from) {
                    const match = emailRecord.from.match(/<(.+?)>/);
                    email = match ? match[1] : emailRecord.from;
                }
            }
        }

        // If threadId is provided (or resolved from messageId), it's the most specific context
        if (threadId) {
            emails = this.emailModel.getEmailsForThread(threadId);
            // Try to resolve context IDs from emails if not provided
            if (emails.length > 0) {
                const lastEmail = emails[emails.length - 1];
                if (!dealId && lastEmail.dealIds && lastEmail.dealIds.length > 0) {
                    dealId = Number(lastEmail.dealIds[0]);
                }
                if (!personId && lastEmail.contactIds && lastEmail.contactIds.length > 0) {
                    personId = Number(lastEmail.contactIds[0]);
                }
            }
        }

        if (dealId) {
            if (emails.length === 0) {
                emails = this.emailModel.getEmailsForDeal(dealId.toString());
            }
            contextObject = this.dealModel.findById(dealId);
            if (!contextObject) throw new Error(`Deal ${dealId} not found`);
        } else if (personId) {
            if (emails.length === 0) {
                emails = this.emailModel.getEmailsForContact(personId.toString());
            }
            contextObject = this.personModel.findById(personId);
            if (!contextObject) throw new Error(`Person ${personId} not found`);
        } else if ((threadId || messageId) && emails.length > 0) {
            // Fallback for thread/message context without deal/person record:
            // Use sender/recipient info from the thread/message
            const lastEmail = emails[emails.length - 1];
            const senderEmail = lastEmail.from.includes('<') ? lastEmail.from.split('<')[1].replace('>', '') : lastEmail.from;
            contextObject = this.personModel.findByEmail(senderEmail);
            if (!contextObject) {
                contextObject = { firstName: senderEmail.split('@')[0], lastName: '', emails: [{ email: senderEmail, label: 'work' }] };
            }
        } else if (email) {
            // Fallback: Use email to find history even if no person record exists yet
            contextObject = this.personModel.findByEmail(email);
            if (contextObject) {
                personId = contextObject.id;
                if (personId) {
                    emails = this.emailModel.getEmailsForContact(personId.toString());
                }
            } else {
                // If still no person, provide a minimal context object and fetch by address
                contextObject = { firstName: email.split('@')[0], lastName: '', emails: [{ email, label: 'work' }] };
                emails = this.emailModel.getEmailsByAddress(email);
            }
        }

        // For refinement-only requests, use minimal defaults
        let profile: any;
        let inference: any;
        let tiers: PricingTier[] = [];
        let guidelines: any;

        if (isRefinementOnly) {
            // Fast path for refinement: skip context extraction and use minimal defaults
            console.log("Refinement-only request detected, using minimal defaults...");
            profile = {
                id: '',
                requirements: [],
                budgetRange: null,
                timeline: null,
                decisionMakers: [],
                objections: [],
                preferences: {},
                relationshipStage: 'general',
                maturityScore: 0.5,
                lastUpdated: new Date()
            };
            inference = {
                emailType: 'refinement',
                reasoning: 'Refining existing draft based on user instructions',
                requiredContent: ['Follow user instructions'],
                confidence: 1.0
            };
            // Load tiers for refinement too, so plan matching works
            const kb = this.structuredKBModel.getKB();
            tiers = (kb?.category_9_pricing?.tiers || []).map(t => ({
                id: t.id,
                name: t.name,
                basePrice: t.basePrice,
                currency: t.currency,
                features: t.features,
                contractTerms: t.billingCycle,
                discountRules: [],
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            }));
            guidelines = {};

            // Apply plan matching for refinement requests
            // Extract ONLY the user's instructions part, not the full draft content
            if (request.customPrompt && tiers.length > 0) {
                let searchText = request.customPrompt.toLowerCase();

                // If this is a refinement prompt, extract only the user's instruction part
                const instructionMarker = "user's instructions for refinement:";
                const markerIndex = searchText.indexOf(instructionMarker);
                if (markerIndex !== -1) {
                    searchText = searchText.substring(markerIndex + instructionMarker.length).trim();
                    console.log(`[Refinement] Extracted user instruction: "${searchText}"`);
                }

                const promptWords = searchText.split(/\s+/);

                // First: check for exact tier name match in user's instructions (highest priority)
                const exactMatch = tiers.find(tier =>
                    searchText.includes(tier.name.toLowerCase())
                );

                if (exactMatch) {
                    // If multiple exact matches, pick the longest tier name (most specific)
                    const exactMatches = tiers.filter(tier =>
                        searchText.includes(tier.name.toLowerCase())
                    ).sort((a, b) => b.name.length - a.name.length);

                    console.log(`[Refinement] Exact match: Plan "${exactMatches[0]!.name}" detected`);
                    tiers = [exactMatches[0]!];
                } else {
                    // Fallback: word-based scoring
                    const scoredTiers = tiers.map(tier => {
                        const tierWords = tier.name.toLowerCase().split(/\s+/);
                        const matchCount = tierWords.filter((word: string) =>
                            promptWords.some((pw: string) => pw === word)
                        ).length;
                        const score = tierWords.length > 0 ? matchCount / tierWords.length : 0;
                        return { tier, matchCount, score };
                    });

                    const bestMatch = scoredTiers
                        .filter(s => s.matchCount > 0)
                        .sort((a, b) => {
                            if (b.score !== a.score) return b.score - a.score;
                            return b.matchCount - a.matchCount;
                        })[0];

                    if (bestMatch && bestMatch.score >= 0.5) {
                        console.log(`[Refinement] Word match: Plan "${bestMatch!.tier.name}" (${Math.round(bestMatch!.score * 100)}% match)`);
                        tiers = [bestMatch!.tier];
                    }
                }
            }
        } else {
            // 3. Fetch/Create client profile
            profile = dealId
                ? this.clientProfileModel.findByDealId(dealId)
                : (personId ? this.clientProfileModel.findByPersonId(personId) : null);

            // Always refresh context if it's old or triggered manually
            console.log("Step 1: Extracting context...");
            profile = await contextExtractionService.extractClientProfile(emails, contextObject, profile);
            if (profile) {
                this.clientProfileModel.upsert(profile);
            } else {
                // Minimal fallback profile if extraction fails or returns null
                profile = {
                    id: '',
                    requirements: [],
                    budgetRange: null,
                    timeline: null,
                    decisionMakers: [],
                    objections: [],
                    preferences: {},
                    relationshipStage: 'exploration',
                    maturityScore: 0.5,
                    lastUpdated: new Date(),
                    dealId,
                    personId
                };
            }

            // 4. Infer needs
            console.log("Step 2: Inferring needs...");
            const recentActivity = emails.slice(-5).map(e => ({ type: 'email', date: e.sentAt, subject: e.subject }));
            inference = await inferenceService.inferNextEmailNeed(profile, recentActivity);



            // 5. Get pricing & guidelines
            // UPDATED: Fetch pricing from Structured KB (Category 9) instead of PricingModel
            const kb = this.structuredKBModel.getKB();
            const kbPricing = kb?.category_9_pricing;

            // Map KB tiers to the old PricingTier format expected by contentGenerationService
            tiers = (kbPricing?.tiers || []).map(t => ({
                id: t.id,
                name: t.name,
                basePrice: t.basePrice,
                currency: t.currency,
                features: t.features,
                contractTerms: t.billingCycle,
                discountRules: [], // Default empty
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            }));

            // Fallback to defaults if KB is empty (optional, or just leave empty)
            if (tiers.length === 0) {
                console.log("⚠️ No pricing tiers found in Knowledge Base. Please configure Pricing in AI Settings.");
            }

            guidelines = {};

            // 5.1 Check if customPrompt mentions a specific plan name
            if (request.customPrompt && tiers.length > 0) {
                const promptLower = request.customPrompt.toLowerCase();
                const promptWords = promptLower.split(/\s+/);

                // First: check for exact tier name match (highest priority)
                const exactMatch = tiers.find(tier =>
                    promptLower.includes(tier.name.toLowerCase())
                );

                if (exactMatch) {
                    // If multiple exact matches, pick the longest tier name (most specific)
                    const exactMatches = tiers.filter(tier =>
                        promptLower.includes(tier.name.toLowerCase())
                    ).sort((a, b) => b.name.length - a.name.length);

                    console.log(`Exact match: Plan "${exactMatches[0]!.name}" detected`);
                    tiers = [exactMatches[0]!];
                } else {
                    // Fallback: word-based scoring with exact word matches
                    const scoredTiers = tiers.map(tier => {
                        const tierWords = tier.name.toLowerCase().split(/\s+/);
                        const matchCount = tierWords.filter((word: string) =>
                            promptWords.some((pw: string) => pw === word)
                        ).length;
                        const score = tierWords.length > 0 ? matchCount / tierWords.length : 0;
                        return { tier, matchCount, score };
                    });

                    const bestMatch = scoredTiers
                        .filter(s => s.matchCount > 0)
                        .sort((a, b) => {
                            if (b.score !== a.score) return b.score - a.score;
                            return b.matchCount - a.matchCount;
                        })[0];

                    if (bestMatch && bestMatch.score >= 0.5) {
                        console.log(`Word match: Plan "${bestMatch.tier.name}" (${Math.round(bestMatch.score * 100)}% match)`);
                        tiers = [bestMatch.tier];
                    }
                }
            }
        }


        // 6. Build generation context with email content
        const lastEmail = emails.length > 0 ? emails[emails.length - 1] : null;

        // Fetch knowledge base context
        // Fetch knowledge base context
        let knowledgeBaseContext: string[] = [];

        // Use inferred information needs + raw content for search
        const searchTerms = [
            ...(inference?.informationNeeds || []), // Add high-priority inferred terms first
            request.customPrompt,
            request.lastEmailContent,
            lastEmail?.subject,
            lastEmail?.body || lastEmail?.htmlBody?.replace(/<[^>]*>/g, '')
        ].filter(Boolean).join(' ');

        if (searchTerms) {
            // Legacy KB search removed. Replaced by Intent-based Structured KB extraction below.
            knowledgeBaseContext = [];
        }

        // Build structured KB context using INTENT-BASED extraction
        let structuredKBContext = '';
        try {
            // Get the email content to analyze for intents
            const emailToAnalyze = request.lastEmailContent || lastEmail?.body || lastEmail?.htmlBody?.replace(/<[^>]*>/g, '') || '';
            const subjectToAnalyze = request.lastEmailSubject || lastEmail?.subject || '';

            // Detect intents from the email
            const detectedIntents = intentMappingService.detectIntents(emailToAnalyze, subjectToAnalyze);

            if (detectedIntents.length > 0) {
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('🎯 DETECTED EMAIL INTENTS:');
                for (const intent of detectedIntents.slice(0, 3)) {
                    console.log(`   - ${intent.intent} (${Math.round(intent.confidence * 100)}% confidence)`);
                    if (intent.matchedKeywords.length > 0) {
                        console.log(`     Keywords: ${intent.matchedKeywords.join(', ')}`);
                    }
                }
            }

            // Get required categories and fields based on intents
            const requiredCategories = intentMappingService.getRequiredCategories(detectedIntents);
            const requiredFields = intentMappingService.getRequiredFields(detectedIntents);

            console.log(`📂 Required KB Categories: [${requiredCategories.join(', ')}]`);
            console.log(`📝 Required Fields: ${requiredFields.slice(0, 8).join(', ')}${requiredFields.length > 8 ? '...' : ''}`);

            // Build intent-based context (selective, not full KB)
            structuredKBContext = this.structuredKBService.buildIntentBasedContext(
                requiredCategories,
                requiredFields
            );

            if (structuredKBContext) {
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('📚 INTENT-BASED KB CONTEXT (Selective):');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log(structuredKBContext);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            } else {
                console.log('⚠️ KB context is empty - please populate your Knowledge Base in AI Settings.');
            }
        } catch (err) {
            console.warn('❌ Failed to load structured KB context:', err);
        }

        const generationContext = {
            lastEmailContent: request.lastEmailContent || lastEmail?.body || lastEmail?.htmlBody?.replace(/<[^>]*>/g, '') || undefined,
            lastEmailSubject: request.lastEmailSubject || lastEmail?.subject || undefined,
            customPrompt: request.customPrompt,
            senderName: contextObject?.firstName ? `${contextObject.firstName} ${contextObject.lastName || ''}`.trim() : undefined,
            userName: request.userName,
            conversationHistory: emails.slice(-5).map(e => ({
                from: e.from,
                subject: e.subject,
                body: (e.body || e.htmlBody?.replace(/<[^>]*>/g, '') || '').substring(0, 500),
                date: new Date(e.sentAt).toLocaleString()
            })),
            knowledgeBaseContext,
            structuredKBContext
        };

        // 7. Generate email
        console.log("Step 3: Generating content...");
        const draft = await contentGenerationService.generateEmail(profile, inference, tiers, guidelines, generationContext);

        // 7. QA Check
        console.log("Step 4: Quality assurance...");
        const qa = await qualityAssuranceService.verifyDraft(draft.subject, draft.body, { profile, inference });

        // 8. Save and return
        const suggestion = this.suggestionModel.create({
            dealId,
            personId: personId || (contextObject && 'id' in contextObject ? contextObject.id : undefined),
            subjectLine: draft.subject,
            body: draft.body,
            emailType: inference.emailType,
            confidenceScore: inference.confidence,
            reasoning: inference.reasoning,
            qualityScore: qa.qualityScore,
            issues: qa.issues,
            status: 'generated'
        });

        return suggestion;
    }

    async getSuggestionsForDeal(dealId: number): Promise<EmailSuggestion[]> {
        return this.suggestionModel.findByDealId(dealId);
    }

    async getSuggestionsForPerson(personId: number): Promise<EmailSuggestion[]> {
        return this.suggestionModel.findByPersonId(personId);
    }
}
