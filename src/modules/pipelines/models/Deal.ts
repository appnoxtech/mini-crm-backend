import Database from 'better-sqlite3';
import { BaseEntity } from '../../../shared/types';
import { Label } from '../models/Label';

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
    ownerIds?: number[];
    isVisibleToAll?: boolean;

    status: 'OPEN' | 'WON' | 'LOST' | 'DELETED';
    lostReason?: string;
    lastActivityAt?: string;
    isRotten: boolean;
    labelIds?: number[];
    source?: string;
    labels?: string;
    customFields?: string;
    deletedAt?: string; // Soft delete timestamp
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
    deletedAt TEXT,

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
            { name: 'labelIds', definition: 'TEXT' },
            { name: 'customFields', definition: 'TEXT' },
            { name: 'ownerIds', definition: 'TEXT' },
            { name: 'isVisibleToAll', definition: 'BOOLEAN DEFAULT 1' },
            { name: 'deletedAt', definition: 'TEXT' }
        ];

        for (const column of columnsToAdd) {
            try {
                this.db.exec(`ALTER TABLE deals ADD COLUMN ${column.name} ${column.definition}`);
                console.log(`Added ${column.name} column to deals table`);
            } catch (error) {
                // Column already exists, ignore error
            }
        }

        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_userId ON deals(userId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_pipelineId ON deals(pipelineId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_stageId ON deals(stageId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_expectedCloseDate ON deals(expectedCloseDate)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_personId ON deals(personId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_organizationId ON deals(organizationId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_isVisibleToAll ON deals(isVisibleToAll)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_deletedAt ON deals(deletedAt)');
    }

    create(data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Deal {
        const now = new Date().toISOString();

        const stmt = this.db.prepare(`
  INSERT INTO deals (
    title, value, currency, pipelineId, stageId,
    personId, organizationId,
    email, phone, description, expectedCloseDate, actualCloseDate, probability,
    userId, assignedTo, ownerIds, isVisibleToAll, status, lostReason, lastActivityAt, isRotten, source,
    labelIds, customFields, createdAt, updatedAt, deletedAt
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            data.ownerIds ? JSON.stringify(data.ownerIds) : null,
            data.isVisibleToAll ? 1 : 0,
            data.status.toUpperCase(),
            data.lostReason || null,
            data.lastActivityAt || now,
            data.isRotten ? 1 : 0,
            data.source || null,
            data.labelIds ? JSON.stringify(data.labelIds) : null,
            data.customFields || null,
            now,
            now,
            null // deletedAt
        );

        return this.findById(result.lastInsertRowid as number)!;
    }

    // Helper method to check if user can access deal
    private canUserAccessDeal(deal: any, userId: number): boolean {
        if (deal.isVisibleToAll === 1) return true;
        if (deal.userId === userId) return true;

        const ownerIds = deal.ownerIds ? JSON.parse(deal.ownerIds) : [];
        return ownerIds.includes(userId);
    }

    findById(id: number, userId?: number, includeDeleted: boolean = false): Deal | null {
        let query = 'SELECT * FROM deals WHERE id = ?';
        if (!includeDeleted) {
            query += ' AND deletedAt IS NULL';
        }

        const stmt = this.db.prepare(query);
        const result = stmt.get(id) as any;
        if (!result) return null;

        // Check permissions if userId is provided
        if (userId !== undefined && !this.canUserAccessDeal(result, userId)) {
            return null;
        }

        const labelIds = result.labelIds ? JSON.parse(result.labelIds) : [];

        let labels: Label[] = [];
        if (labelIds.length > 0) {
            const placeholders = labelIds.map(() => '?').join(',');
            const labelsStmt = this.db.prepare(
                `SELECT * FROM label WHERE id IN (${placeholders})`
            );
            labels = labelsStmt.all(...labelIds) as Label[];
        }

        return {
            ...result,
            isRotten: Boolean(result.isRotten),
            status: result.status.toUpperCase(),
            email: result.email ? JSON.parse(result.email) : null,
            phone: result.phone ? JSON.parse(result.phone) : null,
            labelIds,
            labels,
            isVisibleToAll: Boolean(result.isVisibleToAll),
            ownerIds: result.ownerIds ? JSON.parse(result.ownerIds) : []
        };
    }

    findByUserId(userId: number, filters: {
        pipelineId?: number;
        stageId?: number;
        status?: string;
        search?: string;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    } = {}): { deals: Deal[]; total: number } {
        let query = `SELECT * FROM deals WHERE (
            isVisibleToAll = 1 
            OR userId = ? 
            OR EXISTS (
                SELECT 1 FROM json_each(ownerIds) 
                WHERE json_each.value = ?
            )
        )`;

        const params: any[] = [userId, userId];

        // Exclude soft deleted by default
        if (!filters.includeDeleted) {
            query += ' AND deletedAt IS NULL';
        }

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
            query += ' AND (title LIKE ? OR description LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm);
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
                status: r.status.toUpperCase(),
                email: r.email ? JSON.parse(r.email) : null,
                phone: r.phone ? JSON.parse(r.phone) : null,
                labelIds: r.labelIds ? JSON.parse(r.labelIds) : null,
                ownerIds: r.ownerIds ? JSON.parse(r.ownerIds) : [],
                isVisibleToAll: Boolean(r.isVisibleToAll)
            })),
            total: countResult.count
        };
    }

    update(
        id: number,
        userId: number,
        data: Partial<Omit<Deal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
    ): Deal | null {
        const deal = this.findById(id, userId);
        if (!deal) return null;

        const now = new Date().toISOString();
        const updates: string[] = [];
        const values: any[] = [];

        Object.entries(data).forEach(([key, value]) => {
            if (value === undefined) return;

            if (key === 'isRotten' || key === 'isVisibleToAll') {
                updates.push(`${key} = ?`);
                values.push(value ? 1 : 0);
            }
            else if ((key === 'labelIds' || key === 'ownerIds') && Array.isArray(value)) {
                updates.push(`${key} = ?`);
                values.push(JSON.stringify(value));
            }
            else if (key === 'status' && typeof value === 'string') {
                updates.push(`${key} = ?`);
                values.push(value.toUpperCase());
            }
            else if ((key === 'email' || key === 'phone') && typeof value === 'object') {
                updates.push(`${key} = ?`);
                values.push(JSON.stringify(value));
            }
            else {
                updates.push(`${key} = ?`);
                values.push(value);
            }
        });

        if (updates.length === 0) {
            return deal;
        }

        updates.push('updatedAt = ?');
        values.push(now);
        values.push(id);

        const stmt = this.db.prepare(`
            UPDATE deals 
            SET ${updates.join(', ')}
            WHERE id = ? AND deletedAt IS NULL
        `);

        stmt.run(...values);
        return this.findById(id, userId);
    }

    // Soft delete
    delete(id: number, userId: number): boolean {
        const deal = this.findById(id, userId);
        if (!deal) return false;

        const now = new Date().toISOString();
        const stmt = this.db.prepare('UPDATE deals SET deletedAt = ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL');
        const result = stmt.run(now, now, id);
        return result.changes > 0;
    }

    // Hard delete (permanent)
    hardDelete(id: number, userId: number): boolean {
        const deal = this.findById(id, userId, true);
        if (!deal) return false;

        // Check permissions
        if (!this.canUserAccessDeal(deal, userId)) {
            return false;
        }

        const stmt = this.db.prepare('DELETE FROM deals WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    // Restore soft deleted deal
    restore(id: number, userId: number): Deal | null {
        const deal = this.findById(id, userId, true);
        if (!deal || !deal.deletedAt) return null;

        const now = new Date().toISOString();
        const stmt = this.db.prepare('UPDATE deals SET deletedAt = NULL, updatedAt = ? WHERE id = ?');
        stmt.run(now, id);
        return this.findById(id, userId);
    }

    // Get all deleted deals
    getDeletedDeals(userId: number, filters: {
        limit?: number;
        offset?: number;
    } = {}): { deals: Deal[]; total: number } {
        let query = `SELECT * FROM deals WHERE deletedAt IS NOT NULL AND (
            isVisibleToAll = 1 
            OR userId = ? 
            OR EXISTS (
                SELECT 1 FROM json_each(ownerIds) 
                WHERE json_each.value = ?
            )
        )`;

        const params: any[] = [userId, userId];

        query += ' ORDER BY deletedAt DESC';

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
                status: r.status.toUpperCase(),
                email: r.email ? JSON.parse(r.email) : null,
                phone: r.phone ? JSON.parse(r.phone) : null,
                labelIds: r.labelIds ? JSON.parse(r.labelIds) : null,
                ownerIds: r.ownerIds ? JSON.parse(r.ownerIds) : [],
                isVisibleToAll: Boolean(r.isVisibleToAll)
            })),
            total: countResult.count
        };
    }

    updateRottenStatus(dealId: number, isRotten: boolean): void {
        this.db.prepare('UPDATE deals SET isRotten = ? WHERE id = ? AND deletedAt IS NULL').run(isRotten ? 1 : 0, dealId);
    }

    getRottenDeals(userId: number, pipelineId?: number): Deal[] {
        let query = `
            SELECT d.*, p.rottenDays, ps.rottenDays as stageRottenDays
            FROM deals d
            JOIN pipelines p ON d.pipelineId = p.id
            JOIN pipeline_stages ps ON d.stageId = ps.id
            WHERE d.deletedAt IS NULL
            AND (d.isVisibleToAll = 1 OR d.userId = ?) 
            AND d.status = 'OPEN' 
            AND p.dealRotting = 1
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
                if (!this.canUserAccessDeal(deal, userId)) return false;
                if (!deal.lastActivityAt) return false;

                const rottenDays = deal.stageRottenDays || deal.rottenDays;
                const lastActivity = new Date(deal.lastActivityAt);
                const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

                return daysSinceActivity >= rottenDays;
            })
            .map(r => ({
                ...r,
                isRotten: Boolean(r.isRotten),
                ownerIds: r.ownerIds ? JSON.parse(r.ownerIds) : [],
                isVisibleToAll: Boolean(r.isVisibleToAll)
            }));
    }

    searchDeals(userId: number, search: string, includeDeleted: boolean = false): Deal[] {
        let query = `
            SELECT * FROM deals
            WHERE (title LIKE ? OR description LIKE ? OR source LIKE ?)
            AND (isVisibleToAll = 1 OR userId = ?)
        `;

        if (!includeDeleted) {
            query += ' AND deletedAt IS NULL';
        }

        const params = [`%${search}%`, `%${search}%`, `%${search}%`, userId];

        const results = this.db.prepare(query).all(...params) as any[];

        return results
            .filter(deal => this.canUserAccessDeal(deal, userId))
            .map(r => ({
                ...r,
                isRotten: Boolean(r.isRotten),
                status: r.status.toUpperCase(),
                email: r.email ? JSON.parse(r.email) : null,
                phone: r.phone ? JSON.parse(r.phone) : null,
                labelIds: r.labelIds ? JSON.parse(r.labelIds) : null,
                ownerIds: r.ownerIds ? JSON.parse(r.ownerIds) : [],
                isVisibleToAll: Boolean(r.isVisibleToAll)
            }));
    }

    makeDealAsWon(dealId: number): Deal | null {
        this.db.prepare('UPDATE deals SET status = ? WHERE id = ? AND deletedAt IS NULL').run('WON', dealId);
        return this.findById(dealId);
    }

    makeDealAsLost(
        dealId: number,
        info: { reason?: string; comment?: string }
    ): Deal | null {
        const customFields = JSON.stringify(info);

        this.db.prepare(
            `UPDATE deals 
             SET status = ?, customFields = ?, updatedAt = ? 
             WHERE id = ? AND deletedAt IS NULL`
        ).run(
            'LOST',
            customFields,
            new Date().toISOString(),
            dealId
        );

        return this.findById(dealId);
    }

    resetDeal(dealId: number): Deal | null {
        this.db.prepare(
            'UPDATE deals SET status = ?, lostReason = ?, customFields = ? WHERE id = ? AND deletedAt IS NULL'
        ).run('OPEN', null, null, dealId);

        return this.findById(dealId);
    }

    removeLabelFromDeal(dealId: number, labelId: number): Deal | null {
        const deal = this.findById(dealId);
        if (!deal) return null;

        const labelIds = deal.labelIds || [];
        const updatedLabelIds = labelIds.filter(id => id !== labelId);

        this.db.prepare(
            'UPDATE deals SET labelIds = ? WHERE id = ? AND deletedAt IS NULL'
        ).run(JSON.stringify(updatedLabelIds), dealId);

        return this.findById(dealId);
    }
}