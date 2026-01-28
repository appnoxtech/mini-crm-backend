import Database from "better-sqlite3";
import { EmailSuggestion, SuggestionIssue } from "../types";
import { v4 as uuidv4 } from "uuid";

export class SuggestionModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS email_suggestions (
        id TEXT PRIMARY KEY,
        deal_id INTEGER,
        person_id INTEGER,
        subject_line TEXT NOT NULL,
        body TEXT NOT NULL,
        html_body TEXT,
        email_type TEXT NOT NULL,
        confidence_score REAL,
        reasoning TEXT,
        quality_score REAL,
        issues TEXT, -- JSON array
        status TEXT DEFAULT 'generated',
        user_edits TEXT, -- JSON object
        sent_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Create indexes
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_suggestions_deal ON email_suggestions(deal_id)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_suggestions_person ON email_suggestions(person_id)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_suggestions_status ON email_suggestions(status)`);
    }

    create(data: Omit<EmailSuggestion, 'id' | 'createdAt'>): EmailSuggestion {
        const id = uuidv4();
        const createdAt = new Date();

        const stmt = this.db.prepare(`
      INSERT INTO email_suggestions (
        id, deal_id, person_id, subject_line, body, html_body, 
        email_type, confidence_score, reasoning, quality_score, 
        issues, status, user_edits, sent_at, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            id,
            data.dealId || null,
            data.personId || null,
            data.subjectLine,
            data.body,
            data.htmlBody || null,
            data.emailType,
            data.confidenceScore,
            data.reasoning,
            data.qualityScore,
            JSON.stringify(data.issues),
            data.status,
            data.userEdits || null,
            data.sentAt ? data.sentAt.toISOString() : null,
            createdAt.toISOString()
        );

        return { ...data, id, createdAt };
    }

    findById(id: string): EmailSuggestion | null {
        const stmt = this.db.prepare('SELECT * FROM email_suggestions WHERE id = ?');
        const row = stmt.get(id) as any;
        if (!row) return null;
        return this.mapRowToSuggestion(row);
    }

    findByDealId(dealId: number): EmailSuggestion[] {
        const stmt = this.db.prepare('SELECT * FROM email_suggestions WHERE deal_id = ? ORDER BY created_at DESC');
        const rows = stmt.all(dealId) as any[];
        return rows.map(row => this.mapRowToSuggestion(row));
    }

    findByPersonId(personId: number): EmailSuggestion[] {
        const stmt = this.db.prepare('SELECT * FROM email_suggestions WHERE person_id = ? ORDER BY created_at DESC');
        const rows = stmt.all(personId) as any[];
        return rows.map(row => this.mapRowToSuggestion(row));
    }

    update(id: string, updates: Partial<EmailSuggestion>): boolean {
        const fields: string[] = [];
        const values: any[] = [];

        if (updates.subjectLine !== undefined) { fields.push("subject_line = ?"); values.push(updates.subjectLine); }
        if (updates.body !== undefined) { fields.push("body = ?"); values.push(updates.body); }
        if (updates.htmlBody !== undefined) { fields.push("html_body = ?"); values.push(updates.htmlBody); }
        if (updates.status !== undefined) { fields.push("status = ?"); values.push(updates.status); }
        if (updates.userEdits !== undefined) { fields.push("user_edits = ?"); values.push(updates.userEdits); }
        if (updates.sentAt !== undefined) { fields.push("sent_at = ?"); values.push(updates.sentAt ? updates.sentAt.toISOString() : null); }
        if (updates.qualityScore !== undefined) { fields.push("quality_score = ?"); values.push(updates.qualityScore); }
        if (updates.issues !== undefined) { fields.push("issues = ?"); values.push(JSON.stringify(updates.issues)); }

        if (fields.length === 0) return false;

        const stmt = this.db.prepare(`UPDATE email_suggestions SET ${fields.join(", ")} WHERE id = ?`);
        const result = stmt.run(...values, id);
        return result.changes > 0;
    }

    private mapRowToSuggestion(row: any): EmailSuggestion {
        return {
            id: row.id,
            dealId: row.deal_id,
            personId: row.person_id,
            subjectLine: row.subject_line,
            body: row.body,
            htmlBody: row.html_body,
            emailType: row.email_type,
            confidenceScore: row.confidence_score,
            reasoning: row.reasoning,
            qualityScore: row.quality_score,
            issues: row.issues ? JSON.parse(row.issues) : [],
            status: row.status,
            userEdits: row.user_edits,
            sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
            createdAt: new Date(row.created_at)
        };
    }
}
