import Database from 'better-sqlite3';

export interface EventShare {
    id: number;
    eventId: number;
    sharedWithUserId: number;
    participantType: 'user' | 'person';
    createdAt: string;
}

export class EventShareModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        // Check if table exists first
        const tableExists = this.db.prepare(`
            SELECT name FROM sqlite_master WHERE type='table' AND name='event_shares'
        `).get();

        if (!tableExists) {
            // Table doesn't exist - create it fresh
            console.log('Creating event_shares table...');
            this.db.exec(`
                CREATE TABLE event_shares (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    eventId INTEGER NOT NULL,
                    sharedWithUserId INTEGER NOT NULL,
                    participantType TEXT NOT NULL DEFAULT 'user',
                    createdAt TEXT NOT NULL,
                    FOREIGN KEY (eventId) REFERENCES calendar_events(id) ON DELETE CASCADE,
                    UNIQUE(eventId, sharedWithUserId, participantType)
                )
            `);
        } else {
            // Table exists - check if we need to migrate to add participantType
            const tableInfo = this.db.prepare("PRAGMA table_info(event_shares)").all() as any[];
            const hasParticipantType = tableInfo.some(col => col.name === 'participantType');

            if (!hasParticipantType) {
                console.log('Migrating event_shares to add participantType and remove strict FK...');
                // Recreate table to remove strict FK and add new column
                this.db.transaction(() => {
                    this.db.exec(`
                        CREATE TABLE event_shares_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            eventId INTEGER NOT NULL,
                            sharedWithUserId INTEGER NOT NULL,
                            participantType TEXT NOT NULL DEFAULT 'user',
                            createdAt TEXT NOT NULL,
                            FOREIGN KEY (eventId) REFERENCES calendar_events(id) ON DELETE CASCADE,
                            UNIQUE(eventId, sharedWithUserId, participantType)
                        )
                    `);

                    this.db.exec(`
                        INSERT INTO event_shares_new (id, eventId, sharedWithUserId, createdAt)
                        SELECT id, eventId, sharedWithUserId, createdAt FROM event_shares
                    `);

                    this.db.exec(`DROP TABLE event_shares`);
                    this.db.exec(`ALTER TABLE event_shares_new RENAME TO event_shares`);
                })();
            }
        }

        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_event_shares_eventId ON event_shares(eventId);
            CREATE INDEX IF NOT EXISTS idx_event_shares_sharedWithUserId ON event_shares(sharedWithUserId);
            CREATE INDEX IF NOT EXISTS idx_event_shares_participantType ON event_shares(participantType);
        `);
    }

    share(eventId: number, sharedWithUserId: number, participantType: 'user' | 'person' = 'user'): EventShare | null {
        try {
            const now = new Date().toISOString();
            const stmt = this.db.prepare(`
                INSERT INTO event_shares (eventId, sharedWithUserId, participantType, createdAt)
                VALUES (?, ?, ?, ?)
            `);

            const result = stmt.run(eventId, sharedWithUserId, participantType, now);
            return this.findById(result.lastInsertRowid as number);
        } catch (error: any) {
            // UNIQUE constraint violation - already shared
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return this.findByEventAndParticipant(eventId, sharedWithUserId, participantType);
            }
            throw error;
        }
    }

    findById(id: number): EventShare | null {
        const row = this.db.prepare(`SELECT * FROM event_shares WHERE id = ?`).get(id) as any;
        return row ? this.mapRow(row) : null;
    }

    findByEventAndParticipant(eventId: number, sharedWithUserId: number, participantType: string): EventShare | null {
        const row = this.db.prepare(`
            SELECT * FROM event_shares WHERE eventId = ? AND sharedWithUserId = ? AND participantType = ?
        `).get(eventId, sharedWithUserId, participantType) as any;
        return row ? this.mapRow(row) : null;
    }

    findByEventId(eventId: number): EventShare[] {
        const rows = this.db.prepare(`
            SELECT * FROM event_shares WHERE eventId = ?
        `).all(eventId) as any[];

        return rows.map(row => this.mapRow(row));
    }

    findSharedWithUser(userId: number): EventShare[] {
        const rows = this.db.prepare(`
            SELECT * FROM event_shares WHERE sharedWithUserId = ?
        `).all(userId) as any[];

        return rows.map(row => this.mapRow(row));
    }

    getSharedUserIds(eventId: number): number[] {
        const rows = this.db.prepare(`
            SELECT sharedWithUserId FROM event_shares WHERE eventId = ?
        `).all(eventId) as { sharedWithUserId: number }[];

        return rows.map(row => row.sharedWithUserId);
    }

    unshare(eventId: number, sharedWithUserId: number, participantType: string = 'user'): boolean {
        const result = this.db.prepare(`
            DELETE FROM event_shares WHERE eventId = ? AND sharedWithUserId = ? AND participantType = ?
        `).run(eventId, sharedWithUserId, participantType);

        return result.changes > 0;
    }

    unshareAll(eventId: number): boolean {
        const result = this.db.prepare(`DELETE FROM event_shares WHERE eventId = ?`).run(eventId);
        return result.changes > 0;
    }

    isSharedWith(eventId: number, userId: number, type: string = 'user'): boolean {
        const row = this.db.prepare(`
            SELECT 1 FROM event_shares WHERE eventId = ? AND sharedWithUserId = ? AND participantType = ?
        `).get(eventId, userId, type);

        return !!row;
    }

    getSharedUsersDetails(eventId: number): { id: number, name: string, email: string, type: string }[] {
        // Fetch users
        const users = this.db.prepare(`
            SELECT u.id, u.name, u.email, 'user' as type
            FROM event_shares es
            JOIN users u ON es.sharedWithUserId = u.id
            WHERE es.eventId = ? AND es.participantType = 'user'
        `).all(eventId) as any[];

        return users;
    }

    private mapRow(row: any): EventShare {
        return {
            id: row.id,
            eventId: row.eventId,
            sharedWithUserId: row.sharedWithUserId,
            participantType: row.participantType as 'user' | 'person',
            createdAt: row.createdAt
        };
    }
}
