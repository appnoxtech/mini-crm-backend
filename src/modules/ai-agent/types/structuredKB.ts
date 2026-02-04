// ============================================
// STRUCTURED KNOWLEDGE BASE TYPES
// 8 Categories for AI Email Generation Pipeline
// ============================================

// ============================================
// CATEGORY 1: COMPANY PROFILE
// ============================================
export interface CompanyProfile {
    company_name: string;
    industry: string;
    company_size: string;
    years_in_business?: number;
    location?: string;
    office_address?: string;
    policies?: string;
    website?: string;
    description?: string;
    mission_statement?: string;
    core_values: string[];
    tagline?: string;
    brand_personality: string[];
}

// ============================================
// CATEGORY 2: PRODUCTS & SERVICES
// ============================================
export interface Product {
    id: string;
    name: string;
    description: string;
    category: 'core' | 'premium' | 'add-on';
    features: string[];
    target_customer: string;
    use_cases: string[];
    typical_implementation_days?: number;
    support_level?: string;
    status: 'active' | 'legacy' | 'coming_soon';
}

export interface DiscountRules {
    volume?: {
        threshold: number;
        discount_percent: number;
    };
    annual?: {
        discount_percent: number;
    };
    partner?: {
        discount_percent: number;
    };
    early_bird?: {
        discount_percent: number;
        valid_until: string;
    };
}

export interface ProductsCatalog {
    products: Product[];
    discounts: DiscountRules;
    add_ons: Array<{
        id: string;
        name: string;
        price: number;
        description: string;
    }>;
}

// ============================================
// CATEGORY 3: SALES & PROCESS
// ============================================
export interface SalesStage {
    id: string;
    name: string;
    order: number;
    typical_duration_days?: number;
    email_goal: string;
    typical_questions: string[];
    blockers: string[];
    cta_primary: string;
    cta_alternatives: string[];
    urgency_level: 'low' | 'medium' | 'high';
    expected_response_rate?: number;
}

export interface SalesPlaybook {
    discovery_questions: string[];
    key_talking_points: string[];
    competitive_responses: Record<string, string>;
    common_objections_matrix: Array<{
        objection: string;
        our_response: string;
    }>;
    demo_flow?: string;
}

export interface DealQualification {
    ideal_customer_profile: string;
    deal_size_categories: {
        small: string;
        medium: string;
        large: string;
        enterprise: string;
    };
    minimum_contract_value?: number;
    go_no_go_criteria: string[];
    disqualification_criteria: string[];
    success_probability_signals: string[];
}

export interface SalesProcess {
    stages: SalesStage[];
    sales_playbook: SalesPlaybook;
    deal_qualification: DealQualification;
}

// ============================================
// CATEGORY 4: CUSTOMERS & MARKETS
// ============================================
export interface CustomerSegment {
    id: string;
    name: string;
    description?: string;
    company_size: string;
    revenue_range?: string;
    geography?: string;
    pain_points: string[];
    why_they_choose_us: string[];
    typical_deal_size?: number;
    typical_sales_cycle_days?: number;
    decision_maker_role?: string;
    decision_criteria: string[];
}

export interface Industry {
    name: string;
    overview?: string;
    key_challenges: string[];
    compliance_requirements: string[];
    our_solution_fit?: string;
    typical_use_case?: string;
    success_stories: string[];
}

export interface GeographicInfo {
    focus_regions: string[];
    support_timezones: string[];
    language_support: string[];
    local_compliance: string[];
}

export interface CustomerMarkets {
    customer_segments: CustomerSegment[];
    industries_served: Industry[];
    geographic_focus: GeographicInfo;
}

// ============================================
// CATEGORY 5: COMMON SCENARIOS
// ============================================
export interface FAQ {
    id: string;
    question: string;
    answer: string;
    answer_short?: string;
    category: string;
    sales_stage?: string;
    frequency: 'very_common' | 'common' | 'occasional';
    resource_link?: string;
    related_topics: string[];
}

export interface Objection {
    id: string;
    objection: string;
    why_they_say_it?: string;
    our_response: string;
    proof_points: string[];
    case_study_reference?: string;
    alternative_solution?: string;
    escalation_trigger?: string;
    sales_stage?: string;
}

export interface UseCase {
    id: string;
    name: string;
    industry?: string;
    company_type?: string;
    the_problem: string;
    how_they_use_us: string;
    results: string;
    metrics: Array<{
        metric: string;
        value: string;
    }>;
    time_to_value?: string;
    customer_name?: string;
    customer_testimonial?: string;
    when_to_mention?: string;
}

export interface SuccessMetric {
    id: string;
    name: string;
    value: string;
    unit: string;
    number_of_customers?: number;
    industry?: string;
    timeframe?: string;
    confidence: 'high' | 'medium' | 'low';
}

export interface CommonScenarios {
    faqs: FAQ[];
    objections: Objection[];
    use_cases: UseCase[];
    success_metrics: SuccessMetric[];
}

