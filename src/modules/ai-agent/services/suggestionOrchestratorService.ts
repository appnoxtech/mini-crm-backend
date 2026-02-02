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

    constructor(_db?: any) {
        this.emailModel = new EmailModel();
        this.dealModel = new DealModel();
        this.personModel = new PersonModel();
        this.suggestionModel = new SuggestionModel();
        this.pricingModel = new PricingModel();
        this.brandGuidelinesModel = new BrandGuidelinesModel();
        this.clientProfileModel = new ClientProfileModel();
        this.knowledgeBaseModel = new KnowledgeBaseModel();
    }

    async generateSuggestion(request: SuggestionRequest): Promise<any> {
        let { dealId, personId, threadId, messageId, email } = request;

        // Check if this is a compose/refinement-only request
        const isRefinementOnly = !dealId && !personId && !email && !threadId && !messageId && request.customPrompt && request.customPrompt.trim().length > 0;

        if (!isRefinementOnly) {
            if (!dealId && !personId && !threadId && !messageId) {
                if (email) {
                    const existing = await this.personModel.findByEmail(email);
                    if (existing) {
                        personId = existing.id;
                    }
                }

                if (!personId) {
                    throw new Error("Either Deal ID, Person ID, Thread ID, Message ID, or a valid Contact Email is required for context.");
                }
            }
        }

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
            if (!contextObject) throw new Error(`Deal ${dealId} not found`);
        } else if (personId) {
            if (emails.length === 0) {
                emails = await this.emailModel.getEmailsForContact(personId.toString());
            }
            contextObject = await this.personModel.findById(personId);
            if (!contextObject) throw new Error(`Person ${personId} not found`);
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
        let tiers: any[];
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

            tiers = await this.pricingModel.getAllTiers();
            guidelines = await this.brandGuidelinesModel.getGuidelines();

            if (request.customPrompt && tiers.length > 0) {
                let searchText = request.customPrompt.toLowerCase();
                const instructionMarker = "user's instructions for refinement:";
                const markerIndex = searchText.indexOf(instructionMarker);
                if (markerIndex !== -1) {
                    searchText = searchText.substring(markerIndex + instructionMarker.length).trim();
                }

                const exactMatch = tiers.find(tier => searchText.includes(tier.name.toLowerCase()));
                if (exactMatch) {
                    tiers = [exactMatch];
                }
            }
        } else {
            profile = dealId
                ? await this.clientProfileModel.findByDealId(dealId)
                : (personId ? await this.clientProfileModel.findByPersonId(personId) : null);

            profile = await contextExtractionService.extractClientProfile(emails, contextObject, profile);
            if (profile) {
                await this.clientProfileModel.upsertProfile(profile);
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

            tiers = await this.pricingModel.getAllTiers();
            guidelines = await this.brandGuidelinesModel.getGuidelines();

            if (request.customPrompt && tiers.length > 0) {
                const promptLower = request.customPrompt.toLowerCase();
                const exactMatch = tiers.find(tier => promptLower.includes(tier.name.toLowerCase()));
                if (exactMatch) {
                    tiers = [exactMatch];
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
            knowledgeBaseContext = kbItems.map(item => item.content);
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
