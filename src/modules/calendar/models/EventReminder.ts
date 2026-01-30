import Database from 'better-sqlite3';

export interface EventReminder {
    id: number;
    eventId: number;
    reminderMinutesBefore: number;
    isDefault: boolean;
    createdAt: string;
}

export class EventReminderModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS event_reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                eventId INTEGER NOT NULL,
                reminderMinutesBefore INTEGER NOT NULL,
                isDefault INTEGER DEFAULT 0,
                createdAt TEXT NOT NULL,
                FOREIGN KEY (eventId) REFERENCES calendar_events(id) ON DELETE CASCADE
            )
        `);

        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_event_reminders_eventId ON event_reminders(eventId);
        `);
    }

    create(data: { eventId: number; reminderMinutesBefore: number; isDefault?: boolean }): EventReminder {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
            INSERT INTO event_reminders (eventId, reminderMinutesBefore, isDefault, createdAt)
            VALUES (?, ?, ?, ?)
        `);

        const result = stmt.run(
            data.eventId,
            data.reminderMinutesBefore,
            data.isDefault ? 1 : 0,
            now
        );

        return this.findById(result.lastInsertRowid as number)!;
    }

    findById(id: number): EventReminder | null {
        const row = this.db.prepare(`SELECT * FROM event_reminders WHERE id = ?`).get(id) as any;
        return row ? this.mapRow(row) : null;
    }

    findByEventId(eventId: number): EventReminder[] {
        const rows = this.db.prepare(`
            SELECT * FROM event_reminders
            WHERE eventId = ?
            ORDER BY reminderMinutesBefore ASC
        `).all(eventId) as any[];

        return rows.map(row => this.mapRow(row));
    }

    update(id: number, data: { reminderMinutesBefore?: number }): EventReminder | null {
        const existing = this.findById(id);
        if (!existing) return null;

        if (data.reminderMinutesBefore !== undefined) {
            this.db.prepare(`
                UPDATE event_reminders
                SET reminderMinutesBefore = ?
                WHERE id = ?
            `).run(data.reminderMinutesBefore, id);
        }

        return this.findById(id);
    }

    delete(id: number): boolean {
        const result = this.db.prepare(`DELETE FROM event_reminders WHERE id = ?`).run(id);
        return result.changes > 0;
    }

    deleteByEventId(eventId: number): boolean {
        const result = this.db.prepare(`DELETE FROM event_reminders WHERE eventId = ?`).run(eventId);
        return result.changes > 0;
    }

    deleteDefaultByEventId(eventId: number): boolean {
        const result = this.db.prepare(`
            DELETE FROM event_reminders WHERE eventId = ? AND isDefault = 1
        `).run(eventId);
        return result.changes > 0;
    }

    hasCustomReminders(eventId: number): boolean {
        const row = this.db.prepare(`
            SELECT COUNT(*) as count FROM event_reminders
            WHERE eventId = ? AND isDefault = 0
        `).get(eventId) as { count: number };

        return row.count > 0;
    }

    ensureDefaultReminder(eventId: number, defaultMinutes: number = 30): EventReminder | null {
        // Only add default if no custom reminders exist
        if (this.hasCustomReminders(eventId)) {
            return null;
        }

        // Check if default already exists
        const existing = this.db.prepare(`
            SELECT * FROM event_reminders WHERE eventId = ? AND isDefault = 1
        `).get(eventId) as any;

        if (existing) {
            return this.mapRow(existing);
        }

        return this.create({
            eventId,
            reminderMinutesBefore: defaultMinutes,
            isDefault: true
        });
    }

    private mapRow(row: any): EventReminder {
        return {
            id: row.id,
            eventId: row.eventId,
            reminderMinutesBefore: row.reminderMinutesBefore,
            isDefault: Boolean(row.isDefault),
            createdAt: row.createdAt
        };
    }
}
