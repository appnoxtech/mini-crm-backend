import Database from "better-sqlite3";

export interface KnowledgeBaseItem {
    id: number;
    category: string;
    topic: string;
    content: string;
    keywords: string[]; // Stored as JSON string in DB
    updatedAt: Date;
}

export class KnowledgeBaseModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS knowledge_base (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                topic TEXT NOT NULL,
                content TEXT NOT NULL,
                keywords TEXT, -- JSON array of strings
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Seed initial data if empty
        const count = this.db.prepare('SELECT COUNT(*) as count FROM knowledge_base').get() as { count: number };
        if (count.count === 0) {
            this.addToKnowledgeBase('Company Info', 'Office Address', '123 Innovation Way, Tech City, TC 90210', ['address', 'location', 'where']);
            this.addToKnowledgeBase('Pricing', 'Standard Plan', 'Our Standard Plan is $49/month and includes 5 users.', ['price', 'cost', 'how much', 'standard plan']);
            this.addToKnowledgeBase('Policies', 'Refund Policy', 'We offer a full refund within 30 days of purchase, no questions asked.', ['refund', 'money back', 'guarantee']);
        }
    }

    addToKnowledgeBase(category: string, topic: string, content: string, keywords: string[]): number | bigint {
        const stmt = this.db.prepare(`
            INSERT INTO knowledge_base (category, topic, content, keywords, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        const info = stmt.run(category, topic, content, JSON.stringify(keywords), new Date().toISOString());
        return info.lastInsertRowid;
    }

    getAll(): KnowledgeBaseItem[] {
        const rows = this.db.prepare('SELECT * FROM knowledge_base ORDER BY category, topic').all();
        return rows.map((row: any) => ({
            id: row.id,
            category: row.category,
            topic: row.topic,
            content: row.content,
            keywords: JSON.parse(row.keywords || '[]'),
            updatedAt: new Date(row.updated_at)
        }));
    }

    // Naive keyword match - in a real app, use vector search or FTS
    findRelevantContext(queryText: string): string[] {
        const items = this.getAll();
        const relevantContent: string[] = [];
        const lowerQuery = queryText.toLowerCase();

        for (const item of items) {
            // Check if any keyword matches
            const hit = item.keywords.some(k => lowerQuery.includes(k.toLowerCase()));
            if (hit) {
                relevantContent.push(`${item.category} - ${item.topic}: ${item.content}`);
            }
        }
        return relevantContent;
    }
    update(id: number, updates: Partial<Omit<KnowledgeBaseItem, 'id' | 'updatedAt'>>): boolean {
        const fields: string[] = [];
        const values: any[] = [];

        if (updates.category !== undefined) { fields.push("category = ?"); values.push(updates.category); }
        if (updates.topic !== undefined) { fields.push("topic = ?"); values.push(updates.topic); }
        if (updates.content !== undefined) { fields.push("content = ?"); values.push(updates.content); }
        if (updates.keywords !== undefined) { fields.push("keywords = ?"); values.push(JSON.stringify(updates.keywords)); }

        if (fields.length === 0) return false;

        fields.push("updated_at = ?");
        values.push(new Date().toISOString());
        values.push(id);

        const stmt = this.db.prepare(`UPDATE knowledge_base SET ${fields.join(", ")} WHERE id = ?`);
        const result = stmt.run(...values);
        return result.changes > 0;
    }

    delete(id: number): boolean {
        const stmt = this.db.prepare('DELETE FROM knowledge_base WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
}
