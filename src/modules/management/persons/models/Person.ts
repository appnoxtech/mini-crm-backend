import Database from 'better-sqlite3';
import { BaseEntity } from '../../../../shared/types';

export type EmailLabel = 'work' | 'home' | 'other';
export type PhoneType = 'home' | 'work' | 'mobile' | 'other';

export interface PersonEmail {
    email: string;
    label: EmailLabel;
}

export interface PersonPhone {
    number: string;
    type: PhoneType;
}

export interface Person extends BaseEntity {
    firstName: string;
    lastName: string;
    emails: PersonEmail[];
    phones: PersonPhone[];
    organizationId?: number;
    deletedAt?: string;
}

export interface PersonRow {
    id: number;
    firstName: string;
    lastName: string;
    emails: string; // JSON string in DB
    phones: string; // JSON string in DB
    organizationId: number | null;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
}

export interface CreatePersonData {
    firstName: string;
    lastName: string;
    emails: PersonEmail[];
    phones?: PersonPhone[];
    organizationId?: number;
}

export interface UpdatePersonData {
    firstName?: string;
    lastName?: string;
    emails?: PersonEmail[];
    phones?: PersonPhone[];
    organizationId?: number | null;
}

export class PersonModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS persons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        emails TEXT NOT NULL,
        phones TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT
      )
    `);

        // Add missing columns if they don't exist (for existing databases)
        const columnsToAdd = [
            { name: 'organizationId', definition: 'INTEGER' }
        ];

        for (const column of columnsToAdd) {
            try {
                this.db.exec(`ALTER TABLE persons ADD COLUMN ${column.name} ${column.definition}`);
                console.log(`Added ${column.name} column to persons table`);
            } catch (error) {
                // Column already exists, ignore error
            }
        }

        // Create indexes
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_persons_firstName ON persons(firstName)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_persons_lastName ON persons(lastName)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_persons_organizationId ON persons(organizationId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_persons_deletedAt ON persons(deletedAt)');
    }

    private rowToPerson(row: PersonRow): Person {
        return {
            id: row.id,
            firstName: row.firstName,
            lastName: row.lastName,
            emails: JSON.parse(row.emails),
            phones: JSON.parse(row.phones),
            organizationId: row.organizationId || undefined,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            deletedAt: row.deletedAt || undefined
        };
    }

    create(data: CreatePersonData): Person {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO persons (firstName, lastName, emails, phones, organizationId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            data.firstName,
            data.lastName,
            JSON.stringify(data.emails),
            JSON.stringify(data.phones || []),
            data.organizationId || null,
            now,
            now
        );

        const person = this.findById(result.lastInsertRowid as number);
        if (!person) throw new Error('Failed to create person');

        return person;
    }

    searchByPersonName(search: string): Person[] {
        const stmt = this.db.prepare(`
      SELECT * FROM persons WHERE firstName LIKE ? OR lastName LIKE ? OR emails LIKE ? OR phones LIKE ?
    `);
        const rows = stmt.all(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`) as PersonRow[];
        return rows.map(row => this.rowToPerson(row));
    }

    findById(id: number, includeDeleted: boolean = false): Person | undefined {
        let query = 'SELECT * FROM persons WHERE id = ?';
        if (!includeDeleted) {
            query += ' AND deletedAt IS NULL';
        }
        const stmt = this.db.prepare(query);
        const row = stmt.get(id) as PersonRow | undefined;
        return row ? this.rowToPerson(row) : undefined;
    }

    findAll(options: {
        search?: string;
        organizationId?: number;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    } = {}): { persons: Person[]; count: number } {
        let query = 'SELECT * FROM persons WHERE 1=1';
        const params: any[] = [];

        if (!options.includeDeleted) {
            query += ' AND deletedAt IS NULL';
        }

        if (options.organizationId) {
            query += ' AND organizationId = ?';
            params.push(options.organizationId);
        }

        if (options.search) {
            query += ' AND (firstName LIKE ? OR lastName LIKE ? OR emails LIKE ?)';
            const searchTerm = `%${options.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        query += ' ORDER BY createdAt DESC';

        if (options.limit) {
            query += ' LIMIT ? OFFSET ?';
            params.push(options.limit, options.offset || 0);
        }

        const rows = this.db.prepare(query).all(...params) as PersonRow[];
        const persons = rows.map(row => this.rowToPerson(row));

        // Get total count
        let countQuery = 'SELECT COUNT(*) as count FROM persons WHERE 1=1';
        const countParams: any[] = [];

        if (!options.includeDeleted) {
            countQuery += ' AND deletedAt IS NULL';
        }

        if (options.organizationId) {
            countQuery += ' AND organizationId = ?';
            countParams.push(options.organizationId);
        }

        if (options.search) {
            countQuery += ' AND (firstName LIKE ? OR lastName LIKE ? OR emails LIKE ?)';
            const searchTerm = `%${options.search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        const countResult = this.db.prepare(countQuery).get(...countParams) as { count: number };

        return {
            persons,
            count: countResult.count
        };
    }

    async searchPersons(options: {
        search?: string;
        organizationId?: number;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    } = {}): Promise<{ persons: Person[]; count: number }> {
        return this.findAll(options);
    }

    findByorganizationId(organizationId: number, includeDeleted: boolean = false): Person[] {
        let query = 'SELECT * FROM persons WHERE organizationId = ?';
        if (!includeDeleted) {
            query += ' AND deletedAt IS NULL';
        }
        query += ' ORDER BY lastName, firstName';

        const rows = this.db.prepare(query).all(organizationId) as PersonRow[];
        return rows.map(row => this.rowToPerson(row));
    }

    update(id: number, data: UpdatePersonData): Person | null {
        const existing = this.findById(id);
        if (!existing) return null;

        const now = new Date().toISOString();
        const updates: string[] = ['updatedAt = ?'];
        const params: any[] = [now];

        if (data.firstName !== undefined) {
            updates.push('firstName = ?');
            params.push(data.firstName);
        }
        if (data.lastName !== undefined) {
            updates.push('lastName = ?');
            params.push(data.lastName);
        }
        if (data.emails !== undefined) {
            updates.push('emails = ?');
            params.push(JSON.stringify(data.emails));
        }
        if (data.phones !== undefined) {
            updates.push('phones = ?');
            params.push(JSON.stringify(data.phones));
        }
        if (data.organizationId !== undefined) {
            updates.push('organizationId = ?');
            params.push(data.organizationId);
        }

        params.push(id);

        const stmt = this.db.prepare(`
      UPDATE persons SET ${updates.join(', ')} WHERE id = ?
    `);

        stmt.run(...params);

        return this.findById(id) || null;
    }

    softDelete(id: number): boolean {
        const existing = this.findById(id);
        if (!existing) return false;

        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      UPDATE persons SET deletedAt = ?, updatedAt = ? WHERE id = ?
    `);

        const result = stmt.run(now, now, id);
        return result.changes > 0;
    }

    restore(id: number): Person | null {
        const existing = this.findById(id, true);
        if (!existing || !existing.deletedAt) return null;

        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      UPDATE persons SET deletedAt = NULL, updatedAt = ? WHERE id = ?
    `);

        stmt.run(now, id);

        return this.findById(id) || null;
    }

    hardDelete(id: number): boolean {
        const stmt = this.db.prepare('DELETE FROM persons WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
}
