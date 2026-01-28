export interface ClientProfile {
    id: string;
    dealId?: number;
    personId?: number;
    organizationId?: number;
    requirements: string[];
    budgetRange: { min: number; max: number } | null;
    timeline: string | null;
    decisionMakers: string[];
    objections: string[];
    preferences: Record<string, any>;
    relationshipStage: 'exploration' | 'evaluation' | 'negotiation' | 'implementation' | 'renewal' | 'churn_risk';
    maturityScore: number;
    lastUpdated: Date;
}

export interface DiscountRule {
    id: string;
    tierId: string;
    type: 'volume' | 'duration' | 'seasonal' | 'loyalty';
    percentage: number;
    conditions: Record<string, any>;
}

export interface PricingTier {
    id: string;
    name: string;
    basePrice: number;
    currency: string;
    features: string[];
    contractTerms: string;
    discountRules: DiscountRule[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface BrandGuidelines {
    id: string;
    tone: string;
    voiceCharacteristics: string[];
    openingPhrases: string[];
    closingPhrases: string[];
    signatureTemplate: string;
    ctaPatterns: string[];
    avoidPhrases: string[];
    updatedAt: Date;
}

export interface SuggestionIssue {
    severity: 'red' | 'yellow' | 'green';
    issue: string;
    suggestion: string;
}

export interface EmailSuggestion {
    id: string;
    dealId?: number;
    personId?: number;
    subjectLine: string;
    body: string;
    htmlBody?: string;
    emailType: 'pricing_proposal' | 'check_in' | 'objection_handling' | 'renewal' | 're_engagement' | 'follow_up' | 'proactive_outreach';
    confidenceScore: number;
    reasoning: string;
    qualityScore: number;
    issues: SuggestionIssue[];
    status: 'generated' | 'reviewed' | 'sent' | 'discarded';
    userEdits?: string;
    sentAt?: Date;
    createdAt: Date;
}

export interface SuggestionRequest {
    dealId?: number;
    personId?: number;
    threadId?: string;
    messageId?: string;
    email?: string;
    forceRefresh?: boolean;
    customPrompt?: string;
    lastEmailContent?: string;
    lastEmailSubject?: string;
    userName?: string;
}
