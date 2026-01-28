import Database from "better-sqlite3";
import { ClientProfile } from "../types";

export class ClientProfileModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS client_profiles (
        id TEXT PRIMARY KEY,
        deal_id INTEGER,
        person_id INTEGER,
        organization_id INTEGER,
        requirements TEXT, -- JSON array
        budget_min REAL,
        budget_max REAL,
        timeline TEXT,
        decision_makers TEXT, -- JSON array
        objections TEXT, -- JSON array
        preferences TEXT, -- JSON object
        relationship_stage TEXT,
        maturity_score REAL,
        last_updated TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_client_profiles_deal ON client_profiles(deal_id)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_client_profiles_person ON client_profiles(person_id)`);
    }

    findByDealId(dealId: number): ClientProfile | null {
        const row = this.db.prepare('SELECT * FROM client_profiles WHERE deal_id = ?').get(dealId) as any;
        if (!row) return null;
        return this.mapRowToProfile(row);
    }

    findByPersonId(personId: number): ClientProfile | null {
        const row = this.db.prepare('SELECT * FROM client_profiles WHERE person_id = ?').get(personId) as any;
        if (!row) return null;
        return this.mapRowToProfile(row);
    }

    upsert(data: ClientProfile): void {
        const stmt = this.db.prepare(`
      INSERT INTO client_profiles (
        id, deal_id, person_id, organization_id, requirements, budget_min, 
        budget_max, timeline, decision_makers, objections, preferences, 
        relationship_stage, maturity_score, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        requirements = excluded.requirements,
        budget_min = excluded.budget_min,
        budget_max = excluded.budget_max,
        timeline = excluded.timeline,
        decision_makers = excluded.decision_makers,
        objections = excluded.objections,
        preferences = excluded.preferences,
        relationship_stage = excluded.relationship_stage,
        maturity_score = excluded.maturity_score,
        last_updated = excluded.last_updated
    `);

        stmt.run(
            data.id,
            data.dealId || null,
            data.personId || null,
            data.organizationId || null,
            JSON.stringify(data.requirements),
            data.budgetRange?.min || null,
            data.budgetRange?.max || null,
            data.timeline,
            JSON.stringify(data.decisionMakers),
            JSON.stringify(data.objections),
            JSON.stringify(data.preferences),
            data.relationshipStage,
            data.maturityScore,
            new Date().toISOString()
        );
    }

    private mapRowToProfile(row: any): ClientProfile {
        return {
            id: row.id,
            dealId: row.deal_id,
            personId: row.person_id,
            organizationId: row.organization_id,
            requirements: JSON.parse(row.requirements || '[]'),
            budgetRange: row.budget_min !== null ? { min: row.budget_min, max: row.budget_max } : null,
            timeline: row.timeline,
            decisionMakers: JSON.parse(row.decision_makers || '[]'),
            objections: JSON.parse(row.objections || '[]'),
            preferences: JSON.parse(row.preferences || '{}'),
            relationshipStage: row.relationship_stage,
            maturityScore: row.maturity_score,
            lastUpdated: new Date(row.last_updated)
        };
    }
}
