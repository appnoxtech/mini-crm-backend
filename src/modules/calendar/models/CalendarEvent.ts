import Database from 'better-sqlite3';
import { BaseEntity } from '../../../shared/types';

export interface CalendarEvent extends BaseEntity {
    userId: number;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    location?: string;
    isAllDay: boolean;
    deletedAt?: string;
}

export class CalendarEventModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS calendar_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                startTime TEXT NOT NULL,
                endTime TEXT NOT NULL,
                location TEXT,
                isAllDay INTEGER DEFAULT 0,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL,
                deletedAt TEXT,
                FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Create indexes for efficient queries
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_calendar_events_userId ON calendar_events(userId);
            CREATE INDEX IF NOT EXISTS idx_calendar_events_startTime ON calendar_events(startTime);
        `);
    }

    create(data: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>): CalendarEvent {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
            INSERT INTO calendar_events (userId, title, description, startTime, endTime, location, isAllDay, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            data.userId,
            data.title,
            data.description || null,
            data.startTime,
            data.endTime,
            data.location || null,
            data.isAllDay ? 1 : 0,
            now,
            now
        );

        return this.findById(result.lastInsertRowid as number)!;
    }

    findById(id: number, userId?: number): CalendarEvent | null {
        let query = `SELECT * FROM calendar_events WHERE id = ? AND deletedAt IS NULL`;
        const params: any[] = [id];

        if (userId !== undefined) {
            query += ` AND userId = ?`;
            params.push(userId);
        }

        const row = this.db.prepare(query).get(...params) as any;
        return row ? this.mapRow(row) : null;
    }

    findByUserId(userId: number, filters: {
        startDate?: string;
        endDate?: string;
        limit?: number;
        offset?: number;
    } = {}): { events: CalendarEvent[]; total: number } {
        let query = `SELECT * FROM calendar_events WHERE userId = ? AND deletedAt IS NULL`;
        const params: any[] = [userId];

        if (filters.startDate) {
            query += ` AND startTime >= ?`;
            params.push(filters.startDate);
        }

        if (filters.endDate) {
            query += ` AND startTime <= ?`;
            params.push(filters.endDate);
        }

        query += ` ORDER BY startTime ASC`;

        // Get total count
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
        const countResult = this.db.prepare(countQuery).get(...params) as { count: number } | undefined;
        const total = countResult ? countResult.count : 0;

        // Add pagination
        if (filters.limit) {
            query += ` LIMIT ? OFFSET ?`;
            params.push(filters.limit, filters.offset || 0);
        }

        const rows = this.db.prepare(query).all(...params) as any[];
        return {
            events: rows.map(row => this.mapRow(row)),
            total
        };
    }

    findAccessible(userId: number, filters: {
        startDate?: string;
        endDate?: string;
        limit?: number;
        offset?: number;
    } = {}): { events: CalendarEvent[]; total: number } {
        // Find events owned by user OR shared with user
        let query = `
            SELECT DISTINCT e.* FROM calendar_events e
            LEFT JOIN event_shares es ON e.id = es.eventId
            WHERE e.deletedAt IS NULL
            AND (e.userId = ? OR es.sharedWithUserId = ?)
        `;
        const params: any[] = [userId, userId];

        if (filters.startDate) {
            query += ` AND e.startTime >= ?`;
            params.push(filters.startDate);
        }

        if (filters.endDate) {
            query += ` AND e.startTime <= ?`;
            params.push(filters.endDate);
        }

        query += ` ORDER BY e.startTime ASC`;

        // Get total count
        const countQuery = query.replace('SELECT DISTINCT e.*', 'SELECT COUNT(DISTINCT e.id) as count');
        const countResult = this.db.prepare(countQuery).get(...params) as { count: number } | undefined;
        const total = countResult ? countResult.count : 0;

        // Add pagination
        if (filters.limit) {
            query += ` LIMIT ? OFFSET ?`;
            params.push(filters.limit, filters.offset || 0);
        }

        const rows = this.db.prepare(query).all(...params) as any[];
        return {
            events: rows.map(row => this.mapRow(row)),
            total
        };
    }

    findUpcoming(withinMinutes: number): CalendarEvent[] {
        const now = new Date();
        const future = new Date(now.getTime() + withinMinutes * 60 * 1000);

        const rows = this.db.prepare(`
            SELECT * FROM calendar_events
            WHERE deletedAt IS NULL
            AND startTime >= ?
            AND startTime <= ?
            ORDER BY startTime ASC
        `).all(now.toISOString(), future.toISOString()) as any[];

        return rows.map(row => this.mapRow(row));
    }

    update(id: number, userId: number, data: Partial<Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): CalendarEvent | null {
        const existing = this.findById(id, userId);
        if (!existing) return null;

        const updates: string[] = [];
        const params: any[] = [];

        if (data.title !== undefined) {
            updates.push('title = ?');
            params.push(data.title);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            params.push(data.description);
        }
        if (data.startTime !== undefined) {
            updates.push('startTime = ?');
            params.push(data.startTime);
        }
        if (data.endTime !== undefined) {
            updates.push('endTime = ?');
            params.push(data.endTime);
        }
        if (data.location !== undefined) {
            updates.push('location = ?');
            params.push(data.location);
        }
        if (data.isAllDay !== undefined) {
            updates.push('isAllDay = ?');
            params.push(data.isAllDay ? 1 : 0);
        }

        if (updates.length === 0) return existing;

        updates.push('updatedAt = ?');
        params.push(new Date().toISOString());
        params.push(id, userId);

        this.db.prepare(`
            UPDATE calendar_events
            SET ${updates.join(', ')}
            WHERE id = ? AND userId = ? AND deletedAt IS NULL
        `).run(...params);

        return this.findById(id, userId);
    }

    delete(id: number, userId: number): boolean {
        const result = this.db.prepare(`
            UPDATE calendar_events
            SET deletedAt = ?, updatedAt = ?
            WHERE id = ? AND userId = ? AND deletedAt IS NULL
        `).run(new Date().toISOString(), new Date().toISOString(), id, userId);

        return result.changes > 0;
    }

    hardDelete(id: number, userId: number): boolean {
        const result = this.db.prepare(`
            DELETE FROM calendar_events
            WHERE id = ? AND userId = ?
        `).run(id, userId);

        return result.changes > 0;
    }

    private mapRow(row: any): CalendarEvent {
        return {
            id: row.id,
            userId: row.userId,
            title: row.title,
            description: row.description,
            startTime: row.startTime,
            endTime: row.endTime,
            location: row.location,
            isAllDay: Boolean(row.isAllDay),
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            deletedAt: row.deletedAt
        };
    }
}