// ============================================
// CATEGORY 6: COMMUNICATION & TONE
// ============================================
export interface BrandVoice {
    overall_tone: string;
    formality_level: number; // 1-5 (1=casual, 5=formal)
    characteristics: string[];
    personality?: string;
    words_we_use: string[];
    words_we_avoid: string[];
    sentence_length: 'short' | 'medium' | 'long' | 'mixed';
    paragraph_length?: string;
    emoji_usage: 'never' | 'rare' | 'occasional' | 'frequent';
    data_usage: 'always' | 'sometimes' | 'rarely';
    humor: boolean;
}

export interface EmailPattern {
    email_type: string;
    example_email?: string;
    key_elements?: string;
    opening: string;
    closing: string;
    typical_cta?: string;
}

export interface CTA {
    primary: string;
    alternatives: string[];
    button_text?: string;
    urgency_level: 'low' | 'medium' | 'high';
    when_to_use?: string;
}

export interface EmailSignature {
    full_signature: string;
    name?: string;
    title?: string;
    email?: string;
    phone?: string;
    company?: string;
    website?: string;
    greeting: string;
    sign_off: string;
}

export interface DosAndDonts {
    do_list: string[];
    dont_list: string[];
    sensitive_topics: string[];
    compliance_language?: string;
}

export interface Communication {
    brand_voice: BrandVoice;
    email_patterns: EmailPattern[];
    ctas_by_stage: Record<string, CTA>;
    signature: EmailSignature;
    dos_and_donts: DosAndDonts;
}

// ============================================
// CATEGORY 7: OPERATIONS & LOGISTICS
// ============================================
export interface ImplementationPhase {
    name: string;
    duration_days: number;
    description?: string;
    customer_effort_hours?: number;
    our_effort_hours?: number;
}

export interface Implementation {
    overview?: string;
    typical_timeline_days: number;
    phases: ImplementationPhase[];
    customer_responsibilities: string[];
    our_responsibilities: string[];
    typical_blockers: string[];
    success_metrics: string[];
    onboarding_support_level?: string;
}

export interface Support {
    support_hours: string;
    support_channels: string[];
    response_time_slas: Record<string, number>;
    uptime_guarantee?: number;
    incident_response?: string;
    account_manager_availability?: string;
    training_options: string[];
    escalation_path?: string;
}

export interface Legal {
    data_privacy?: string;
    security_certifications: string[];
    standard_contract_length_months?: number;
    auto_renewal?: boolean;
    renewal_notice_days?: number;
    sla_agreement?: string;
    industry_compliance: string[];
    cannot_promise: string[];
}

export interface TeamMember {
    name: string;
    title: string;
    specialty?: string;
    email?: string;
    timezone?: string;
}

export interface TeamStructure {
    sales_lead?: TeamMember;
    implementation_lead?: TeamMember;
    support_lead?: TeamMember;
    team_members: TeamMember[];
    decision_authority: Record<string, string>;
    escalation_contacts: Record<string, string>;
    geographic_coverage: Record<string, string[]>;
}

export interface Operations {
    implementation: Implementation;
    support_and_slas: Support;
    legal_and_compliance: Legal;
    team_structure: TeamStructure;
}

// ============================================
// CATEGORY 8: RESOURCES & REFERENCES
// ============================================
export interface CaseStudy {
    id: string;
    customer_name: string;
    industry?: string;
    company_size?: string;
    company_stage?: string;
    the_challenge: string;
    the_solution: string;
    results: Array<{
        metric: string;
        value: string;
        impact?: string;
    }>;
    time_to_value?: string;
    customer_testimonial?: string;
    document_link?: string;
    video_link?: string;
    key_quote?: string;
    when_to_reference?: {
        sales_stage?: string;
        customer_segment?: string;
        objection_addressed?: string;
    };
}

export interface Documentation {
    title: string;
    description?: string;
    content_type: string;
    url?: string;
    intended_audience: 'internal' | 'customer';
    when_to_share?: string;
    relevance: 'high' | 'medium' | 'low';
}

export interface ExternalResource {
    title: string;
    description?: string;
    url: string;
    resource_type: string;
    published_by?: string;
    when_to_share?: string;
    authority_score: 'high' | 'medium' | 'low';
}

export interface CompetitorAnalysis {
    competitor_name: string;
    how_we_compare: Array<{
        feature: string;
        us: string;
        them: string;
    }>;
    our_advantages: string[];
    their_advantages: string[];
    positioning_message?: string;
    comparison_guide_link?: string;
    when_to_mention?: string;
}

export interface Resources {
    case_studies: CaseStudy[];
    internal_documentation: Documentation[];
    external_resources: ExternalResource[];
    competitor_analysis: CompetitorAnalysis[];
}



