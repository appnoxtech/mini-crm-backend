import Database from 'better-sqlite3';
import { BaseEntity } from '../../../shared/types';

export interface DealActivity extends BaseEntity {
    dealId: number;
    userId: number;
    activityType: string;

    subject?: string;

    label?: string;

    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;

    priority?: 'low' | 'medium' | 'high' | "none";
    busyFree?: 'busy' | 'free' | 'notSet';

    note?: string;
    organization?: string;

    email?: {
        from: string;
        to: string[];
        subject: string;
        body: string;
    }

    files?: {
        url: string;

    }[],

    participants?: {
        id: number;
        name: string;
        email?: string;
        phone?: string;
    }[];

    deal?: {
        name?: string;
        value?: string;
    };

    persons?: {
        id?: number;
        name?: string;
        email?: string;
        phone?: string;
    }[];

    mataData?: {
        key?: string;
        value?: string;
        type?: string;
    }[];

    isDone: boolean;
    completedAt?: string;
}

export class DealActivityModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize() {
        this.db.exec(`
        CREATE TABLE IF NOT EXISTS deal_activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dealId INTEGER NOT NULL,
            userId INTEGER NOT NULL,
            activityType TEXT NOT NULL,
            subject TEXT,
            label TEXT,
            startDate TEXT,
            endDate TEXT,
            startTime TEXT,
            endTime TEXT,
            priority TEXT CHECK(priority IN ('low','medium','high')),
            busyFree TEXT CHECK(busyFree IN ('busy','free','notSet')),
            note TEXT,
            organization TEXT,
            email TEXT,
            files TEXT,
            participants TEXT,   -- store JSON string
            deal TEXT,           -- store JSON string
            persons TEXT,        -- store JSON string
            mataData TEXT,       -- store JSON string
            isDone INTEGER NOT NULL DEFAULT 0,
            completedAt TEXT,
            createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);
    }

    create(data: Omit<DealActivity, 'id' | 'createdAt' | 'updatedAt'>): DealActivity {
        const now = new Date().toISOString();

        const stmt = this.db.prepare(`
        INSERT INTO deal_activities (
            dealId, userId, activityType, subject, label,
            startDate, endDate, startTime, endTime,
            priority, busyFree, note, organization,
            email, files, participants, deal, persons, mataData,
            isDone, completedAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            data.dealId,
            data.userId,
            data.activityType,
            data.subject || null,
            data.label || null,
            data.startDate || null,
            data.endDate || null,
            data.startTime || null,
            data.endTime || null,
            data.priority || null,
            data.busyFree || null,
            data.note || null,
            data.organization || null,
            data.email ? JSON.stringify(data.email) : null,
            data.files ? JSON.stringify(data.files) : null,
            data.participants ? JSON.stringify(data.participants) : null,
            data.deal ? JSON.stringify(data.deal) : null,
            data.persons ? JSON.stringify(data.persons) : null,
            data.mataData ? JSON.stringify(data.mataData) : null,
            data.isDone ? 1 : 0,
            data.completedAt || null,
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
            isDone: Boolean(result.isDone),
            participants: result.participants ? JSON.parse(result.participants) : [],
            deal: result.deal ? JSON.parse(result.deal) : {},
            persons: result.persons ? JSON.parse(result.persons) : [],
            mataData: result.mataData ? JSON.parse(result.mataData) : []
        };
    }

    findByDealId(dealId: number, filters: {
        activityType?: string;
        isDone?: boolean;
        limit?: number;
    } = {}): DealActivity[] {
        let query = 'SELECT * FROM deal_activities WHERE dealId = ?';
        const params: any[] = [dealId];

        if (filters.activityType) {
            query += ' AND activityType = ?';
            params.push(filters.activityType);
        }

        if (filters.isDone !== undefined) {
            query += ' AND isDone = ?';
            params.push(filters.isDone ? 1 : 0);
        }

        query += ' ORDER BY startDate DESC, createdAt DESC';

        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }

        const stmt = this.db.prepare(query);
        const results = stmt.all(...params) as any[];

