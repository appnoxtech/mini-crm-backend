import { StructuredKBModel } from "../models/StructuredKBModel";
import {
    StructuredKnowledgeBase,
    CompanyProfile,
    ProductsCatalog,
    SalesProcess,
    CustomerMarkets,
    CommonScenarios,
    Communication,
    Operations,
    Resources,
    CustomerSegment,
    CaseStudy,
    Objection,
    SalesStage,
    CTA
} from "../types/structuredKB";
import { ClientProfile } from "../types";
import { InferenceResult } from "./inferenceService";

/**
 * Service for working with Structured Knowledge Base
 * Provides context extraction methods for the AI email pipeline
 */
export class StructuredKBService {
    private model: StructuredKBModel;

    constructor(model: StructuredKBModel) {
        this.model = model;
    }

    // ==========================================
    // BASIC CRUD OPERATIONS
    // ==========================================

    async getFullKB(companyId: number): Promise<StructuredKnowledgeBase | null> {
        await this.model.initialize(companyId);
        return await this.model.getKB(companyId);
    }

    async updateCategory(categoryNumber: number, data: any, companyId: number): Promise<boolean> {
        return await this.model.updateCategory(companyId, categoryNumber, data);
    }

    async getCompletionStatus(companyId: number) {
        return await this.model.getCompletionStatus(companyId);
    }

    // ==========================================
    // CONTEXT EXTRACTION FOR EMAIL GENERATION
    // ==========================================

    /**
     * Extract all relevant KB context for email generation
     * Used in Step 3 (Content Generation) of the AI pipeline
     */
    async getContextForGeneration(
        profile: ClientProfile,
        inference: InferenceResult,
        companyId: number
    ): Promise<{
        companyProfile: CompanyProfile | null;
        matchedSegment: CustomerSegment | null;
        relevantCaseStudies: CaseStudy[];
        objectionResponses: Objection[];
        stageGuidance: { stage: SalesStage | null; cta: CTA | null };
        brandVoice: Communication['brand_voice'] | null;
        signature: Communication['signature'] | null;
        salesPlaybook: SalesProcess['sales_playbook'] | null;
        supportInfo: Operations['support_and_slas'] | null;
        implementationDetails: Operations['implementation'] | null;
    }> {
        const kb = await this.model.getKB(companyId);
        if (!kb) {
            return {
                companyProfile: null,
                matchedSegment: null,
                relevantCaseStudies: [],
                objectionResponses: [],
                stageGuidance: { stage: null, cta: null },
                brandVoice: null,
                signature: null,
                salesPlaybook: null,
                supportInfo: null,
                implementationDetails: null
            };
        }

        // Match customer to segment
        const matchedSegment = this.matchCustomerToSegment(profile, kb.category_4_customers_markets);

        // Find relevant case studies
        const relevantCaseStudies = this.findRelevantCaseStudies(
            matchedSegment,
            profile.objections,
            kb.category_8_resources
        );

        // Get objection responses
        const objectionResponses = this.getObjectionResponses(
            profile.objections,
            kb.category_5_common_scenarios
        );

        // Get stage guidance
        const stageGuidance = this.getStageGuidance(
            profile.relationshipStage,
            kb.category_3_sales_process,
            kb.category_6_communication
        );

        return {
            companyProfile: kb.category_1_company_profile,
            matchedSegment,
            relevantCaseStudies,
            objectionResponses,
            stageGuidance,
            brandVoice: kb.category_6_communication?.brand_voice || null,
            signature: kb.category_6_communication?.signature || null,
            salesPlaybook: kb.category_3_sales_process?.sales_playbook || null,
            supportInfo: kb.category_7_operations?.support_and_slas || null,
            implementationDetails: kb.category_7_operations?.implementation || null
        };
    }

