import Database from "better-sqlite3";
import { EmailModel } from "../../email/models/emailModel";
import { DealModel } from "../../pipelines/models/Deal";
import { PersonModel } from "../../management/persons/models/Person";
import { SuggestionModel } from "../models/SuggestionModel";
import { PricingModel } from "../models/PricingModel";
import { BrandGuidelinesModel } from "../models/BrandGuidelinesModel";
import { ClientProfileModel } from "../models/ClientProfileModel";
import { KnowledgeBaseModel } from "../models/KnowledgeBaseModel";
import { contextExtractionService } from "./contextExtractionService";
import { inferenceService } from "./inferenceService";
import { contentGenerationService } from "./contentGenerationService";
import { qualityAssuranceService } from "./qualityAssuranceService";
import { EmailSuggestion, SuggestionRequest } from "../types";

export class SuggestionOrchestratorService {
    private emailModel: EmailModel;
    private dealModel: DealModel;
    private personModel: PersonModel;
    private suggestionModel: SuggestionModel;
    private pricingModel: PricingModel;
    private brandGuidelinesModel: BrandGuidelinesModel;
    private clientProfileModel: ClientProfileModel;
    private knowledgeBaseModel: KnowledgeBaseModel;

    constructor(db: Database.Database) {
        this.emailModel = new EmailModel(db);
        this.dealModel = new DealModel(db);
        this.personModel = new PersonModel(db);
        this.suggestionModel = new SuggestionModel(db);
        this.pricingModel = new PricingModel(db);
        this.brandGuidelinesModel = new BrandGuidelinesModel(db);
        this.clientProfileModel = new ClientProfileModel(db);
        this.knowledgeBaseModel = new KnowledgeBaseModel(db);

        // Initialize models
        this.suggestionModel.initialize();
        this.pricingModel.initialize();
        this.brandGuidelinesModel.initialize();
        this.clientProfileModel.initialize();
        this.knowledgeBaseModel.initialize();
    }

    async generateSuggestion(request: SuggestionRequest): Promise<EmailSuggestion> {
        let { dealId, personId, threadId, messageId, email } = request;

        // Check if this is a refinement-only request (no context identifiers needed)
        const isRefinementOnly = !dealId && !personId && !email && !threadId && !messageId && request.customPrompt && request.lastEmailContent;

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
        let tiers: any[];
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
            tiers = this.pricingModel.getAllTiers();
            guidelines = this.brandGuidelinesModel.getGuidelines()!;

            // Apply plan matching for refinement requests
            if (request.customPrompt && tiers.length > 0) {
                const promptWords = request.customPrompt.toLowerCase().split(/\s+/);

                const scoredTiers = tiers.map(tier => {
                    const tierWords = tier.name.toLowerCase().split(/\s+/);
                    const matchCount = tierWords.filter((word: string) =>
                        promptWords.some((pw: string) => pw.includes(word) || word.includes(pw))
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
                    console.log(`[Refinement] Plan "${bestMatch.tier.name}" detected (${bestMatch.matchCount} words matched)`);
                    tiers = [bestMatch.tier];
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
            tiers = this.pricingModel.getAllTiers();
            guidelines = this.brandGuidelinesModel.getGuidelines()!;

            // 5.1 Check if customPrompt mentions a specific plan name
            // Use word-based scoring: count how many words from tier name appear in prompt
            if (request.customPrompt && tiers.length > 0) {
                const promptWords = request.customPrompt.toLowerCase().split(/\s+/);

                // Score each tier based on how many of its name words appear in the prompt
                const scoredTiers = tiers.map(tier => {
                    const tierWords = tier.name.toLowerCase().split(/\s+/);
                    const matchCount = tierWords.filter((word: string) =>
                        promptWords.some((pw: string) => pw.includes(word) || word.includes(pw))
                    ).length;
                    // Calculate percentage of tier name words that matched
                    const score = tierWords.length > 0 ? matchCount / tierWords.length : 0;
                    return { tier, matchCount, score };
                });

                // Find the best match (highest score, then highest match count)
                const bestMatch = scoredTiers
                    .filter(s => s.matchCount > 0)
                    .sort((a, b) => {
                        // First by percentage match (prefer 100% matches)
                        if (b.score !== a.score) return b.score - a.score;
                        // Then by number of matched words
                        return b.matchCount - a.matchCount;
                    })[0];

                if (bestMatch && bestMatch.score >= 0.5) {
                    console.log(`Plan "${bestMatch.tier.name}" detected (${bestMatch.matchCount} words matched, ${Math.round(bestMatch.score * 100)}% score)`);
                    tiers = [bestMatch.tier];
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
            knowledgeBaseContext = this.knowledgeBaseModel.findRelevantContext(searchTerms);
            if (knowledgeBaseContext.length > 0) {
                console.log(`Found ${knowledgeBaseContext.length} relevant knowledge base items based on intent & content.`);
            }
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
            knowledgeBaseContext
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
