import Database from 'better-sqlite3';
import { BaseEntity } from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';

export interface Activity extends Omit<BaseEntity, 'id'> {
    id: string; // UUID
    title: string;
    description?: string;
    type: 'call' | 'meeting' | 'task' | 'deadline' | 'email' | 'lunch';
    startAt: string; // ISO8601 UTC
    endAt: string; // ISO8601 UTC
    priority: 'low' | 'medium' | 'high';
    status: 'busy' | 'free';
    isDone: boolean;
    location?: string;
    videoCallLink?: string;
    createdBy: number;
    assignedUserIds: number[]; // Array of user IDs
    assignedUsers?: { id: number; name: string; email: string }[]; // Enriched user data
    createdAt: string;
    updatedAt: string;
}

export class ActivityModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize() {
        this.db.exec(`
        CREATE TABLE IF NOT EXISTS activities (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            type TEXT CHECK(type IN ('call','meeting','task','deadline','email','lunch')) DEFAULT 'meeting',
            startAt TEXT NOT NULL,
            endAt TEXT NOT NULL,
            priority TEXT CHECK(priority IN ('low','medium','high')) DEFAULT 'medium',
            status TEXT CHECK(status IN ('busy','free')) DEFAULT 'busy',
            isDone INTEGER NOT NULL DEFAULT 0,
            location TEXT,
            videoCallLink TEXT,
            createdBy INTEGER NOT NULL,
            assignedUserIds TEXT, -- JSON array of user IDs
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            FOREIGN KEY (createdBy) REFERENCES users(id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_activities_startAt ON activities(startAt);
        CREATE INDEX IF NOT EXISTS idx_activities_endAt ON activities(endAt);
        CREATE INDEX IF NOT EXISTS idx_activities_createdBy ON activities(createdBy);
        `);

        // Migration: Add type column if it doesn't exist
        try {
            this.db.prepare('SELECT type FROM activities LIMIT 1').get();
        } catch (error) {
            console.log('Migrating activities table: adding type column');
            this.db.exec(`ALTER TABLE activities ADD COLUMN type TEXT CHECK(type IN ('call','meeting','task','deadline','email','lunch')) DEFAULT 'meeting'`);
        }
    }

    create(data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>): Activity {
        const now = new Date().toISOString();
        const id = uuidv4();

        const stmt = this.db.prepare(`
        INSERT INTO activities (
            id, title, description, type, startAt, endAt, 
            priority, status, isDone, location, videoCallLink, 
            createdBy, assignedUserIds, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            id,
            data.title,
            data.description || null,
            data.type || 'meeting',
            data.startAt,
            data.endAt,
            data.priority || 'medium',
            data.status || 'busy',
            data.isDone ? 1 : 0,
            data.location || null,
            data.videoCallLink || null,
            data.createdBy,
            JSON.stringify(data.assignedUserIds || []),
            now,
            now
        );

        return this.findById(id)!;
    }

    findById(id: string): Activity | undefined {
        const stmt = this.db.prepare('SELECT * FROM activities WHERE id = ?');
        const result = stmt.get(id) as any;
        if (!result) return undefined;

        return this.formatActivity(result);
    }

    findAll(filters: {
        fromDate?: string;
        toDate?: string;
        status?: 'done' | 'pending' | 'all';
        userId?: number;
        limit?: number;
        offset?: number;
    }): { activities: Activity[], total: number } {
        let query = 'SELECT * FROM activities WHERE 1=1';
        const params: any[] = [];

        if (filters.fromDate) {
            query += ' AND startAt >= ?';
            params.push(filters.fromDate);
        }

        if (filters.toDate) {
            query += ' AND startAt <= ?';
            params.push(filters.toDate);
        }

        if (filters.status === 'done') {
            query += ' AND isDone = 1';
        } else if (filters.status === 'pending') {
            query += ' AND isDone = 0';
        }

        // Logic for user permissions (created by OR assigned to)
        if (filters.userId) {
            // We'll rely on memory filtering for complex JSON array check to be safe with SQLite 
            // but we can filter by createdBy in SQL to reduce result set size
        }

        query += ' ORDER BY startAt ASC';

        const stmt = this.db.prepare(query);
        const results = stmt.all(...params) as any[];

        let activities = results.map(r => this.formatActivity(r));

        if (filters.userId) {
            activities = activities.filter(a =>
                a.createdBy === filters.userId || a.assignedUserIds.includes(filters.userId!)
            );
        }

        const total = activities.length;

        // Apply pagination in memory if filtering was done in memory (safest)
        // Or if we didn't filter in memory, we could have used SQL LIMIT/OFFSET
        // For now, let's just slice the array since we need to filter for assignedUserIds anyway
        if (filters.limit) {
            const start = filters.offset || 0;
            const end = start + filters.limit;
            activities = activities.slice(start, end);
        }

        return { activities, total };
    }

    search(userId: number, query?: string, type?: string): Activity[] {
        let sql = 'SELECT * FROM activities WHERE 1=1';
        const params: any[] = [];

        if (query) {
            sql += ' AND (title LIKE ? OR description LIKE ?)';
            params.push(`%${query}%`, `%${query}%`);
        }

        if (type) {
            sql += ' AND type = ?';
            params.push(type);
        }

        sql += ' ORDER BY startAt DESC';

        const stmt = this.db.prepare(sql);
        const results = stmt.all(...params) as any[];

        // Filter permissions in memory
        return results
            .map(r => this.formatActivity(r))
            .filter(a => a.createdBy === userId || a.assignedUserIds.includes(userId));
    }

    update(id: string, data: Partial<Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>>): Activity | null {
        const activity = this.findById(id);
        if (!activity) return null;

        const now = new Date().toISOString();
        const updates: string[] = [];
        const values: any[] = [];

        Object.entries(data).forEach(([key, value]) => {
            if (key === 'assignedUserIds') {
                updates.push(`${key} = ?`);
                values.push(JSON.stringify(value));
            } else if (key === 'isDone') {
                updates.push(`${key} = ?`);
                values.push(value ? 1 : 0);
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
        UPDATE activities 
        SET ${updates.join(', ')}
        WHERE id = ?
        `);

        stmt.run(...values);

        return this.findById(id) || null;
    }

    delete(id: string): boolean {
        const stmt = this.db.prepare('DELETE FROM activities WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    // Availability check helpers
    findOverlapping(startAt: string, endAt: string, userIds: number[]): Activity[] {
        // Find busy status activities that overlap with the given time range
        // Coverage: 
        // (ActivityStart < RequestEnd) AND (ActivityEnd > RequestStart)

        const query = `
            SELECT * FROM activities 
            WHERE status = 'busy' 
            AND isDone = 0
            AND startAt < ? 
            AND endAt > ?
        `;

        const stmt = this.db.prepare(query);
        const potentialConflicts = stmt.all(endAt, startAt) as any[];

        const activities = potentialConflicts.map(r => this.formatActivity(r));

        // Filter for relevant users
        return activities.filter(activity => {
            const usersInvolved = [activity.createdBy, ...activity.assignedUserIds];
            return userIds.some(uid => usersInvolved.includes(uid));
        });
    }

    private formatActivity(result: any): Activity {
        return {
            ...result,
            isDone: Boolean(result.isDone),
            assignedUserIds: result.assignedUserIds ? JSON.parse(result.assignedUserIds) : []
        };
    }
}
