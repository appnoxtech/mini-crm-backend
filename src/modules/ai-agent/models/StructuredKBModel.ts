import Database from "better-sqlite3";
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
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        // Create main structured KB table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS structured_knowledge_base (
                id TEXT PRIMARY KEY DEFAULT 'default',
                category_1_company_profile TEXT,
                category_2_products_services TEXT,
                category_3_sales_process TEXT,
                category_4_customers_markets TEXT,
                category_5_common_scenarios TEXT,
                category_6_communication TEXT,
                category_7_operations TEXT,
                category_8_resources TEXT,
                category_9_pricing TEXT,
                version INTEGER DEFAULT 1,
                completion_percent REAL DEFAULT 0,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Migration: Check if category_9_pricing exists (it was added later)
        const columns = this.db.prepare("PRAGMA table_info(structured_knowledge_base)").all() as any[];
        const hasPricing = columns.some(c => c.name === 'category_9_pricing');
        if (!hasPricing) {
            console.log('Migrating structured_knowledge_base: Adding category_9_pricing column');
            this.db.exec('ALTER TABLE structured_knowledge_base ADD COLUMN category_9_pricing TEXT');
        }


        // Create versioning table for history
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS structured_kb_versions (
                id TEXT PRIMARY KEY,
                kb_id TEXT NOT NULL,
                version INTEGER NOT NULL,
                full_kb_snapshot TEXT,
                changed_sections TEXT,
                changed_by TEXT,
                change_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(kb_id, version)
            )
        `);

        // Initialize default KB if not exists
        const existing = this.db.prepare('SELECT id FROM structured_knowledge_base WHERE id = ?').get('default');
        if (!existing) {
            this.createDefaultKB();
        }
    }

    private createDefaultKB(): void {
        const stmt = this.db.prepare(`
            INSERT INTO structured_knowledge_base (
                id,
                category_1_company_profile,
                category_2_products_services,
                category_3_sales_process,
                category_4_customers_markets,
                category_5_common_scenarios,
                category_6_communication,
                category_7_operations,
                category_8_resources,
                category_9_pricing,
                version,
                completion_percent,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            'default',
            JSON.stringify(DEFAULT_STRUCTURED_KB.category_1_company_profile),
            JSON.stringify(DEFAULT_STRUCTURED_KB.category_2_products_services),
            JSON.stringify(DEFAULT_STRUCTURED_KB.category_3_sales_process),
            JSON.stringify(DEFAULT_STRUCTURED_KB.category_4_customers_markets),
            JSON.stringify(DEFAULT_STRUCTURED_KB.category_5_common_scenarios),
            JSON.stringify(DEFAULT_STRUCTURED_KB.category_6_communication),
            JSON.stringify(DEFAULT_STRUCTURED_KB.category_7_operations),
            JSON.stringify(DEFAULT_STRUCTURED_KB.category_8_resources),
            JSON.stringify(DEFAULT_STRUCTURED_KB.category_9_pricing),
            1,
            0,
            new Date().toISOString()
        );
    }

    getKB(id: string = 'default'): StructuredKnowledgeBase | null {
        const row = this.db.prepare('SELECT * FROM structured_knowledge_base WHERE id = ?').get(id) as any;
        if (!row) return null;

        return {
            id: row.id,
            category_1_company_profile: JSON.parse(row.category_1_company_profile || '{}'),
            category_2_products_services: JSON.parse(row.category_2_products_services || '{}'),
            category_3_sales_process: JSON.parse(row.category_3_sales_process || '{}'),
            category_4_customers_markets: JSON.parse(row.category_4_customers_markets || '{}'),
            category_5_common_scenarios: JSON.parse(row.category_5_common_scenarios || '{}'),
            category_6_communication: JSON.parse(row.category_6_communication || '{}'),
            category_7_operations: JSON.parse(row.category_7_operations || '{}'),
            category_8_resources: JSON.parse(row.category_8_resources || '{}'),
            category_9_pricing: JSON.parse(row.category_9_pricing || '{"tiers":[],"defaultCurrency":"USD"}'),
            version: row.version,
            completion_percent: row.completion_percent,
            updated_at: new Date(row.updated_at)
        };
    }

    updateCategory(
        categoryNumber: number,
        data: CompanyProfile | ProductsCatalog | SalesProcess | CustomerMarkets | CommonScenarios | Communication | Operations | Resources | PricingPlans,
        kbId: string = 'default'
    ): boolean {
        const categoryKey = `category_${categoryNumber}_${this.getCategoryName(categoryNumber)}`;

        // Get current KB for versioning
        const currentKB = this.getKB(kbId);
        if (!currentKB) return false;

        // Save version snapshot before update
        this.saveVersion(kbId, currentKB, [categoryKey]);

        // Update the specific category
        const stmt = this.db.prepare(`
            UPDATE structured_knowledge_base 
            SET ${categoryKey} = ?, 
                version = version + 1, 
                updated_at = ?,
                completion_percent = ?
            WHERE id = ?
        `);

        // Calculate new completion after update
        const updatedKB = { ...currentKB, [categoryKey]: data };
        const completionPercent = this.calculateCompletion(updatedKB);

        const result = stmt.run(
            JSON.stringify(data),
            new Date().toISOString(),
            completionPercent,
            kbId
        );

        return result.changes > 0;
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

    private saveVersion(kbId: string, kb: StructuredKnowledgeBase, changedSections: string[]): void {
        const stmt = this.db.prepare(`
            INSERT INTO structured_kb_versions (id, kb_id, version, full_kb_snapshot, changed_sections, change_timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            uuidv4(),
            kbId,
            kb.version,
            JSON.stringify(kb),
            JSON.stringify(changedSections),
            new Date().toISOString()
        );
    }

    calculateCompletion(kb: StructuredKnowledgeBase): number {
        // Calculate based on 8 categories, each worth 12.5%
        let completedCategories = 0;

        // Category 1: Company Profile - need company_name AND industry
        const cp = kb.category_1_company_profile;
        if (cp.company_name && cp.industry) completedCategories++;

        // Category 2: Products & Services - need at least one product
        const ps = kb.category_2_products_services;
        if (ps.products?.length > 0) completedCategories++;

        // Category 3: Sales Process - need stages OR playbook OR qualification
        const sp = kb.category_3_sales_process;
        if (sp.stages?.length > 0 ||
            sp.sales_playbook?.key_talking_points?.length > 0 ||
            sp.sales_playbook?.discovery_questions?.length > 0 ||
            sp.deal_qualification?.ideal_customer_profile) {
            completedCategories++;
        }

        // Category 4: Customers & Markets - need customer segments
        const cm = kb.category_4_customers_markets;
        if (cm.customer_segments?.length > 0) completedCategories++;

        // Category 5: Common Scenarios - need faqs OR objections
        const cs = kb.category_5_common_scenarios;
        if (cs.faqs?.length > 0 || cs.objections?.length > 0) completedCategories++;

        // Category 6: Communication - need tone AND signature
        const comm = kb.category_6_communication;
        if (comm.brand_voice?.overall_tone && comm.signature?.full_signature) completedCategories++;

        // Category 7: Operations - need phases OR timeline OR support info
        const ops = kb.category_7_operations;
        if (ops.implementation?.phases?.length > 0 ||
            ops.implementation?.typical_timeline_days ||
            ops.support_and_slas?.support_hours ||
            ops.support_and_slas?.support_channels?.length > 0) {
            completedCategories++;
        }

        // Category 8: Resources - need case studies
        const res = kb.category_8_resources;
        if (res.case_studies?.length > 0) completedCategories++;

        // Category 9: Pricing - need at least one tier
        const pricing = kb.category_9_pricing;
        if (pricing?.tiers?.length > 0) completedCategories++;

        // Each category is worth roughly 11.1% (100 / 9)
        return Math.round((completedCategories / 9) * 100);
    }

    getCompletionStatus(kbId: string = 'default'): {
        percent: number;
        incomplete_sections: string[];
        categories: Array<{ id: number; name: string; complete: boolean }>;
    } {
        const kb = this.getKB(kbId);
        if (!kb) return { percent: 0, incomplete_sections: [], categories: [] };

        const incomplete: string[] = [];
        const categories: Array<{ id: number; name: string; complete: boolean }> = [];

        // Check each category
        const cp = kb.category_1_company_profile;
        const cat1Complete = !!(cp.company_name && cp.industry);
        if (!cat1Complete) incomplete.push('Company Profile');
        categories.push({ id: 1, name: 'Company Profile', complete: cat1Complete });

        const ps = kb.category_2_products_services;
        const cat2Complete = ps.products?.length > 0;
        if (!cat2Complete) incomplete.push('Products & Services');
        categories.push({ id: 2, name: 'Products & Services', complete: cat2Complete });

        const sp = kb.category_3_sales_process;
        // Check stages OR sales_playbook content OR deal_qualification content
        const cat3Complete = sp.stages?.length > 0 ||
            sp.sales_playbook?.key_talking_points?.length > 0 ||
            sp.sales_playbook?.discovery_questions?.length > 0 ||
            !!sp.deal_qualification?.ideal_customer_profile;
        if (!cat3Complete) incomplete.push('Sales & Process');
        categories.push({ id: 3, name: 'Sales & Process', complete: cat3Complete });

        const cm = kb.category_4_customers_markets;
        const cat4Complete = cm.customer_segments?.length > 0;
        if (!cat4Complete) incomplete.push('Customers & Markets');
        categories.push({ id: 4, name: 'Customers & Markets', complete: cat4Complete });

        const cs = kb.category_5_common_scenarios;
        const cat5Complete = cs.faqs?.length > 0 || cs.objections?.length > 0;
        if (!cat5Complete) incomplete.push('Common Scenarios');
        categories.push({ id: 5, name: 'Common Scenarios', complete: cat5Complete });

        const comm = kb.category_6_communication;
        const cat6Complete = !!(comm.brand_voice?.overall_tone && comm.signature?.full_signature);
        if (!cat6Complete) incomplete.push('Communication & Tone');
        categories.push({ id: 6, name: 'Communication & Tone', complete: cat6Complete });

        const ops = kb.category_7_operations;
        // Check phases OR timeline OR support info
        const cat7Complete = ops.implementation?.phases?.length > 0 ||
            !!ops.implementation?.typical_timeline_days ||
            !!ops.support_and_slas?.support_hours ||
            ops.support_and_slas?.support_channels?.length > 0;
        if (!cat7Complete) incomplete.push('Operations & Logistics');
        categories.push({ id: 7, name: 'Operations & Logistics', complete: cat7Complete });

        const res = kb.category_8_resources;
        const cat8Complete = res.case_studies?.length > 0;
        if (!cat8Complete) incomplete.push('Resources & References');
        categories.push({ id: 8, name: 'Resources & References', complete: cat8Complete });

        const pricing = kb.category_9_pricing;
        const cat9Complete = pricing?.tiers?.length > 0;
        if (!cat9Complete) incomplete.push('Pricing & Plans');
        categories.push({ id: 9, name: 'Pricing & Plans', complete: cat9Complete });

        return {
            percent: this.calculateCompletion(kb), // Recalculate on the fly for accuracy
            incomplete_sections: incomplete,
            categories
        };
    }

    getVersionHistory(kbId: string = 'default', limit: number = 10): Array<{
        version: number;
        changed_sections: string[];
        change_timestamp: Date;
    }> {
        const rows = this.db.prepare(`
            SELECT version, changed_sections, change_timestamp 
            FROM structured_kb_versions 
            WHERE kb_id = ? 
            ORDER BY version DESC 
            LIMIT ?
        `).all(kbId, limit) as any[];

        return rows.map(row => ({
            version: row.version,
            changed_sections: JSON.parse(row.changed_sections || '[]'),
            change_timestamp: new Date(row.change_timestamp)
        }));
    }
}
