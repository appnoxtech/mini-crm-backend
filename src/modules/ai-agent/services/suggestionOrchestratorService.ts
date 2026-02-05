import { EmailModel } from "../../email/models/emailModel";
import { DealModel } from "../../pipelines/models/Deal";
import { PersonModel } from "../../management/persons/models/Person";
import { SuggestionModel } from "../models/SuggestionModel";
import { ClientProfileModel } from "../models/ClientProfileModel";
import { StructuredKBModel } from "../models/StructuredKBModel";
import { StructuredKBService } from "./structuredKBService";
import { PricingModel } from "../models/PricingModel";
import { BrandGuidelinesModel } from "../models/BrandGuidelinesModel";
import { KnowledgeBaseModel } from "../models/KnowledgeBaseModel";
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
    private pricingModel: PricingModel;
    private brandGuidelinesModel: BrandGuidelinesModel;
    private clientProfileModel: ClientProfileModel;
    private knowledgeBaseModel: KnowledgeBaseModel;
    private structuredKBModel: StructuredKBModel;
    private structuredKBService: StructuredKBService;

    constructor() {
        this.emailModel = new EmailModel();
        this.dealModel = new DealModel();
        this.personModel = new PersonModel();
        this.suggestionModel = new SuggestionModel();
        this.pricingModel = new PricingModel();
        this.brandGuidelinesModel = new BrandGuidelinesModel();
        this.clientProfileModel = new ClientProfileModel();
        this.knowledgeBaseModel = new KnowledgeBaseModel();
        this.structuredKBModel = new StructuredKBModel();
        this.structuredKBService = new StructuredKBService(this.structuredKBModel);
    }

    async generateSuggestion(request: SuggestionRequest): Promise<any> {
        let { dealId, personId, threadId, messageId, email } = request;

        const isRefinementOnly = !dealId && !personId && !email && !threadId && !messageId && request.customPrompt && request.customPrompt.trim().length > 0;

        let emails: any[] = [];
        let contextObject: any = null;

        if (messageId && !threadId) {
            const emailRecord = await this.emailModel.findEmailByMessageId(messageId);
            if (emailRecord) {
                if (emailRecord.threadId) {
                    threadId = emailRecord.threadId;
                } else {
                    emails = [emailRecord];
                }

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

        if (threadId) {
            emails = await this.emailModel.getEmailsForThread(threadId);
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
                emails = await this.emailModel.getEmailsForDeal(dealId.toString());
            }
            contextObject = await this.dealModel.findById(dealId);
        } else if (personId) {
            if (emails.length === 0) {
                emails = await this.emailModel.getEmailsForContact(personId.toString());
            }
            contextObject = await this.personModel.findById(personId);
        } else if ((threadId || messageId) && emails.length > 0) {
            const lastEmail = emails[emails.length - 1];
            const senderEmail = lastEmail.from.includes('<') ? lastEmail.from.split('<')[1].replace('>', '') : lastEmail.from;
            contextObject = await this.personModel.findByEmail(senderEmail);
            if (!contextObject) {
                contextObject = { firstName: senderEmail.split('@')[0], lastName: '', emails: [{ email: senderEmail, label: 'work' }] };
            }
        } else if (email) {
            contextObject = await this.personModel.findByEmail(email);
            if (contextObject) {
                personId = contextObject.id;
                if (personId) {
                    emails = await this.emailModel.getEmailsForContact(personId.toString());
                }
            } else {
                contextObject = { firstName: email.split('@')[0], lastName: '', emails: [{ email, label: 'work' }] };
                emails = await this.emailModel.getEmailsByAddress(email);
            }
        }

        let profile: any;
        let inference: any;
        let tiers: PricingTier[] = [];
        let guidelines: any;

        if (isRefinementOnly) {
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

            const kb = await this.structuredKBModel.getKB();
            tiers = (kb?.category_9_pricing?.tiers || []).map((t: any) => ({
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

            if (request.customPrompt && tiers.length > 0) {
                let searchText = request.customPrompt.toLowerCase();
                const instructionMarker = "user's instructions for refinement:";
                const markerIndex = searchText.indexOf(instructionMarker);
                if (markerIndex !== -1) {
                    searchText = searchText.substring(markerIndex + instructionMarker.length).trim();
                }

                const exactMatches = tiers.filter(tier => searchText.includes(tier.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length);

                if (exactMatches.length > 0) {
                    console.log(`[Refinement] Exact match: Plan "${exactMatches[0]!.name}" detected`);
                    tiers = [exactMatches[0]!];
                } else {
                    const promptWords = searchText.split(/\s+/);
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
            profile = dealId
                ? await this.clientProfileModel.findByDealId(dealId)
                : (personId ? await this.clientProfileModel.findByPersonId(personId) : null);

            profile = await contextExtractionService.extractClientProfile(emails, contextObject, profile);
            if (profile) {
                if (!profile.dealId && !profile.personId && !profile.organizationId) {
                    if (dealId) profile.dealId = dealId;
                    if (personId) profile.personId = personId;
                }

                if (profile.dealId || profile.personId || profile.organizationId) {
                    await this.clientProfileModel.upsertProfile(profile);
                }
            } else {
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

            const recentActivity = emails.slice(-5).map(e => ({ type: 'email', date: e.sentAt, subject: e.subject }));
            inference = await inferenceService.inferNextEmailNeed(profile, recentActivity);

            const kb = await this.structuredKBModel.getKB();
            const kbPricing = kb?.category_9_pricing;

            tiers = (kbPricing?.tiers || []).map((t: any) => ({
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

            if (tiers.length === 0) {
                console.log("⚠️ No pricing tiers found in Knowledge Base. Please configure Pricing in AI Settings.");
            }

            guidelines = {};

            if (request.customPrompt && tiers.length > 0) {
                const promptLower = request.customPrompt.toLowerCase();
                const exactMatches = tiers.filter(tier => promptLower.includes(tier.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length);
                if (exactMatches.length > 0) {
                    console.log(`Exact match: Plan "${exactMatches[0]!.name}" detected`);
                    tiers = [exactMatches[0]!];
                } else {
                    const promptWords = promptLower.split(/\s+/);
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

        const lastEmail = emails.length > 0 ? emails[emails.length - 1] : null;
        let knowledgeBaseContext: string[] = [];
        const searchTerms = [
            ...(inference?.informationNeeds || []),
            request.customPrompt,
            request.lastEmailContent,
            lastEmail?.subject,
            lastEmail?.body || lastEmail?.htmlBody?.replace(/<[^>]*>/g, '')
        ].filter(Boolean);

        if (searchTerms.length > 0) {
            const kbItems = await this.knowledgeBaseModel.findRelevantContext(searchTerms);
            knowledgeBaseContext = kbItems.map((item: any) => item.content);
        }

        let structuredKBContext = '';
        try {
            const emailToAnalyze = request.lastEmailContent || lastEmail?.body || lastEmail?.htmlBody?.replace(/<[^>]*>/g, '') || '';
            const subjectToAnalyze = request.lastEmailSubject || lastEmail?.subject || '';

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

            const requiredCategories = intentMappingService.getRequiredCategories(detectedIntents);
            const requiredFields = intentMappingService.getRequiredFields(detectedIntents);

            console.log(`📂 Required KB Categories: [${requiredCategories.join(', ')}]`);
            console.log(`📝 Required Fields: ${requiredFields.slice(0, 8).join(', ')}${requiredFields.length > 8 ? '...' : ''}`);

            structuredKBContext = await this.structuredKBService.buildIntentBasedContext(
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

        const draft = await contentGenerationService.generateEmail(profile, inference, tiers, guidelines, generationContext);
        const qa = await qualityAssuranceService.verifyDraft(draft.subject, draft.body, { profile, inference });

        const suggestionId = await this.suggestionModel.createSuggestion({
            dealId: dealId || undefined,
            personId: personId || (contextObject && 'id' in contextObject ? contextObject.id : undefined),
            subjectLine: draft.subject,
            body: draft.body,
            emailType: inference.emailType,
            confidenceScore: inference.confidence,
            reasoning: inference.reasoning,
            qualityScore: qa.qualityScore,
            issues: qa.issues,
            status: 'generated',
            createdAt: new Date()
        });

        const fullSuggestion = await this.suggestionModel.findById(suggestionId);
        return fullSuggestion;
    }

    async getSuggestionsForDeal(dealId: number): Promise<EmailSuggestion[]> {
        return this.suggestionModel.findByDealId(dealId);
    }

    async getSuggestionsForPerson(personId: number): Promise<EmailSuggestion[]> {
        return this.suggestionModel.findByPersonId(personId);
    }
}
