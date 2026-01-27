import Database from 'better-sqlite3';
import { BaseEntity } from '../../../../shared/types';
import { Organization } from '../../organisations/models/Organization';

export type EmailLabel = 'work' | 'home' | 'other' | 'personal';
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
    organization?: Organization | null;
    country?: string;
    deletedAt?: string;
}

export interface PersonRow {
    id: number;
    firstName: string;
    lastName: string;
    emails: string; // JSON string in DB
    phones: string; // JSON string in DB
    organizationId: number | null;
    country: string | null;
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
    country?: string;
}

export interface UpdatePersonData {
    firstName?: string;
    lastName?: string;
    emails?: PersonEmail[];
    phones?: PersonPhone[];
    organizationId?: number | null;
    country?: string | null;
}

export class PersonModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        // Create table with correct column name and foreign key
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS persons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firstName TEXT NOT NULL,
        lastName TEXT,
        emails TEXT,
        phones TEXT,
        organizationId INTEGER,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT,
        FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE SET NULL
      )
    `);

        // Migration: Add country column if it doesn't exist
        const tableInfo = this.db.prepare("PRAGMA table_info(persons)").all() as any[];
        const hasCountry = tableInfo.some(col => col.name === 'country');
        if (!hasCountry) {
            try {
                this.db.exec('ALTER TABLE persons ADD COLUMN country TEXT');
                console.log('Added country column to persons table');
            } catch (error) {
                console.error('Error adding country column:', error);
            }
        }

        // Create indexes for persons table
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_persons_firstName ON persons(firstName)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_persons_lastName ON persons(lastName)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_persons_organizationId ON persons(organizationId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_persons_deletedAt ON persons(deletedAt)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_persons_country ON persons(country)');

        // Create lookup tables for email and phone uniqueness checks
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS person_emails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            personId INTEGER NOT NULL,
            email TEXT NOT NULL,
            FOREIGN KEY (personId) REFERENCES persons(id) ON DELETE CASCADE
          )
        `);

        this.db.exec(`
          CREATE TABLE IF NOT EXISTS person_phones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            personId INTEGER NOT NULL,
            phone TEXT NOT NULL,
            FOREIGN KEY (personId) REFERENCES persons(id) ON DELETE CASCADE
          )
        `);

        // Unique indexes on lookup tables
        this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_person_emails_unique ON person_emails(email)');
        this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_person_phones_unique ON person_phones(phone)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_person_emails_personId ON person_emails(personId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_person_phones_personId ON person_phones(personId)');
    }

    // Check if any email already exists for another person
    findExistingEmail(emails: string[], excludePersonId?: number): { email: string; personId: number } | undefined {
        for (const email of emails) {
            let query = 'SELECT pe.email, pe.personId FROM person_emails pe JOIN persons p ON pe.personId = p.id WHERE pe.email = ? AND p.deletedAt IS NULL';
            const params: any[] = [email.toLowerCase()];

            if (excludePersonId) {
                query += ' AND pe.personId != ?';
                params.push(excludePersonId);
            }

            const result = this.db.prepare(query).get(...params) as { email: string; personId: number } | undefined;
            if (result) return result;
        }
        return undefined;
    }

    // Check if any phone number already exists for another person
    findExistingPhone(phones: string[], excludePersonId?: number): { phone: string; personId: number } | undefined {
        for (const phone of phones) {
            let query = 'SELECT pp.phone, pp.personId FROM person_phones pp JOIN persons p ON pp.personId = p.id WHERE pp.phone = ? AND p.deletedAt IS NULL';
            const params: any[] = [phone];

            if (excludePersonId) {
                query += ' AND pp.personId != ?';
                params.push(excludePersonId);
            }

            const result = this.db.prepare(query).get(...params) as { phone: string; personId: number } | undefined;
            if (result) return result;
        }
        return undefined;
    }

    // Sync lookup tables when creating/updating a person
    private syncEmailLookup(personId: number, emails: PersonEmail[]): void {
        this.db.prepare('DELETE FROM person_emails WHERE personId = ?').run(personId);
        const insertStmt = this.db.prepare('INSERT INTO person_emails (personId, email) VALUES (?, ?)');
        for (const emailObj of emails) {
            insertStmt.run(personId, emailObj.email.toLowerCase());
        }
    }

    private syncPhoneLookup(personId: number, phones: PersonPhone[]): void {
        this.db.prepare('DELETE FROM person_phones WHERE personId = ?').run(personId);
        const insertStmt = this.db.prepare('INSERT INTO person_phones (personId, phone) VALUES (?, ?)');
        for (const phoneObj of phones) {
            insertStmt.run(personId, phoneObj.number);
        }
    }

    private rowToPerson(row: PersonRow): Person {
        return {
            id: row.id,
            firstName: row.firstName,
            lastName: row.lastName,
            emails: JSON.parse(row.emails),
            phones: JSON.parse(row.phones),
            organizationId: row.organizationId || undefined,
            country: row.country || undefined,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            deletedAt: row.deletedAt || undefined
        };
    }

    create(data: CreatePersonData): Person {
        return this.db.transaction(() => {
            const now = new Date().toISOString();
            const stmt = this.db.prepare(`
                INSERT INTO persons (firstName, lastName, emails, phones, organizationId, country, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const result = stmt.run(
                data.firstName,
                data.lastName || null,
                JSON.stringify(data.emails),
                JSON.stringify(data.phones || []),
                data.organizationId || null,
                data.country || null,
                now,
                now
            );

            const personId = result.lastInsertRowid as number;

            this.syncEmailLookup(personId, data.emails);
            if (data.phones && data.phones.length > 0) {
                this.syncPhoneLookup(personId, data.phones);
            }

            const person = this.findById(personId);
            if (!person) throw new Error('Failed to create person');

            return person;
        })();
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
        return this.db.transaction(() => {
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
            if (data.country !== undefined) {
                updates.push('country = ?');
                params.push(data.country);
            }

            params.push(id);

            const stmt = this.db.prepare(`
                UPDATE persons SET ${updates.join(', ')} WHERE id = ?
            `);

            stmt.run(...params);

            if (data.emails !== undefined) {
                this.syncEmailLookup(id, data.emails);
            }
            if (data.phones !== undefined) {
                this.syncPhoneLookup(id, data.phones);
            }

            return this.findById(id) || null;
        })();
    }

    softDelete(id: number): boolean {
        return this.db.transaction(() => {
            const existing = this.findById(id);
            if (!existing) return false;

            const now = new Date().toISOString();
            const stmt = this.db.prepare(`
                UPDATE persons SET deletedAt = ?, updatedAt = ? WHERE id = ?
            `);

            const result = stmt.run(now, now, id);

            this.db.prepare('DELETE FROM person_emails WHERE personId = ?').run(id);
            this.db.prepare('DELETE FROM person_phones WHERE personId = ?').run(id);

            return result.changes > 0;
        })();
    }

    restore(id: number): Person | null {
        return this.db.transaction(() => {
            const existing = this.findById(id, true);
            if (!existing || !existing.deletedAt) return null;

            const now = new Date().toISOString();
            const stmt = this.db.prepare(`
                UPDATE persons SET deletedAt = NULL, updatedAt = ? WHERE id = ?
            `);

            stmt.run(now, id);

            this.syncEmailLookup(id, existing.emails);
            if (existing.phones && existing.phones.length > 0) {
                this.syncPhoneLookup(id, existing.phones);
            }

            return this.findById(id) || null;
        })();
    }

    hardDelete(id: number): boolean {
        const stmt = this.db.prepare('DELETE FROM persons WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
}
