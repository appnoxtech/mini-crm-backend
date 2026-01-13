import Database from 'better-sqlite3';
import { BaseEntity } from '../../../shared/types';

export interface DealActivity extends BaseEntity {
    dealId: number;
    userId: number;
    type: string;
    subject?: string;
    description?: string;
    dueDate?: string;
    dueTime?: string;
    duration?: number;
    isDone: boolean;
    completedAt?: string;
    emailId?: number;
}

export class DealActivityModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS deal_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dealId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        type TEXT NOT NULL,
        subject TEXT,
        description TEXT,
        dueDate TEXT,
        dueTime TEXT,
        duration INTEGER,
        isDone BOOLEAN DEFAULT 0,
        completedAt TEXT,
        emailId INTEGER,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (dealId) REFERENCES deals(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (emailId) REFERENCES emails(id) ON DELETE SET NULL
      )
    `);

        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deal_activities_dealId ON deal_activities(dealId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deal_activities_userId ON deal_activities(userId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deal_activities_dueDate ON deal_activities(dueDate)');
    }

    create(data: Omit<DealActivity, 'id' | 'createdAt' | 'updatedAt'>): DealActivity {
        const now = new Date().toISOString();

        const stmt = this.db.prepare(`
      INSERT INTO deal_activities (
        dealId, userId, type, subject, description, dueDate, dueTime,
        duration, isDone, completedAt, emailId, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            data.dealId,
            data.userId,
            data.type,
            data.subject || null,
            data.description || null,
            data.dueDate || null,
            data.dueTime || null,
            data.duration || null,
            data.isDone ? 1 : 0,
            data.completedAt || null,
            data.emailId || null,
            now,
            now
        );

        // Update deal's lastActivityAt
        this.db.prepare('UPDATE deals SET lastActivityAt = ? WHERE id = ?').run(now, data.dealId);

        return this.findById(result.lastInsertRowid as number)!;
    }

    findById(id: number): DealActivity | undefined {
        const stmt = this.db.prepare('SELECT * FROM deal_activities WHERE id = ?');
        const result = stmt.get(id) as any;
        if (!result) return undefined;

        return {
            ...result,
            isDone: Boolean(result.isDone)
        };
    }

    findByDealId(dealId: number, filters: {
        type?: string;
        isDone?: boolean;
        limit?: number;
    } = {}): DealActivity[] {
        let query = 'SELECT * FROM deal_activities WHERE dealId = ?';
        const params: any[] = [dealId];

        if (filters.type) {
            query += ' AND type = ?';
            params.push(filters.type);
        }

        if (filters.isDone !== undefined) {
            query += ' AND isDone = ?';
            params.push(filters.isDone ? 1 : 0);
        }

        query += ' ORDER BY dueDate DESC, createdAt DESC';

        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }

        const stmt = this.db.prepare(query);
        const results = stmt.all(...params) as any[];

        return results.map(r => ({
            ...r,
            isDone: Boolean(r.isDone)
        }));
    }

    findByUserId(userId: number, filters: {
        type?: string;
        isDone?: boolean;
        upcoming?: boolean;
        limit?: number;
    } = {}): DealActivity[] {
        let query = 'SELECT * FROM deal_activities WHERE userId = ?';
        const params: any[] = [userId];

        if (filters.type) {
            query += ' AND type = ?';
            params.push(filters.type);
        }

        if (filters.isDone !== undefined) {
            query += ' AND isDone = ?';
            params.push(filters.isDone ? 1 : 0);
        }

        if (filters.upcoming) {
            const today = new Date().toISOString().split('T')[0];
            query += ' AND dueDate >= ? AND isDone = 0';
            params.push(today);
        }

        query += ' ORDER BY dueDate ASC, createdAt DESC';

        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }

        const stmt = this.db.prepare(query);
        const results = stmt.all(...params) as any[];

        return results.map(r => ({
            ...r,
            isDone: Boolean(r.isDone)
        }));
    }

    update(id: number, data: Partial<Omit<DealActivity, 'id' | 'dealId' | 'userId' | 'createdAt' | 'updatedAt'>>): DealActivity | null {
        const activity = this.findById(id);
        if (!activity) {
            return null;
        }

        const now = new Date().toISOString();
        const updates: string[] = [];
        const values: any[] = [];

        Object.entries(data).forEach(([key, value]) => {
            if (key === 'isDone') {
                updates.push(`${key} = ?`);
                values.push(value ? 1 : 0);
            } else {
                updates.push(`${key} = ?`);
                values.push(value === undefined ? null : value);
            }
        });

        if (updates.length === 0) {
            return activity;
        }

        updates.push('updatedAt = ?');
        values.push(now);
        values.push(id);

        const stmt = this.db.prepare(`
      UPDATE deal_activities 
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

        stmt.run(...values);

        // Update deal's lastActivityAt
        this.db.prepare('UPDATE deals SET lastActivityAt = ? WHERE id = ?').run(now, activity.dealId);

        return this.findById(id) || null;
    }

    markAsComplete(id: number): DealActivity | null {
        const now = new Date().toISOString();

        const stmt = this.db.prepare(`
      UPDATE deal_activities 
      SET isDone = 1, completedAt = ?, updatedAt = ?
      WHERE id = ?
    `);

        stmt.run(now, now, id);

        const activity = this.findById(id);
        if (activity) {
            // Update deal's lastActivityAt
            this.db.prepare('UPDATE deals SET lastActivityAt = ? WHERE id = ?').run(now, activity.dealId);
        }

        return activity || null;
    }

    delete(id: number): boolean {
        const stmt = this.db.prepare('DELETE FROM deal_activities WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    getUpcomingActivities(userId: number, days: number = 7): DealActivity[] {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + days);

        const stmt = this.db.prepare(`
      SELECT * FROM deal_activities 
      WHERE userId = ? 
        AND isDone = 0 
        AND dueDate >= ? 
        AND dueDate <= ?
      ORDER BY dueDate ASC, dueTime ASC
    `);

        const results = stmt.all(
            userId,
            today.toISOString().split('T')[0],
            futureDate.toISOString().split('T')[0]
        ) as any[];

        return results.map(r => ({
            ...r,
            isDone: Boolean(r.isDone)
        }));
    }
}
