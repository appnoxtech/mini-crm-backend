import Database from "better-sqlite3";
import { PricingTier, DiscountRule } from "../types";
import { v4 as uuidv4 } from "uuid";

export class PricingModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS pricing_tiers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        base_price REAL NOT NULL,
        currency TEXT DEFAULT 'EUR',
        features TEXT, -- JSON array
        contract_terms TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

        this.db.exec(`
      CREATE TABLE IF NOT EXISTS discount_rules (
        id TEXT PRIMARY KEY,
        tier_id TEXT REFERENCES pricing_tiers(id),
        type TEXT NOT NULL, -- volume, duration, seasonal, loyalty
        percentage REAL NOT NULL,
        conditions TEXT, -- JSON object
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    }

    // Tiers
    getAllTiers(): PricingTier[] {
        const tiersStmt = this.db.prepare('SELECT * FROM pricing_tiers WHERE is_active = 1');
        const tiers = tiersStmt.all() as any[];

        return tiers.map(tier => {
            const rulesStmt = this.db.prepare('SELECT * FROM discount_rules WHERE tier_id = ?');
            const rules = rulesStmt.all(tier.id) as any[];

            return {
                id: tier.id,
                name: tier.name,
                basePrice: tier.base_price,
                currency: tier.currency,
                features: JSON.parse(tier.features || '[]'),
                contractTerms: tier.contract_terms,
                isActive: !!tier.is_active,
                createdAt: new Date(tier.created_at),
                updatedAt: new Date(tier.updated_at),
                discountRules: rules.map(rule => ({
                    id: rule.id,
                    tierId: rule.tier_id,
                    type: rule.type,
                    percentage: rule.percentage,
                    conditions: JSON.parse(rule.conditions || '{}')
                }))
            };
        });
    }

    getTierById(id: string): PricingTier | null {
        const tierStmt = this.db.prepare('SELECT * FROM pricing_tiers WHERE id = ?');
        const tier = tierStmt.get(id) as any;
        if (!tier) return null;

        const rulesStmt = this.db.prepare('SELECT * FROM discount_rules WHERE tier_id = ?');
        const rules = rulesStmt.all(tier.id) as any[];

        return {
            id: tier.id,
            name: tier.name,
            basePrice: tier.base_price,
            currency: tier.currency,
            features: JSON.parse(tier.features || '[]'),
            contractTerms: tier.contract_terms,
            isActive: !!tier.is_active,
            createdAt: new Date(tier.created_at),
            updatedAt: new Date(tier.updated_at),
            discountRules: rules.map(rule => ({
                id: rule.id,
                tierId: rule.tier_id,
                type: rule.type,
                percentage: rule.percentage,
                conditions: JSON.parse(rule.conditions || '{}')
            }))
        };
    }

    createTier(data: Omit<PricingTier, 'id' | 'createdAt' | 'updatedAt' | 'discountRules'>): PricingTier {
        const id = uuidv4();
        const stmt = this.db.prepare(`
      INSERT INTO pricing_tiers (id, name, base_price, currency, features, contract_terms, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            id,
            data.name,
            data.basePrice,
            data.currency,
            JSON.stringify(data.features),
            data.contractTerms,
            data.isActive ? 1 : 0
        );

        return this.getTierById(id)!;
    }

    // Rules
    createDiscountRule(data: Omit<DiscountRule, 'id'>): DiscountRule {
        const id = uuidv4();
        const stmt = this.db.prepare(`
      INSERT INTO discount_rules (id, tier_id, type, percentage, conditions)
      VALUES (?, ?, ?, ?, ?)
    `);

        stmt.run(
            id,
            data.tierId,
            data.type,
            data.percentage,
            JSON.stringify(data.conditions)
        );

        return { ...data, id };
    }
}