    /**
     * Match a client profile to a customer segment
     */
    matchCustomerToSegment(
        profile: ClientProfile,
        customersMarkets: CustomerMarkets
    ): CustomerSegment | null {
        if (!customersMarkets?.customer_segments?.length) return null;

        // Simple matching based on requirements and budget
        const segments = customersMarkets.customer_segments;

        // First, try to match based on budget range if available
        if (profile.budgetRange) {
            const avgBudget = (profile.budgetRange.min + profile.budgetRange.max) / 2;

            for (const segment of segments) {
                if (segment.typical_deal_size) {
                    const variance = segment.typical_deal_size * 0.5; // 50% variance
                    if (avgBudget >= segment.typical_deal_size - variance &&
                        avgBudget <= segment.typical_deal_size + variance) {
                        return segment;
                    }
                }
            }
        }

        // Fallback: match based on pain points overlap with requirements
        let bestMatch: CustomerSegment | null = null;
        let bestScore = 0;

        for (const segment of segments) {
            let score = 0;
            const painPoints = segment.pain_points.map(p => p.toLowerCase());

            for (const req of profile.requirements) {
                for (const pain of painPoints) {
                    if (pain.includes(req.toLowerCase()) || req.toLowerCase().includes(pain)) {
                        score++;
                    }
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = segment;
            }
        }

        // Return first segment as fallback if no match found
        return bestMatch || segments[0] || null;
    }

    /**
     * Find case studies relevant to the customer's segment and objections
     */
    findRelevantCaseStudies(
        segment: CustomerSegment | null,
        objections: string[],
        resources: Resources
    ): CaseStudy[] {
        if (!resources?.case_studies?.length) return [];

        const relevant: CaseStudy[] = [];

        for (const cs of resources.case_studies) {
            let isRelevant = false;

            // Match by segment
            if (segment && cs.when_to_reference?.customer_segment) {
                if (cs.when_to_reference.customer_segment.toLowerCase().includes(segment.name.toLowerCase()) ||
                    segment.name.toLowerCase().includes(cs.when_to_reference.customer_segment.toLowerCase())) {
                    isRelevant = true;
                }
            }

            // Match by industry
            if (segment && cs.industry) {
                for (const ind of segment.name.split(' ')) {
                    if (cs.industry.toLowerCase().includes(ind.toLowerCase())) {
                        isRelevant = true;
                        break;
                    }
                }
            }

            // Match by objection addressed
            if (cs.when_to_reference?.objection_addressed) {
                for (const obj of objections) {
                    if (cs.when_to_reference.objection_addressed.toLowerCase().includes(obj.toLowerCase()) ||
                        obj.toLowerCase().includes(cs.when_to_reference.objection_addressed.toLowerCase())) {
                        isRelevant = true;
                        break;
                    }
                }
            }

            if (isRelevant) {
                relevant.push(cs);
            }
        }

        // Limit to top 3 most relevant
        return relevant.slice(0, 3);
    }

    /**
     * Get pre-written responses for detected objections
     */
    getObjectionResponses(
        detectedObjections: string[],
        scenarios: CommonScenarios
    ): Objection[] {
        if (!scenarios?.objections?.length || !detectedObjections?.length) return [];

        const responses: Objection[] = [];

        for (const detected of detectedObjections) {
            const detectedLower = detected.toLowerCase();

            for (const obj of scenarios.objections) {
                if (obj.objection.toLowerCase().includes(detectedLower) ||
                    detectedLower.includes(obj.objection.toLowerCase())) {
                    responses.push(obj);
                    break; // One response per detected objection
                }
            }
        }

        return responses;
    }

    /**
     * Get sales stage guidance including CTA
     */
    getStageGuidance(
        relationshipStage: ClientProfile['relationshipStage'],
        salesProcess: SalesProcess,
        communication: Communication
    ): { stage: SalesStage | null; cta: CTA | null } {
        // Map relationship stages to sales stages
        const stageMapping: Record<string, string[]> = {
            'exploration': ['prospecting', 'discovery', 'qualification'],
            'evaluation': ['discovery', 'demo', 'proposal', 'evaluation'],
            'negotiation': ['negotiation', 'proposal', 'closing'],
            'implementation': ['implementation', 'onboarding', 'closed'],
            'renewal': ['renewal', 'retention'],
            'churn_risk': ['retention', 're-engagement']
        };

        // Find matching sales stage
        let matchedStage: SalesStage | null = null;
        const possibleStages = stageMapping[relationshipStage] || [];

        if (salesProcess?.stages?.length) {
            for (const stage of salesProcess.stages) {
                const stageLower = stage.name.toLowerCase();
                for (const possible of possibleStages) {
                    if (stageLower.includes(possible) || possible.includes(stageLower)) {
                        matchedStage = stage;
                        break;
                    }
                }
                if (matchedStage) break;
            }
        }

        // Get CTA for this stage
        let cta: CTA | null = null;
        if (communication?.ctas_by_stage) {
            // Try to find CTA by stage name
            for (const [stageName, ctaData] of Object.entries(communication.ctas_by_stage)) {
                if (possibleStages.some(p => stageName.toLowerCase().includes(p))) {
                    cta = ctaData;
                    break;
                }
            }

            // Fallback to relationship stage
            if (!cta && communication.ctas_by_stage[relationshipStage]) {
                cta = communication.ctas_by_stage[relationshipStage];
            }
        }

        // Use stage's CTA if no specific CTA found
        if (!cta && matchedStage) {
            cta = {
                primary: matchedStage.cta_primary,
                alternatives: matchedStage.cta_alternatives || [],
                urgency_level: matchedStage.urgency_level
            };
        }

        return { stage: matchedStage, cta };
    }

    /**
     * Build enriched context string for LLM prompt
     */
    async buildPromptContext(
        profile: ClientProfile,
        inference: InferenceResult,
        companyId: number
    ): Promise<string> {
        const context = await this.getContextForGeneration(profile, inference, companyId);
        const parts: string[] = [];

        // Company Profile
        if (context.companyProfile?.company_name) {
            parts.push(`SENDER COMPANY: ${context.companyProfile.company_name}`);
            if (context.companyProfile.industry) {
                parts.push(`Industry: ${context.companyProfile.industry}`);
            }
            if (context.companyProfile.tagline) {
                parts.push(`Tagline: ${context.companyProfile.tagline}`);
            }
            if (context.companyProfile.mission_statement) {
                parts.push(`Mission: ${context.companyProfile.mission_statement}`);
            }
            if (context.companyProfile.office_address) {
                parts.push(`Office Address: ${context.companyProfile.office_address}`);
            }
            if (context.companyProfile.policies) {
                parts.push(`Policies: ${context.companyProfile.policies}`);
            }
        }

        // Email Formatting (Opening/Closing Phrases & Signature)
        if (context.signature) {
            parts.push(`\nEMAIL FORMATTING:`);
            if (context.signature.greeting) {
                parts.push(`Opening Phrase: ${context.signature.greeting}`);
            }
            if (context.signature.sign_off) {
                parts.push(`Closing Phrase: ${context.signature.sign_off}`);
            }
            if (context.signature.full_signature) {
                parts.push(`Signature:\n${context.signature.full_signature}`);
            }
        }

        // Sales Playbook (Key Talking Points & Discovery Questions)
        if (context.salesPlaybook) {
            if (context.salesPlaybook.key_talking_points?.length) {
                parts.push(`\nKEY TALKING POINTS:`);
                for (const point of context.salesPlaybook.key_talking_points) {
                    parts.push(`- ${point}`);
                }
            }
            if (context.salesPlaybook.discovery_questions?.length) {
                parts.push(`\nDISCOVERY QUESTIONS TO ASK:`);
                for (const question of context.salesPlaybook.discovery_questions) {
                    parts.push(`- ${question}`);
                }
            }
        }

        // Customer Segment Match
        if (context.matchedSegment) {
            parts.push(`\nCUSTOMER SEGMENT MATCH: ${context.matchedSegment.name}`);
            if (context.matchedSegment.pain_points?.length) {
                parts.push(`Known Pain Points: ${context.matchedSegment.pain_points.join(', ')}`);
            }
            if (context.matchedSegment.why_they_choose_us?.length) {
                parts.push(`Why They Choose Us: ${context.matchedSegment.why_they_choose_us.join(', ')}`);
            }
        }

        // Relevant Case Studies
        if (context.relevantCaseStudies?.length) {
            parts.push(`\nRELEVANT SUCCESS STORIES:`);
            for (const cs of context.relevantCaseStudies) {
                parts.push(`- ${cs.customer_name} (${cs.industry || 'N/A'}): ${cs.the_challenge} → ${cs.results?.map(r => `${r.metric}: ${r.value}`).join(', ')}`);
                if (cs.key_quote) {
                    parts.push(`  Quote: "${cs.key_quote}"`);
                }
            }
        }

        // Objection Responses
        if (context.objectionResponses?.length) {
            parts.push(`\nOBJECTION HANDLING:`);
            for (const obj of context.objectionResponses) {
                parts.push(`- Objection: "${obj.objection}"`);
                parts.push(`  Response: ${obj.our_response}`);
                if (obj.proof_points?.length) {
                    parts.push(`  Proof: ${obj.proof_points.join('; ')}`);
                }
            }
        }

        // Stage Guidance
        if (context.stageGuidance.stage || context.stageGuidance.cta) {
            parts.push(`\nSALES STAGE GUIDANCE:`);
            if (context.stageGuidance.stage) {
                parts.push(`Current Stage: ${context.stageGuidance.stage.name}`);
                parts.push(`Email Goal: ${context.stageGuidance.stage.email_goal}`);
            }
            if (context.stageGuidance.cta) {
                parts.push(`Primary CTA: ${context.stageGuidance.cta.primary}`);
                if (context.stageGuidance.cta.alternatives?.length) {
                    parts.push(`Alternative CTAs: ${context.stageGuidance.cta.alternatives.join(', ')}`);
                }
            }
        }

        // Brand Voice
        if (context.brandVoice) {
            parts.push(`\nBRAND VOICE:`);
            parts.push(`Tone: ${context.brandVoice.overall_tone}`);
            if (context.brandVoice.characteristics?.length) {
                parts.push(`Characteristics: ${context.brandVoice.characteristics.join(', ')}`);
            }
            if (context.brandVoice.words_we_use?.length) {
                parts.push(`Words to Use: ${context.brandVoice.words_we_use.join(', ')}`);
            }
            if (context.brandVoice.words_we_avoid?.length) {
                parts.push(`Words to Avoid: ${context.brandVoice.words_we_avoid.join(', ')}`);
            }
        }

        // Support Info
        if (context.supportInfo) {
            parts.push(`\nSUPPORT INFO:`);
            if (context.supportInfo.support_hours) {
                parts.push(`Support Hours: ${context.supportInfo.support_hours}`);
            }
            if (context.supportInfo.support_channels?.length) {
                parts.push(`Support Channels: ${context.supportInfo.support_channels.join(', ')}`);
            }
        }

        // Implementation Details
        if (context.implementationDetails) {
            parts.push(`\nIMPLEMENTATION INFO:`);
            if (context.implementationDetails.typical_timeline_days) {
                parts.push(`Timeline: ${context.implementationDetails.typical_timeline_days} days`);
            }
            if (context.implementationDetails.phases?.length) {
                parts.push(`Phases: ${context.implementationDetails.phases.map(p => p.name).join(' → ')}`);
            }
        }

        return parts.join('\n');
    }

    // ==========================================
    // INTENT-BASED CONTEXT EXTRACTION
    // ==========================================

    /**
     * Build KB context filtered by detected email intents
     * More efficient than buildPromptContext - only includes relevant sections
     */
    async buildIntentBasedContext(
        requiredCategories: number[],
        requiredFields: string[],
        companyId: number
    ): Promise<string> {
        const kb = await this.model.getKB(companyId);
        if (!kb) return '';

        const parts: string[] = [];
        const fieldsSet = new Set(requiredFields);

        // Category 1: Company Profile
        if (requiredCategories.includes(1)) {
            const cp = kb.category_1_company_profile;
            if (cp?.company_name) {
                parts.push(`SENDER COMPANY: ${cp.company_name}`);
                if (fieldsSet.has('industry') && cp.industry) {
                    parts.push(`Industry: ${cp.industry}`);
                }
                if (fieldsSet.has('tagline') && cp.tagline) {
                    parts.push(`Tagline: ${cp.tagline}`);
                }
                if (fieldsSet.has('mission_statement') && cp.mission_statement) {
                    parts.push(`Mission: ${cp.mission_statement}`);
                }
                if (fieldsSet.has('office_address') && cp.office_address) {
                    parts.push(`Office Address: ${cp.office_address}`);
                }
                if (fieldsSet.has('policies') && cp.policies) {
                    parts.push(`Policies: ${cp.policies}`);
                }
                if (fieldsSet.has('core_values') && cp.core_values?.length) {
                    parts.push(`Core Values: ${cp.core_values.join(', ')}`);
                }
            }
        }

        // Category 2: Products & Services
        if (requiredCategories.includes(2)) {
            const ps = kb.category_2_products_services;
            if (ps?.products?.length) {
                parts.push(`\nPRODUCTS & SERVICES:`);
                for (const product of ps.products.slice(0, 5)) { // Limit to 5 products
                    parts.push(`- ${product.name}: ${product.description || ''}`);
                    if (product.features?.length) {
                        parts.push(`  Features: ${product.features.slice(0, 5).join(', ')}`);
                    }
                }
            }
        }

        // Category 3: Sales Process
        if (requiredCategories.includes(3)) {
            const sp = kb.category_3_sales_process;
            if (sp?.sales_playbook) {
                if (fieldsSet.has('key_talking_points') && sp.sales_playbook.key_talking_points?.length) {
                    parts.push(`\nKEY TALKING POINTS:`);
                    for (const point of sp.sales_playbook.key_talking_points.slice(0, 5)) {
                        parts.push(`- ${point}`);
                    }
                }
                if (fieldsSet.has('discovery_questions') && sp.sales_playbook.discovery_questions?.length) {
                    parts.push(`\nDISCOVERY QUESTIONS:`);
                    for (const q of sp.sales_playbook.discovery_questions.slice(0, 3)) {
                        parts.push(`- ${q}`);
                    }
                }
            }
            if (sp?.deal_qualification?.ideal_customer_profile) {
                parts.push(`\nIdeal Customer: ${sp.deal_qualification.ideal_customer_profile}`);
            }
        }

        // Category 5: Common Scenarios (Objections)
        if (requiredCategories.includes(5)) {
            const cs = kb.category_5_common_scenarios;
            if (fieldsSet.has('objections') && cs?.objections?.length) {
                parts.push(`\nOBJECTION HANDLING:`);
                for (const obj of cs.objections.slice(0, 3)) {
                    parts.push(`- "${obj.objection}": ${obj.our_response}`);
                }
            }
        }

        // Category 6: Communication & Tone (Always include signature/tone)
        if (requiredCategories.includes(6)) {
            const comm = kb.category_6_communication;
            if (comm?.brand_voice) {
                parts.push(`\nBRAND VOICE:`);
                parts.push(`Tone: ${comm.brand_voice.overall_tone}`);
                if (comm.brand_voice.words_we_use?.length) {
                    parts.push(`Words to Use: ${comm.brand_voice.words_we_use.slice(0, 5).join(', ')}`);
                }
                if (comm.brand_voice.words_we_avoid?.length) {
                    parts.push(`Words to Avoid: ${comm.brand_voice.words_we_avoid.slice(0, 5).join(', ')}`);
                }
            }
            if (comm?.signature) {
                parts.push(`\nEMAIL FORMATTING:`);
                if (comm.signature.greeting) {
                    parts.push(`Opening Phrase: ${comm.signature.greeting}`);
                }
                if (comm.signature.sign_off) {
                    parts.push(`Closing Phrase: ${comm.signature.sign_off}`);
                }
                if (comm.signature.full_signature) {
                    parts.push(`Signature:\n${comm.signature.full_signature}`);
                }
            }
        }

        // Category 7: Operations
        if (requiredCategories.includes(7)) {
            const ops = kb.category_7_operations;
            if (ops?.implementation?.typical_timeline_days) {
                parts.push(`\nIMPLEMENTATION: ${ops.implementation.typical_timeline_days} days typical timeline`);
            }
            if (ops?.support_and_slas) {
                if (ops.support_and_slas.support_hours) {
                    parts.push(`Support Hours: ${ops.support_and_slas.support_hours}`);
                }
                if (ops.support_and_slas.support_channels?.length) {
                    parts.push(`Support Channels: ${ops.support_and_slas.support_channels.join(', ')}`);
                }
            }
        }

        // Category 8: Resources (Case Studies)
        if (requiredCategories.includes(8)) {
            const res = kb.category_8_resources;
            if (fieldsSet.has('case_studies') && res?.case_studies?.length) {
                parts.push(`\nSUCCESS STORIES:`);
                for (const cs of res.case_studies.slice(0, 2)) {
                    parts.push(`- ${cs.customer_name}: ${cs.the_challenge}`);
                    if (cs.results?.length) {
                        parts.push(`  Results: ${cs.results.map(r => `${r.metric}: ${r.value}`).join(', ')}`);
                    }
                }
            }
        }



        // Category 9: Pricing & Plans
        if (requiredCategories.includes(9)) {
            const pricing = kb.category_9_pricing;
            if (pricing?.tiers?.length) {
                parts.push(`\nPRICING & PLANS:`);
                for (const tier of pricing.tiers) {
                    let tierLine = `- ${tier.name}: ${tier.basePrice} ${tier.currency || pricing.defaultCurrency}`;
                    if (tier.billingCycle && tier.billingCycle !== 'one-time') {
                        tierLine += `/${tier.billingCycle === 'annual' ? 'year' : 'month'}`;
                    }
                    if (tier.isPopular) tierLine += ' (Most Popular)';
                    if (tier.isEnterprise) tierLine += ' (Enterprise)';
                    parts.push(tierLine);
                    if (tier.description) {
                        parts.push(`  ${tier.description}`);
                    }
                    if (tier.features?.length) {
                        parts.push(`  Features: ${tier.features.slice(0, 5).join(', ')}${tier.features.length > 5 ? '...' : ''}`);
                    }
                }
                if (pricing.freeTrialDays) {
                    parts.push(`Free Trial: ${pricing.freeTrialDays} days`);
                }
                if (pricing.discountNotes) {
                    parts.push(`Discounts: ${pricing.discountNotes}`);
                }
            }
        }

        return parts.join('\n');
    }
}
