"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonModel = void 0;
class PersonModel {
    db;
    constructor(db) {
        this.db = db;
    }
    initialize() {
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
        // Create lookup tables for emails and phones
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
        // Migration: If the table was created with organizationId (with 's'), 
        // we need to add organizationId (with 'z') if it doesn't exist.
        // Also, the old foreign key might be causing issues.
        const tableInfo = this.db.prepare("PRAGMA table_info(persons)").all();
        const hasZ = tableInfo.some(col => col.name === 'organizationId');
        if (!hasZ) {
            try {
                this.db.exec('ALTER TABLE persons ADD COLUMN organizationId INTEGER');
                this.db.exec('UPDATE persons SET organizationId = organizationId');
                console.log('Migrated organizationId to organizationId in persons table');
            }
            catch (error) {
                console.error('Error during persons table migration:', error);
            }
        }
        // Create indexes for persons table
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_persons_firstName ON persons(firstName)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_persons_lastName ON persons(lastName)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_persons_organizationId ON persons(organizationId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_persons_deletedAt ON persons(deletedAt)');
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
    findExistingEmail(emails, excludePersonId) {
        for (const email of emails) {
            let query = 'SELECT pe.email, pe.personId FROM person_emails pe JOIN persons p ON pe.personId = p.id WHERE pe.email = ? AND p.deletedAt IS NULL';
            const params = [email.toLowerCase()];
            if (excludePersonId) {
                query += ' AND pe.personId != ?';
                params.push(excludePersonId);
            }
            const result = this.db.prepare(query).get(...params);
            if (result)
                return result;
        }
        return undefined;
    }
    // Check if any phone number already exists for another person
    findExistingPhone(phones, excludePersonId) {
        for (const phone of phones) {
            let query = 'SELECT pp.phone, pp.personId FROM person_phones pp JOIN persons p ON pp.personId = p.id WHERE pp.phone = ? AND p.deletedAt IS NULL';
            const params = [phone];
            if (excludePersonId) {
                query += ' AND pp.personId != ?';
                params.push(excludePersonId);
            }
            const result = this.db.prepare(query).get(...params);
            if (result)
                return result;
        }
        return undefined;
    }
    // Sync lookup tables when creating/updating a person
    syncEmailLookup(personId, emails) {
        // Delete existing emails for this person
        this.db.prepare('DELETE FROM person_emails WHERE personId = ?').run(personId);
        // Insert new emails
        const insertStmt = this.db.prepare('INSERT INTO person_emails (personId, email) VALUES (?, ?)');
        for (const emailObj of emails) {
            insertStmt.run(personId, emailObj.email.toLowerCase());
        }
    }
    syncPhoneLookup(personId, phones) {
        // Delete existing phones for this person
        this.db.prepare('DELETE FROM person_phones WHERE personId = ?').run(personId);
        // Insert new phones
        const insertStmt = this.db.prepare('INSERT INTO person_phones (personId, phone) VALUES (?, ?)');
        for (const phoneObj of phones) {
            insertStmt.run(personId, phoneObj.number);
        }
    }
    rowToPerson(row) {
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
    create(data) {
        return this.db.transaction(() => {
            const now = new Date().toISOString();
            const stmt = this.db.prepare(`
                INSERT INTO persons (firstName, lastName, emails, phones, organizationId, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            const result = stmt.run(data.firstName, data.lastName || null, JSON.stringify(data.emails), JSON.stringify(data.phones || []), data.organizationId || null, now, now);
            const personId = result.lastInsertRowid;
            // Sync lookup tables
            this.syncEmailLookup(personId, data.emails);
            if (data.phones && data.phones.length > 0) {
                this.syncPhoneLookup(personId, data.phones);
            }
            const person = this.findById(personId);
            if (!person)
                throw new Error('Failed to create person');
            return person;
        })();
    }
    searchByPersonName(search) {
        const stmt = this.db.prepare(`
      SELECT * FROM persons WHERE firstName LIKE ? OR lastName LIKE ? OR emails LIKE ? OR phones LIKE ?
    `);
        const rows = stmt.all(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        return rows.map(row => this.rowToPerson(row));
    }
    findById(id, includeDeleted = false) {
        let query = 'SELECT * FROM persons WHERE id = ?';
        if (!includeDeleted) {
            query += ' AND deletedAt IS NULL';
        }
        const stmt = this.db.prepare(query);
        const row = stmt.get(id);
        return row ? this.rowToPerson(row) : undefined;
    }
    findAll(options = {}) {
        let query = 'SELECT * FROM persons WHERE 1=1';
        const params = [];
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
        const rows = this.db.prepare(query).all(...params);
        const persons = rows.map(row => this.rowToPerson(row));
        // Get total count
        let countQuery = 'SELECT COUNT(*) as count FROM persons WHERE 1=1';
        const countParams = [];
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
        const countResult = this.db.prepare(countQuery).get(...countParams);
        return {
            persons,
            count: countResult.count
        };
    }
    findByorganizationId(organizationId, includeDeleted = false) {
        let query = 'SELECT * FROM persons WHERE organizationId = ?';
        if (!includeDeleted) {
            query += ' AND deletedAt IS NULL';
        }
        query += ' ORDER BY lastName, firstName';
        const rows = this.db.prepare(query).all(organizationId);
        return rows.map(row => this.rowToPerson(row));
    }
    update(id, data) {
        return this.db.transaction(() => {
            const existing = this.findById(id);
            if (!existing)
                return null;
            const now = new Date().toISOString();
            const updates = ['updatedAt = ?'];
            const params = [now];
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
            // Sync lookup tables if emails or phones were updated
            if (data.emails !== undefined) {
                this.syncEmailLookup(id, data.emails);
            }
            if (data.phones !== undefined) {
                this.syncPhoneLookup(id, data.phones);
            }
            return this.findById(id) || null;
        })();
    }
    softDelete(id) {
        return this.db.transaction(() => {
            const existing = this.findById(id);
            if (!existing)
                return false;
            const now = new Date().toISOString();
            const stmt = this.db.prepare(`
                UPDATE persons SET deletedAt = ?, updatedAt = ? WHERE id = ?
            `);
            const result = stmt.run(now, now, id);
            // Clear lookup tables to free up emails/phones for reuse
            this.db.prepare('DELETE FROM person_emails WHERE personId = ?').run(id);
            this.db.prepare('DELETE FROM person_phones WHERE personId = ?').run(id);
            return result.changes > 0;
        })();
    }
    restore(id) {
        return this.db.transaction(() => {
            const existing = this.findById(id, true);
            if (!existing || !existing.deletedAt)
                return null;
            const now = new Date().toISOString();
            const stmt = this.db.prepare(`
                UPDATE persons SET deletedAt = NULL, updatedAt = ? WHERE id = ?
            `);
            stmt.run(now, id);
            // Re-sync lookup tables with the person's emails/phones
            this.syncEmailLookup(id, existing.emails);
            if (existing.phones && existing.phones.length > 0) {
                this.syncPhoneLookup(id, existing.phones);
            }
            return this.findById(id) || null;
        })();
    }
    hardDelete(id) {
        // Lookup tables are automatically cleaned up via CASCADE
        const stmt = this.db.prepare('DELETE FROM persons WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
}
exports.PersonModel = PersonModel;
//# sourceMappingURL=Person.js.map