// ============================================
// CATEGORY 9: PRICING & PLANS
// ============================================
export interface PricingTier {
    id: string;
    name: string;
    description?: string;
    basePrice: number;
    currency: string;
    billingCycle: 'monthly' | 'annual' | 'one-time' | 'custom';
    features: string[];
    limitations?: string[];
    targetCustomer?: string;
    isPopular?: boolean;
    isEnterprise?: boolean;
}

export interface PricingPlans {
    tiers: PricingTier[];
    defaultCurrency: string;
    discountNotes?: string;
    customPricingAvailable?: boolean;
    freeTrialDays?: number;
}

// ============================================
// MAIN STRUCTURED KB INTERFACE
// ============================================
export interface StructuredKnowledgeBase {
    id: string;
    category_1_company_profile: CompanyProfile;
    category_2_products_services: ProductsCatalog;
    category_3_sales_process: SalesProcess;
    category_4_customers_markets: CustomerMarkets;
    category_5_common_scenarios: CommonScenarios;
    category_6_communication: Communication;
    category_7_operations: Operations;
    category_8_resources: Resources;
    category_9_pricing: PricingPlans;
    version: number;
    completion_percent: number;
    updated_at: Date;
}

// Default/empty KB structure
export const DEFAULT_STRUCTURED_KB: Omit<StructuredKnowledgeBase, 'id' | 'version' | 'completion_percent' | 'updated_at'> = {
    category_1_company_profile: {
        company_name: '',
        industry: '',
        company_size: '',
        core_values: [],
        brand_personality: []
    },
    category_2_products_services: {
        products: [],
        discounts: {},
        add_ons: []
    },
    category_3_sales_process: {
        stages: [],
        sales_playbook: {
            discovery_questions: [],
            key_talking_points: [],
            competitive_responses: {},
            common_objections_matrix: []
        },
        deal_qualification: {
            ideal_customer_profile: '',
            deal_size_categories: { small: '', medium: '', large: '', enterprise: '' },
            go_no_go_criteria: [],
            disqualification_criteria: [],
            success_probability_signals: []
        }
    },
    category_4_customers_markets: {
        customer_segments: [],
        industries_served: [],
        geographic_focus: {
            focus_regions: [],
            support_timezones: [],
            language_support: [],
            local_compliance: []
        }
    },
    category_5_common_scenarios: {
        faqs: [],
        objections: [],
        use_cases: [],
        success_metrics: []
    },
    category_6_communication: {
        brand_voice: {
            overall_tone: 'professional',
            formality_level: 3,
            characteristics: [],
            words_we_use: [],
            words_we_avoid: [],
            sentence_length: 'medium',
            emoji_usage: 'never',
            data_usage: 'sometimes',
            humor: false
        },
        email_patterns: [],
        ctas_by_stage: {},
        signature: {
            full_signature: '',
            greeting: 'Hi [Name],',
            sign_off: 'Best regards,'
        },
        dos_and_donts: {
            do_list: [],
            dont_list: [],
            sensitive_topics: []
        }
    },
    category_7_operations: {
        implementation: {
            typical_timeline_days: 14,
            phases: [],
            customer_responsibilities: [],
            our_responsibilities: [],
            typical_blockers: [],
            success_metrics: []
        },
        support_and_slas: {
            support_hours: '',
            support_channels: [],
            response_time_slas: {},
            training_options: []
        },
        legal_and_compliance: {
            security_certifications: [],
            industry_compliance: [],
            cannot_promise: []
        },
        team_structure: {
            team_members: [],
            decision_authority: {},
            escalation_contacts: {},
            geographic_coverage: {}
        }
    },
    category_8_resources: {
        case_studies: [],
        internal_documentation: [],
        external_resources: [],
        competitor_analysis: []
    },
    category_9_pricing: {
        tiers: [],
        defaultCurrency: 'USD',
        customPricingAvailable: false,
        freeTrialDays: 14
    }
};

// Category names for API and UI
export const KB_CATEGORIES = [
    { id: 1, key: 'category_1_company_profile', name: 'Company Profile', icon: 'Building2' },
    { id: 2, key: 'category_2_products_services', name: 'Products & Services', icon: 'Package' },
    { id: 3, key: 'category_3_sales_process', name: 'Sales & Process', icon: 'TrendingUp' },
    { id: 4, key: 'category_4_customers_markets', name: 'Customers & Markets', icon: 'Users' },
    { id: 5, key: 'category_5_common_scenarios', name: 'Common Scenarios', icon: 'MessageCircle' },
    { id: 6, key: 'category_6_communication', name: 'Communication & Tone', icon: 'Mic' },
    { id: 7, key: 'category_7_operations', name: 'Operations & Logistics', icon: 'Settings' },
    { id: 8, key: 'category_8_resources', name: 'Resources & References', icon: 'FileText' },
    { id: 9, key: 'category_9_pricing', name: 'Pricing & Plans', icon: 'DollarSign' }
] as const;

export type KBCategoryKey = typeof KB_CATEGORIES[number]['key'];
