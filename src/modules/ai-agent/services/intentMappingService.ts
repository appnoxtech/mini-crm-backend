/**
 * Intent Mapping Service
 * Maps email intents to specific KB categories and fields
 * Enables smart, selective context extraction for AI email generation
 */

// ============================================
// INTENT DEFINITIONS WITH KB MAPPINGS
// ============================================

export interface IntentMapping {
    categories: number[];           // KB category IDs to include
    fields: string[];              // Specific fields to extract
    keywords: string[];            // Keywords that trigger this intent
    priority: number;              // Higher = more specific
}

export const INTENT_KB_MAPPING: Record<string, IntentMapping> = {


    // Pricing and plan inquiries
    'pricing_inquiry': {
        categories: [9],
        fields: ['tiers', 'defaultCurrency', 'discountNotes', 'customPricingAvailable', 'freeTrialDays'],
        keywords: ['price', 'cost', 'quote', 'pricing', 'subscription', 'plan', 'tier', 'discount', 'billing', 'how much', 'rates'],
        priority: 10
    },

    // Company information requests
    'company_info': {
        categories: [1],
        fields: ['company_name', 'industry', 'mission_statement', 'office_address', 'tagline', 'core_values'],
        keywords: ['company', 'about', 'who are you', 'address', 'location', 'office', 'headquarters', 'founded', 'team'],
        priority: 8
    },

    // Feature and capability questions
    'feature_question': {
        categories: [1, 2, 7],
        fields: ['products', 'features', 'implementation', 'support_channels'],
        keywords: ['feature', 'capability', 'does it', 'can you', 'integrate', 'integration', 'api', 'support', 'how does', 'work with'],
        priority: 9
    },

    // Handling objections and concerns
    'objection_handling': {
        categories: [5, 8],
        fields: ['objections', 'case_studies', 'success_metrics'],
        keywords: ['expensive', 'competitor', 'concern', 'worried', 'but', 'however', 'issue', 'problem', 'alternative', 'compare', 'vs', 'versus'],
        priority: 10
    },

    // Policy-related questions
    'policy_question': {
        categories: [1, 7],
        fields: ['policies', 'support_hours', 'support_channels', 'legal'],
        keywords: ['refund', 'policy', 'guarantee', 'cancel', 'cancellation', 'terms', 'conditions', 'privacy', 'data', 'security', 'sla'],
        priority: 9
    },

    // Demo/meeting scheduling
    'demo_scheduling': {
        categories: [3, 7],
        fields: ['sales_playbook', 'implementation', 'discovery_questions'],
        keywords: ['demo', 'call', 'meeting', 'schedule', 'availability', 'calendar', 'discuss', 'talk', 'connect', 'show'],
        priority: 7
    },

    // Implementation/onboarding questions
    'implementation_question': {
        categories: [7],
        fields: ['implementation', 'support_hours', 'support_channels', 'typical_timeline_days'],
        keywords: ['implement', 'onboard', 'setup', 'timeline', 'how long', 'process', 'steps', 'training'],
        priority: 8
    },

    // General reply (fallback)
    'general_reply': {
        categories: [1, 6],
        fields: ['company_name', 'tagline', 'brand_voice', 'signature', 'greeting', 'sign_off'],
        keywords: [],
        priority: 1
    }
};

// ============================================
// INTENT DETECTION SERVICE
// ============================================

export interface DetectedIntent {
    intent: string;
    confidence: number;
    matchedKeywords: string[];
}

export class IntentMappingService {

    /**
     * Analyze email content to detect intents
     * Uses efficient keyword matching - no AI call needed
     */
    detectIntents(emailContent: string, emailSubject: string = ''): DetectedIntent[] {
        const fullText = `${emailSubject} ${emailContent}`.toLowerCase();
        const detectedIntents: DetectedIntent[] = [];

        for (const [intentName, mapping] of Object.entries(INTENT_KB_MAPPING)) {
            if (mapping.keywords.length === 0) continue; // Skip general_reply for detection

            const matchedKeywords: string[] = [];
            for (const keyword of mapping.keywords) {
                if (fullText.includes(keyword.toLowerCase())) {
                    matchedKeywords.push(keyword);
                }
            }

            if (matchedKeywords.length > 0) {
                // Confidence based on keyword matches and priority
                const confidence = Math.min(
                    (matchedKeywords.length / mapping.keywords.length) * 0.7 +
                    (mapping.priority / 10) * 0.3,
                    1.0
                );

                detectedIntents.push({
                    intent: intentName,
                    confidence,
                    matchedKeywords
                });
            }
        }

        // Sort by confidence (highest first)
        detectedIntents.sort((a, b) => b.confidence - a.confidence);

        // Always include general_reply as fallback if no intents detected
        if (detectedIntents.length === 0) {
            detectedIntents.push({
                intent: 'general_reply',
                confidence: 1.0,
                matchedKeywords: []
            });
        }

        return detectedIntents;
    }

    /**
     * Get the KB categories needed for the detected intents
     */
    getRequiredCategories(intents: DetectedIntent[]): number[] {
        const categories = new Set<number>();

        for (const detected of intents) {
            const mapping = INTENT_KB_MAPPING[detected.intent];
            if (mapping) {
                for (const cat of mapping.categories) {
                    categories.add(cat);
                }
            }
        }

        // Always include category 6 (Communication) for signature/tone
        categories.add(6);

        return Array.from(categories).sort((a, b) => a - b);
    }

    /**
     * Get the specific fields needed for the detected intents
     */
    getRequiredFields(intents: DetectedIntent[]): string[] {
        const fields = new Set<string>();

        for (const detected of intents) {
            const mapping = INTENT_KB_MAPPING[detected.intent];
            if (mapping) {
                for (const field of mapping.fields) {
                    fields.add(field);
                }
            }
        }

        // Always include signature fields
        fields.add('greeting');
        fields.add('sign_off');
        fields.add('full_signature');
        fields.add('brand_voice');

        return Array.from(fields);
    }

    /**
     * Get mapping for a specific intent
     */
    getMapping(intent: string): IntentMapping | null {
        return INTENT_KB_MAPPING[intent] || null;
    }
}

// Export singleton instance
export const intentMappingService = new IntentMappingService();
