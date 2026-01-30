import Database from 'better-sqlite3';

export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface EventNotification {
    id: number;
    eventId: number;
    reminderId: number;
    userId: number;
    userType: 'user' | 'person';
    scheduledAt: string;
    status: NotificationStatus;
    inAppSentAt?: string;
    emailSentAt?: string;
    failureReason?: string;
    createdAt: string;
    updatedAt: string;
}

export class EventNotificationModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        const tableInfo = this.db.prepare("PRAGMA table_info(event_notifications)").all() as any[];
        const hasUserType = tableInfo.some(col => col.name === 'userType');

        if (!hasUserType) {
            console.log('Migrating event_notifications to add userType and remove strict FK...');
            this.db.transaction(() => {
                this.db.exec(`
                    CREATE TABLE event_notifications_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        eventId INTEGER NOT NULL,
                        reminderId INTEGER NOT NULL,
                        userId INTEGER NOT NULL,
                        userType TEXT NOT NULL DEFAULT 'user',
                        scheduledAt TEXT NOT NULL,
                        status TEXT DEFAULT 'pending',
                        inAppSentAt TEXT,
                        emailSentAt TEXT,
                        failureReason TEXT,
                        createdAt TEXT NOT NULL,
                        updatedAt TEXT NOT NULL,
                        FOREIGN KEY (eventId) REFERENCES calendar_events(id) ON DELETE CASCADE,
                        FOREIGN KEY (reminderId) REFERENCES event_reminders(id) ON DELETE CASCADE,
                        UNIQUE(eventId, reminderId, userId, userType)
                    )
                `);

                this.db.exec(`
                    INSERT INTO event_notifications_new (id, eventId, reminderId, userId, scheduledAt, status, inAppSentAt, emailSentAt, failureReason, createdAt, updatedAt)
                    SELECT id, eventId, reminderId, userId, scheduledAt, status, inAppSentAt, emailSentAt, failureReason, createdAt, updatedAt FROM event_notifications
                `);

                this.db.exec(`DROP TABLE event_notifications`);
                this.db.exec(`ALTER TABLE event_notifications_new RENAME TO event_notifications`);
            })();
        }

        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_event_notifications_scheduledAt ON event_notifications(scheduledAt);
            CREATE INDEX IF NOT EXISTS idx_event_notifications_status ON event_notifications(status);
            CREATE INDEX IF NOT EXISTS idx_event_notifications_userId ON event_notifications(userId, userType);
        `);
    }

    create(data: {
        eventId: number;
        reminderId: number;
        userId: number;
        userType?: 'user' | 'person';
        scheduledAt: string;
    }): EventNotification | null {
        try {
            const now = new Date().toISOString();
            const userType = data.userType || 'user';
            const stmt = this.db.prepare(`
                INSERT INTO event_notifications (eventId, reminderId, userId, userType, scheduledAt, status, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
            `);

            const result = stmt.run(
                data.eventId,
                data.reminderId,
                data.userId,
                userType,
                data.scheduledAt,
                now,
                now
            );

            return this.findById(result.lastInsertRowid as number);
        } catch (error: any) {
            // UNIQUE constraint violation - notification already exists
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return null;
            }
            throw error;
        }
    }

    findById(id: number): EventNotification | null {
        const row = this.db.prepare(`SELECT * FROM event_notifications WHERE id = ?`).get(id) as any;
        return row ? this.mapRow(row) : null;
    }

    findPending(beforeTime?: string): EventNotification[] {
        const cutoffTime = beforeTime || new Date().toISOString();
        const rows = this.db.prepare(`
            SELECT * FROM event_notifications
            WHERE status = 'pending'
            AND scheduledAt <= ?
            ORDER BY scheduledAt ASC
        `).all(cutoffTime) as any[];

        return rows.map(row => this.mapRow(row));
    }

    findByUserId(userId: number, filters: {
        status?: NotificationStatus;
        userType?: 'user' | 'person';
        limit?: number;
        offset?: number;
    } = {}): { notifications: EventNotification[]; total: number } {
        let query = `SELECT * FROM event_notifications WHERE userId = ?`;
        const params: any[] = [userId];

        if (filters.userType) {
            query += ` AND userType = ?`;
            params.push(filters.userType);
        }

        if (filters.status) {
            query += ` AND status = ?`;
            params.push(filters.status);
        }

        query += ` ORDER BY scheduledAt DESC`;

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
            notifications: rows.map(row => this.mapRow(row)),
            total
        };
    }

    findAll(filters: {
        status?: NotificationStatus;
        userId?: number;
        userType?: 'user' | 'person';
        limit?: number;
        offset?: number;
    } = {}): { notifications: EventNotification[]; total: number } {
        let query = `SELECT * FROM event_notifications WHERE 1=1`;
        const params: any[] = [];

        if (filters.status) {
            query += ` AND status = ?`;
            params.push(filters.status);
        }

        if (filters.userId) {
            query += ` AND userId = ?`;
            params.push(filters.userId);
        }

        if (filters.userType) {
            query += ` AND userType = ?`;
            params.push(filters.userType);
        }

        query += ` ORDER BY scheduledAt DESC`;

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
            notifications: rows.map(row => this.mapRow(row)),
            total
        };
    }

    markSent(id: number, channel: 'inApp' | 'email'): boolean {
        const now = new Date().toISOString();
        const column = channel === 'inApp' ? 'inAppSentAt' : 'emailSentAt';

        this.db.prepare(`
            UPDATE event_notifications
            SET ${column} = ?, updatedAt = ?
            WHERE id = ?
        `).run(now, now, id);

        // Check if both channels are sent, then mark as sent
        const notification = this.findById(id);
        if (notification && notification.inAppSentAt && notification.emailSentAt) {
            this.db.prepare(`
                UPDATE event_notifications
                SET status = 'sent', updatedAt = ?
                WHERE id = ?
            `).run(now, id);
        }

        return true;
    }

    markFailed(id: number, reason: string): boolean {
        const now = new Date().toISOString();
        const result = this.db.prepare(`
            UPDATE event_notifications
            SET status = 'failed', failureReason = ?, updatedAt = ?
            WHERE id = ?
        `).run(reason, now, id);

        return result.changes > 0;
    }

    deleteByEventId(eventId: number): boolean {
        const result = this.db.prepare(`DELETE FROM event_notifications WHERE eventId = ?`).run(eventId);
        return result.changes > 0;
    }

    deleteByReminderId(reminderId: number): boolean {
        const result = this.db.prepare(`DELETE FROM event_notifications WHERE reminderId = ?`).run(reminderId);
        return result.changes > 0;
    }

    private mapRow(row: any): EventNotification {
        return {
            id: row.id,
            eventId: row.eventId,
            reminderId: row.reminderId,
            userId: row.userId,
            userType: row.userType as 'user' | 'person',
            scheduledAt: row.scheduledAt,
            status: row.status as NotificationStatus,
            inAppSentAt: row.inAppSentAt,
            emailSentAt: row.emailSentAt,
            failureReason: row.failureReason,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        };
    }
}
