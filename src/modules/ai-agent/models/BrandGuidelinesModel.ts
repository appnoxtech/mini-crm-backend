import Database from "better-sqlite3";
import { BrandGuidelines } from "../types";

export class BrandGuidelinesModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS brand_guidelines (
        id TEXT PRIMARY KEY DEFAULT 'default',
        tone TEXT DEFAULT 'professional',
        voice_characteristics TEXT, -- JSON array
        opening_phrases TEXT, -- JSON array
        closing_phrases TEXT, -- JSON array
        signature_template TEXT,
        cta_patterns TEXT, -- JSON array
        avoid_phrases TEXT, -- JSON array
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Ensure default exists
        const existing = this.db.prepare('SELECT id FROM brand_guidelines WHERE id = ?').get('default');
        if (!existing) {
            this.db.prepare(`
        INSERT INTO brand_guidelines (
          id, tone, voice_characteristics, opening_phrases, closing_phrases, signature_template, cta_patterns, avoid_phrases
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
                'default',
                'professional',
                JSON.stringify(['consultative', 'expert', 'reliable']),
                JSON.stringify(['Hope this email finds you well.', 'Following up on our conversation about...']),
                JSON.stringify(['Best regards,', 'Let me know what you think.']),
                'Best,\n[Your Name]',
                JSON.stringify(['Are you available for a quick call next week?', 'What are the next steps on your side?']),
                JSON.stringify(['As per my last email', 'hopefully'])
            );
        }
    }

    getGuidelines(id: string = 'default'): BrandGuidelines | null {
        const row = this.db.prepare('SELECT * FROM brand_guidelines WHERE id = ?').get(id) as any;
        if (!row) return null;

        return {
            id: row.id,
            tone: row.tone,
            voiceCharacteristics: JSON.parse(row.voice_characteristics || '[]'),
            openingPhrases: JSON.parse(row.opening_phrases || '[]'),
            closingPhrases: JSON.parse(row.closing_phrases || '[]'),
            signatureTemplate: row.signature_template,
            ctaPatterns: JSON.parse(row.cta_patterns || '[]'),
            avoidPhrases: JSON.parse(row.avoid_phrases || '[]'),
            updatedAt: new Date(row.updated_at)
        };
    }

    updateGuidelines(id: string = 'default', updates: Partial<BrandGuidelines>): boolean {
        const fields: string[] = [];
        const values: any[] = [];

        if (updates.tone !== undefined) { fields.push("tone = ?"); values.push(updates.tone); }
        if (updates.voiceCharacteristics !== undefined) { fields.push("voice_characteristics = ?"); values.push(JSON.stringify(updates.voiceCharacteristics)); }
        if (updates.openingPhrases !== undefined) { fields.push("opening_phrases = ?"); values.push(JSON.stringify(updates.openingPhrases)); }
        if (updates.closingPhrases !== undefined) { fields.push("closing_phrases = ?"); values.push(JSON.stringify(updates.closingPhrases)); }
        if (updates.signatureTemplate !== undefined) { fields.push("signature_template = ?"); values.push(updates.signatureTemplate); }
        if (updates.ctaPatterns !== undefined) { fields.push("cta_patterns = ?"); values.push(JSON.stringify(updates.ctaPatterns)); }
        if (updates.avoidPhrases !== undefined) { fields.push("avoid_phrases = ?"); values.push(JSON.stringify(updates.avoidPhrases)); }

        if (fields.length === 0) return false;

        fields.push("updated_at = ?");
        values.push(new Date().toISOString());

        const stmt = this.db.prepare(`UPDATE brand_guidelines SET ${fields.join(", ")} WHERE id = ?`);
        const result = stmt.run(...values, id);
        return result.changes > 0;
    }
}
