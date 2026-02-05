import { PrismaClient } from "@prisma/client";
import { prisma as prismaInstance } from "../../../shared/prisma";
import { v4 as uuidv4 } from "uuid";
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
    PricingPlans,
    DEFAULT_STRUCTURED_KB,
    KB_CATEGORIES,
    KBCategoryKey
} from "../types/structuredKB";

export class StructuredKBModel {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient = prismaInstance) {
        this.prisma = prisma;
    }

    async initialize(): Promise<void> {
        // Initialize default KB if not exists
        const existing = await this.prisma.structuredKnowledgeBase.findUnique({
            where: { id: 'default' }
        });

        if (!existing) {
            await this.createDefaultKB();
        }
    }

    private async createDefaultKB(): Promise<void> {
        await this.prisma.structuredKnowledgeBase.create({
            data: {
                id: 'default',
                category_1_company_profile: DEFAULT_STRUCTURED_KB.category_1_company_profile as any,
                category_2_products_services: DEFAULT_STRUCTURED_KB.category_2_products_services as any,
                category_3_sales_process: DEFAULT_STRUCTURED_KB.category_3_sales_process as any,
                category_4_customers_markets: DEFAULT_STRUCTURED_KB.category_4_customers_markets as any,
                category_5_common_scenarios: DEFAULT_STRUCTURED_KB.category_5_common_scenarios as any,
                category_6_communication: DEFAULT_STRUCTURED_KB.category_6_communication as any,
                category_7_operations: DEFAULT_STRUCTURED_KB.category_7_operations as any,
                category_8_resources: DEFAULT_STRUCTURED_KB.category_8_resources as any,
                category_9_pricing: DEFAULT_STRUCTURED_KB.category_9_pricing as any,
                version: 1,
                completion_percent: 0,
                updated_at: new Date()
            }
        });
    }

    async getKB(id: string = 'default'): Promise<StructuredKnowledgeBase | null> {
        const row = await this.prisma.structuredKnowledgeBase.findUnique({
            where: { id }
        });

        if (!row) return null;

        return {
            id: row.id,
            category_1_company_profile: (row.category_1_company_profile as any) || {},
            category_2_products_services: (row.category_2_products_services as any) || {},
            category_3_sales_process: (row.category_3_sales_process as any) || {},
            category_4_customers_markets: (row.category_4_customers_markets as any) || {},
            category_5_common_scenarios: (row.category_5_common_scenarios as any) || {},
            category_6_communication: (row.category_6_communication as any) || {},
            category_7_operations: (row.category_7_operations as any) || {},
            category_8_resources: (row.category_8_resources as any) || {},
            category_9_pricing: (row.category_9_pricing as any) || { tiers: [], defaultCurrency: "USD" },
            version: row.version,
            completion_percent: row.completion_percent,
            updated_at: row.updated_at
        };
    }

    async updateCategory(
        categoryNumber: number,
        data: CompanyProfile | ProductsCatalog | SalesProcess | CustomerMarkets | CommonScenarios | Communication | Operations | Resources | PricingPlans,
        kbId: string = 'default'
    ): Promise<boolean> {
        const categoryKey = `category_${categoryNumber}_${this.getCategoryName(categoryNumber)}`;

        // Get current KB for versioning
        const currentKB = await this.getKB(kbId);
        if (!currentKB) return false;

        // Save version snapshot before update
        await this.saveVersion(kbId, currentKB, [categoryKey]);

        // Calculate new completion after update
        const updatedKB = { ...currentKB, [categoryKey]: data };
        const completionPercent = this.calculateCompletion(updatedKB);

        await this.prisma.structuredKnowledgeBase.update({
            where: { id: kbId },
            data: {
                [categoryKey]: data as any,
                version: { increment: 1 },
                updated_at: new Date(),
                completion_percent: completionPercent
            }
        });

        return true;
    }

    private getCategoryName(categoryNumber: number): string {
        const names: Record<number, string> = {
            1: 'company_profile',
            2: 'products_services',
            3: 'sales_process',
            4: 'customers_markets',
            5: 'common_scenarios',
            6: 'communication',
            7: 'operations',
            8: 'resources',
            9: 'pricing'
        };
        return names[categoryNumber] || '';
    }

    private async saveVersion(kbId: string, kb: StructuredKnowledgeBase, changedSections: string[]): Promise<void> {
        await this.prisma.structuredKBVersion.create({
            data: {
                id: uuidv4(),
                kbId: kbId,
                version: kb.version,
                fullKBSnapshot: kb as any,
                changedSections: changedSections as any,
                changeTimestamp: new Date()
            }
        });
    }

    calculateCompletion(kb: StructuredKnowledgeBase): number {
        // Calculate based on 9 categories, each worth approx 11.1%
        let completedCategories = 0;

        // Category 1: Company Profile
        const cp = kb.category_1_company_profile;
        if (cp?.company_name && cp?.industry) completedCategories++;

        // Category 2: Products & Services
        const ps = kb.category_2_products_services;
        if (ps?.products?.length > 0) completedCategories++;

        // Category 3: Sales Process
        const sp = kb.category_3_sales_process;
        if (sp?.stages?.length > 0 ||
            sp?.sales_playbook?.key_talking_points?.length > 0 ||
            sp?.sales_playbook?.discovery_questions?.length > 0 ||
            sp?.deal_qualification?.ideal_customer_profile) {
            completedCategories++;
        }

        // Category 4: Customers & Markets
        const cm = kb.category_4_customers_markets;
        if (cm?.customer_segments?.length > 0) completedCategories++;

        // Category 5: Common Scenarios
        const cs = kb.category_5_common_scenarios;
        if (cs?.faqs?.length > 0 || cs?.objections?.length > 0) completedCategories++;

        // Category 6: Communication
        const comm = kb.category_6_communication;
        if (comm?.brand_voice?.overall_tone && comm?.signature?.full_signature) completedCategories++;

        // Category 7: Operations
        const ops = kb.category_7_operations;
        if (ops?.implementation?.phases?.length > 0 ||
            ops?.implementation?.typical_timeline_days ||
            ops?.support_and_slas?.support_hours ||
            ops?.support_and_slas?.support_channels?.length > 0) {
            completedCategories++;
        }

        // Category 8: Resources
        const res = kb.category_8_resources;
        if (res?.case_studies?.length > 0) completedCategories++;

        // Category 9: Pricing
        const pricing = kb.category_9_pricing;
        if (pricing?.tiers?.length > 0) completedCategories++;

        return Math.round((completedCategories / 9) * 100);
    }

    async getCompletionStatus(kbId: string = 'default'): Promise<{
        percent: number;
        incomplete_sections: string[];
        categories: Array<{ id: number; name: string; complete: boolean }>;
    }> {
        const kb = await this.getKB(kbId);
        if (!kb) return { percent: 0, incomplete_sections: [], categories: [] };

        const incomplete: string[] = [];
        const categories: Array<{ id: number; name: string; complete: boolean }> = [];

        // Check each category
        const cp = kb.category_1_company_profile;
        const cat1Complete = !!(cp?.company_name && cp?.industry);
        if (!cat1Complete) incomplete.push('Company Profile');
        categories.push({ id: 1, name: 'Company Profile', complete: cat1Complete });

        const ps = kb.category_2_products_services;
        const cat2Complete = (ps?.products?.length > 0);
        if (!cat2Complete) incomplete.push('Products & Services');
        categories.push({ id: 2, name: 'Products & Services', complete: cat2Complete });

        const sp = kb.category_3_sales_process;
        const cat3Complete = !!(sp?.stages?.length > 0 ||
            sp?.sales_playbook?.key_talking_points?.length > 0 ||
            sp?.sales_playbook?.discovery_questions?.length > 0 ||
            sp?.deal_qualification?.ideal_customer_profile);
        if (!cat3Complete) incomplete.push('Sales & Process');
        categories.push({ id: 3, name: 'Sales & Process', complete: cat3Complete });

        const cm = kb.category_4_customers_markets;
        const cat4Complete = (cm?.customer_segments?.length > 0);
        if (!cat4Complete) incomplete.push('Customers & Markets');
        categories.push({ id: 4, name: 'Customers & Markets', complete: cat4Complete });

        const cs = kb.category_5_common_scenarios;
        const cat5Complete = !!(cs?.faqs?.length > 0 || cs?.objections?.length > 0);
        if (!cat5Complete) incomplete.push('Common Scenarios');
        categories.push({ id: 5, name: 'Common Scenarios', complete: cat5Complete });

        const comm = kb.category_6_communication;
        const cat6Complete = !!(comm?.brand_voice?.overall_tone && comm?.signature?.full_signature);
        if (!cat6Complete) incomplete.push('Communication & Tone');
        categories.push({ id: 6, name: 'Communication & Tone', complete: cat6Complete });

        const ops = kb.category_7_operations;
        const cat7Complete = !!(ops?.implementation?.phases?.length > 0 ||
            ops?.implementation?.typical_timeline_days ||
            ops?.support_and_slas?.support_hours ||
            ops?.support_and_slas?.support_channels?.length > 0);
        if (!cat7Complete) incomplete.push('Operations & Logistics');
        categories.push({ id: 7, name: 'Operations & Logistics', complete: cat7Complete });

        const res = kb.category_8_resources;
        const cat8Complete = (res?.case_studies?.length > 0);
        if (!cat8Complete) incomplete.push('Resources & References');
        categories.push({ id: 8, name: 'Resources & References', complete: cat8Complete });

        const pricing = kb.category_9_pricing;
        const cat9Complete = (pricing?.tiers?.length > 0);
        if (!cat9Complete) incomplete.push('Pricing & Plans');
        categories.push({ id: 9, name: 'Pricing & Plans', complete: cat9Complete });

        return {
            percent: this.calculateCompletion(kb),
            incomplete_sections: incomplete,
            categories
        };
    }

    async getVersionHistory(kbId: string = 'default', limit: number = 10): Promise<Array<{
        version: number;
        changed_sections: string[];
        change_timestamp: Date;
    }>> {
        const rows = await this.prisma.structuredKBVersion.findMany({
            where: { kbId },
            orderBy: { version: 'desc' },
            take: limit,
            select: {
                version: true,
                changedSections: true,
                changeTimestamp: true
            }
        });

        return rows.map((row: { version: number; changedSections: unknown; changeTimestamp: Date }) => ({
            version: row.version,
            changed_sections: (row.changedSections as string[]) || [],
            change_timestamp: row.changeTimestamp
        }));
    }
}
