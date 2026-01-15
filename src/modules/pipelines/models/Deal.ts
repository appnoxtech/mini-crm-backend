import Database from 'better-sqlite3';
import { BaseEntity } from '../../../shared/types';

export interface Deal extends BaseEntity {
    title: string;
    value: number;
    currency: string;
    pipelineId: number;
    stageId: number;
    personId?: number;
    organizationId?: number;
    email?: { value: string; type: string }[];
    phone?: { value: string; type: string }[];

    description?: string;
    expectedCloseDate?: string;
    actualCloseDate?: string;
    probability: number;
    userId: number;
    assignedTo?: number;
    status: 'open' | 'won' | 'lost' | 'deleted';
    lostReason?: string;
    lastActivityAt?: string;
    isRotten: boolean;
    lavelIds?: number[];
    source?: string;
    labels?: string;
    customFields?: string;
}

export class DealModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        this.db.exec(`
  CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    value REAL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    pipelineId INTEGER NOT NULL,
    stageId INTEGER NOT NULL,
    email TEXT,
    phone TEXT,
    description TEXT,
    expectedCloseDate TEXT,
    actualCloseDate TEXT,
    probability INTEGER DEFAULT 0,
    userId INTEGER NOT NULL,
    assignedTo INTEGER,
    status TEXT DEFAULT 'open',
    lostReason TEXT,
    lastActivityAt TEXT,
    isRotten BOOLEAN DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,

    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (pipelineId) REFERENCES pipelines(id) ON DELETE RESTRICT,
    FOREIGN KEY (stageId) REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
    FOREIGN KEY (assignedTo) REFERENCES users(id) ON DELETE SET NULL
  )
`);

        // Add missing columns if they don't exist (for existing databases)
        const columnsToAdd = [
            { name: 'personId', definition: 'INTEGER' },
            { name: 'organizationId', definition: 'INTEGER' },
            { name: 'source', definition: 'TEXT' },
            { name: 'lavelIds', definition: 'TEXT' },
            { name: 'customFields', definition: 'TEXT' }
        ];

        for (const column of columnsToAdd) {
            try {
                this.db.exec(`ALTER TABLE deals ADD COLUMN ${column.name} ${column.definition}`);
                console.log(`Added ${column.name} column to deals table`);
            } catch (error) {
                // Column already exists, ignore error
            }
        }

        // Add foreign key constraints if columns were just added
        // Note: SQLite doesn't support adding foreign keys to existing tables,
        // so we handle this gracefully

        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_userId ON deals(userId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_pipelineId ON deals(pipelineId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_stageId ON deals(stageId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_expectedCloseDate ON deals(expectedCloseDate)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_personId ON deals(personId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_organizationId ON deals(organizationId)');
    }

    create(data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Deal {
        const now = new Date().toISOString();

        const stmt = this.db.prepare(`
  INSERT INTO deals (
    title, value, currency, pipelineId, stageId,
    personId, organizationId,
    email, phone, description, expectedCloseDate, actualCloseDate, probability,
    userId, assignedTo, status, lostReason, lastActivityAt, isRotten, source,
    lavelIds, customFields, createdAt, updatedAt
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);


        const result = stmt.run(
            data.title,
            data.value,
            data.currency,
            data.pipelineId,
            data.stageId,
            data.personId || null,
            data.organizationId || null,
            data.email ? JSON.stringify(data.email) : null,
            data.phone ? JSON.stringify(data.phone) : null,
            data.description || null,
            data.expectedCloseDate || null,
            data.actualCloseDate || null,
            data.probability,
            data.userId,
            data.assignedTo || null,
            data.status,
            data.lostReason || null,
            data.lastActivityAt || now,
            data.isRotten ? 1 : 0,
            data.source || null,
            data.lavelIds ? JSON.stringify(data.lavelIds) : null,
            data.customFields || null,
            now,
            now
        );

        return this.findById(result.lastInsertRowid as number)!;
    }

    findById(id: number): Deal | undefined {
        const stmt = this.db.prepare('SELECT * FROM deals WHERE id = ?');
        const result = stmt.get(id) as any;
        if (!result) return undefined;

        return {
            ...result,
            isRotten: Boolean(result.isRotten),
            email: result.email ? JSON.parse(result.email) : null,
            phone: result.phone ? JSON.parse(result.phone) : null,
            lavelIds: result.lavelIds ? JSON.parse(result.lavelIds) : null,
        };
    }

    findByUserId(userId: number, filters: {
        pipelineId?: number;
        stageId?: number;
        status?: string;
        search?: string;
        limit?: number;
        offset?: number;
    } = {}): { deals: Deal[]; total: number } {
        let query = 'SELECT * FROM deals WHERE userId = ?';
        const params: any[] = [userId];

        if (filters.pipelineId) {
            query += ' AND pipelineId = ?';
            params.push(filters.pipelineId);
        }

        if (filters.stageId) {
            query += ' AND stageId = ?';
            params.push(filters.stageId);
        }

        if (filters.status) {
            query += ' AND status = ?';
            params.push(filters.status);
        }

        if (filters.search) {
            query += ' AND (title LIKE ? OR personName LIKE ? OR organizationName LIKE ? OR description LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        query += ' ORDER BY createdAt DESC';

        // Get total count
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
        const countResult = this.db.prepare(countQuery).get(...params) as { count: number };

        // Add pagination
        if (filters.limit) {
            query += ' LIMIT ? OFFSET ?';
            params.push(filters.limit, filters.offset || 0);
        }

        const stmt = this.db.prepare(query);
        const results = stmt.all(...params) as any[];

        return {
            deals: results.map(r => ({
                ...r,
                isRotten: Boolean(r.isRotten),
                email: r.email ? JSON.parse(r.email) : null,
                phone: r.phone ? JSON.parse(r.phone) : null,
                lavelIds: r.lavelIds ? JSON.parse(r.lavelIds) : null,
            })),
            total: countResult.count
        };
    }

    update(id: number, userId: number, data: Partial<Omit<Deal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Deal | null {
        const deal = this.findById(id);
        if (!deal || deal.userId !== userId) {
            return null;
        }

        const now = new Date().toISOString();
        const updates: string[] = [];
        const values: any[] = [];

        // Build dynamic update query
        Object.entries(data).forEach(([key, value]) => {
            if (key === 'isRotten') {
                updates.push(`${key} = ?`);
                values.push(value ? 1 : 0);
            }
            else if (key === 'lavelIds' && Array.isArray(value)) {
                updates.push(`${key} = ?`);
                values.push(JSON.stringify(value));
            }
            else if (key === 'email' && typeof value === 'object') {
                updates.push(`${key} = ?`);
                values.push(JSON.stringify(value));
            }
            else if (key === 'phone' && typeof value === 'object') {
                updates.push(`${key} = ?`);
                values.push(JSON.stringify(value));
            }
            else {
                updates.push(`${key} = ?`);
                values.push(value === undefined ? null : value);
            }
        });

        if (updates.length === 0) {
            return deal;
        }

        updates.push('updatedAt = ?');
        values.push(now);
        values.push(id, userId);

        const stmt = this.db.prepare(`
      UPDATE deals 
      SET ${updates.join(', ')}
      WHERE id = ? AND userId = ?
    `);

        stmt.run(...values);
        return this.findById(id) || null;
    }

    delete(id: number, userId: number): boolean {
        const deal = this.findById(id);
        if (!deal || deal.userId !== userId) {
            return false;
        }

        const stmt = this.db.prepare('DELETE FROM deals WHERE id = ? AND userId = ?');
        const result = stmt.run(id, userId);
        return result.changes > 0;
    }

    updateRottenStatus(dealId: number, isRotten: boolean): void {
        this.db.prepare('UPDATE deals SET isRotten = ? WHERE id = ?').run(isRotten ? 1 : 0, dealId);
    }

    getRottenDeals(userId: number, pipelineId?: number): Deal[] {
        let query = `
      SELECT d.*, p.rottenDays, ps.rottenDays as stageRottenDays
      FROM deals d
      JOIN pipelines p ON d.pipelineId = p.id
      JOIN pipeline_stages ps ON d.stageId = ps.id
      WHERE d.userId = ? AND d.status = 'open' AND p.dealRotting = 1
    `;
        const params: any[] = [userId];

        if (pipelineId) {
            query += ' AND d.pipelineId = ?';
            params.push(pipelineId);
        }

        const results = this.db.prepare(query).all(...params) as any[];
        const now = new Date();

        return results
            .filter(deal => {
                if (!deal.lastActivityAt) return false;

                const rottenDays = deal.stageRottenDays || deal.rottenDays;
                const lastActivity = new Date(deal.lastActivityAt);
                const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

                return daysSinceActivity >= rottenDays;
            })
            .map(r => ({
                ...r,
                isRotten: Boolean(r.isRotten)
            }));
    }

    searchDeals(search: string): Deal[] {
        const query = `
      SELECT * FROM deals
      WHERE (title LIKE ? OR personName LIKE ? OR organizationName LIKE ?)
    `;
        const params = [`%${search}%`, `%${search}%`, `%${search}%`];

        const results = this.db.prepare(query).all(...params) as any[];
        return results.map(r => ({
            ...r,
            isRotten: Boolean(r.isRotten)
        }));
    }
}