        return results.map(r => ({
            ...r,
            isDone: Boolean(r.isDone),
            participants: r.participants ? JSON.parse(r.participants) : undefined,
            deal: r.deal ? JSON.parse(r.deal) : undefined,
            persons: r.persons ? JSON.parse(r.persons) : undefined,
            mataData: r.mataData ? JSON.parse(r.mataData) : undefined
        }));
    }

    // create note type activity 
    createNoteActivity(userId: number, dealId: number, note: string): DealActivity {
        return this.create({
            userId,
            dealId,
            activityType: 'note',
            note,
            isDone: false
        });
    }


    createFileActivity(userId: number, dealId: number, files: any[]): DealActivity {
        return this.create({
            userId,
            dealId,
            activityType: 'file',
            files,
            isDone: false
        });
    }





    findByUserId(userId: number, filters: {
        activityType?: string;
        isDone?: boolean;
        upcoming?: boolean;
        limit?: number;
    } = {}): DealActivity[] {
        let query = 'SELECT * FROM deal_activities WHERE userId = ?';
        const params: any[] = [userId];

        if (filters.activityType) {
            query += ' AND activityType = ?';
            params.push(filters.activityType);
        }

        if (filters.isDone !== undefined) {
            query += ' AND isDone = ?';
            params.push(filters.isDone ? 1 : 0);
        }

        if (filters.upcoming) {
            const today = new Date().toISOString().split('T')[0];
            query += ' AND startDate >= ? AND isDone = 0';
            params.push(today);
        }

        query += ' ORDER BY startDate ASC, createdAt DESC';

        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }

        const stmt = this.db.prepare(query);
        const results = stmt.all(...params) as any[];

        return results.map(r => ({
            ...r,
            isDone: Boolean(r.isDone),
            participants: r.participants ? JSON.parse(r.participants) : undefined,
            deal: r.deal ? JSON.parse(r.deal) : undefined,
            persons: r.persons ? JSON.parse(r.persons) : undefined,
            mataData: r.mataData ? JSON.parse(r.mataData) : undefined
        }));
    }

    update(
        id: number,
        data: Partial<Omit<DealActivity, 'id' | 'dealId' | 'userId' | 'createdAt' | 'updatedAt'>>
    ): DealActivity | null {
        const activity = this.findById(id);
        if (!activity) return null;

        const now = new Date().toISOString();
        const updates: string[] = [];
        const values: any[] = [];

        Object.entries(data).forEach(([key, value]) => {
            if (key === 'isDone') {
                updates.push(`${key} = ?`);
                values.push(value ? 1 : 0);
            } else if (['participants', 'deal', 'persons', 'mataData'].includes(key)) {
                updates.push(`${key} = ?`);
                values.push(value ? JSON.stringify(value) : null);
            } else {
                updates.push(`${key} = ?`);
                values.push(value === undefined ? null : value);
            }
        });

        if (updates.length === 0) return activity;

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

    addActivityNote(userId: number, activityId: number, note: string): DealActivity | null {
        const stmt = this.db.prepare(`
        UPDATE deal_activities 
        SET note = ?
        WHERE id = ?
    `);

        stmt.run(note, activityId);

        return this.findById(activityId) || null;
    }

    getUpcomingActivities(userId: number, days: number = 7): DealActivity[] {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + days);

        const stmt = this.db.prepare(`
        SELECT * FROM deal_activities 
        WHERE userId = ? 
          AND isDone = 0 
          AND startDate >= ? 
          AND startDate <= ?
        ORDER BY startDate ASC, startTime ASC
    `);

        const results = stmt.all(
            userId,
            today.toISOString().split('T')[0],
            futureDate.toISOString().split('T')[0]
        ) as any[];

        return results.map(r => ({
            ...r,
            isDone: Boolean(r.isDone),
            participants: r.participants ? JSON.parse(r.participants) : undefined,
            deal: r.deal ? JSON.parse(r.deal) : undefined,
            persons: r.persons ? JSON.parse(r.persons) : undefined,
            mataData: r.mataData ? JSON.parse(r.mataData) : undefined
        }));
    }
}
