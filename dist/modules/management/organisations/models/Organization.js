"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationModel = void 0;
class OrganizationModel {
    db;
    constructor(db) {
        this.db = db;
    }
    initialize() {
        this.db.exec(`
        CREATE TABLE IF NOT EXISTS organizations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            industry TEXT,
            website TEXT,
            status TEXT,
            emails TEXT,
            phones TEXT,
            annualRevenue REAL,
            numberOfEmployees INTEGER,
            linkedinProfile TEXT,
            address TEXT,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            deletedAt TEXT
        )
    `);
        // Add missing columns if they don't exist (for existing databases)
        const columnsToAdd = [
            { name: 'annualRevenue', definition: 'REAL' },
            { name: 'numberOfEmployees', definition: 'INTEGER' },
            { name: 'linkedinProfile', definition: 'TEXT' },
        ];
        for (const column of columnsToAdd) {
            try {
                this.db.exec(`ALTER TABLE organizations ADD COLUMN ${column.name} ${column.definition}`);
                console.log(`Added ${column.name} column to organizations table`);
            }
            catch (error) {
                // Column already exists, ignore error
            }
        }
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_organizations_deletedAt ON organizations(deletedAt)');
        // Ensure 'organisations' (with 's') works as a reference to 'organizations' (with 'z')
        this.db.exec('CREATE VIEW IF NOT EXISTS organisations AS SELECT * FROM organizations');
    }
    create(data) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
        INSERT INTO organizations 
        (name, description, industry, website, status, emails, phones, annualRevenue, numberOfEmployees, linkedinProfile, address, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(data.name, data.description || null, data.industry || null, data.website || null, data.status || null, data.emails ? JSON.stringify(data.emails) : null, data.phones ? JSON.stringify(data.phones) : null, data.annualRevenue || null, data.numberOfEmployees || null, data.linkedinProfile || null, data.address ? JSON.stringify(data.address) : null, now, now);
        return this.findById(result.lastInsertRowid);
    }
    findById(id, includeDeleted = false) {
        let query = 'SELECT * FROM organizations WHERE id = ?';
        if (!includeDeleted)
            query += ' AND deletedAt IS NULL';
        const org = this.db.prepare(query).get(id);
        if (!org)
            return undefined;
        return {
            ...org,
            emails: org.emails ? JSON.parse(org.emails) : [],
            phones: org.phones ? JSON.parse(org.phones) : [],
            address: org.address ? JSON.parse(org.address) : null,
            annualRevenue: org.annualRevenue || null,
            numberOfEmployees: org.numberOfEmployees || null,
            linkedinProfile: org.linkedinProfile || null
        };
    }
    searchByOrgName(search) {
        const stmt = this.db.prepare(`
        SELECT * FROM organizations 
        WHERE name LIKE ? 
        `);
        const rows = stmt.all(`%${search}%`);
        return rows.map((row) => this.findById(row.id));
    }
    searchByOrganizationName(search) {
        const stmt = this.db.prepare(`
        SELECT * FROM organizations 
        WHERE name LIKE ? 
           OR description LIKE ? 
           OR industry LIKE ? 
           OR website LIKE ? 
           OR status LIKE ? 
           OR emails LIKE ? 
           OR phones LIKE ? 
           OR annualRevenue LIKE ? 
           OR numberOfEmployees LIKE ? 
           OR linkedinProfile LIKE ? 
           OR address LIKE ?
    `);
        const rows = stmt.all(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); // cast as any[] because DB returns raw JSON strings
        // Parse JSON fields and remove unwanted fields
        const result = rows.map(org => ({
            id: org.id,
            name: org.name,
            description: org.description,
            industry: org.industry,
            website: org.website,
            status: org.status,
            emails: org.emails ? JSON.parse(org.emails) : [],
            phones: org.phones ? JSON.parse(org.phones) : [],
            address: org.address ? JSON.parse(org.address) : null,
            annualRevenue: org.annualRevenue,
            numberOfEmployees: org.numberOfEmployees,
            linkedinProfile: org.linkedinProfile,
            // remove createdAt, updatedAt, deletedAt
        }));
        return result;
    }
    findAll(options = {}) {
        let query = 'SELECT * FROM organizations WHERE 1=1';
        const params = [];
        if (!options.includeDeleted) {
            query += ' AND deletedAt IS NULL';
        }
        if (options.search) {
            query += ' AND (name LIKE ? OR description LIKE ? OR industry LIKE ? OR website LIKE ? OR status LIKE ? OR emails LIKE ? OR phones LIKE ? OR address LIKE ?)';
            const searchTerm = `%${options.search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }
        query += ' ORDER BY createdAt DESC';
        if (options.limit) {
            query += ' LIMIT ? OFFSET ?';
            params.push(options.limit, options.offset || 0);
        }
        const organizations = this.db.prepare(query).all(...params);
        // Get total count
        let countQuery = 'SELECT COUNT(*) as count FROM organizations WHERE 1=1';
        const countParams = [];
        if (!options.includeDeleted) {
            countQuery += ' AND deletedAt IS NULL';
        }
        if (options.search) {
            countQuery += ' AND (name LIKE ? OR description LIKE ? OR industry LIKE ? OR website LIKE ? OR status LIKE ? OR emails LIKE ? OR phones LIKE ? OR address LIKE ?)';
            const searchTerm = `%${options.search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }
        const countResult = this.db.prepare(countQuery).get(...countParams);
        return {
            organizations: organizations.map((org) => ({
                ...org,
                emails: typeof org.emails === 'string' ? JSON.parse(org.emails) : org.emails,
                phones: typeof org.phones === 'string' ? JSON.parse(org.phones) : org.phones,
                address: typeof org.address === 'string' ? JSON.parse(org.address) : org.address
            })),
            count: countResult.count
        };
    }
    update(id, data) {
        const existing = this.findById(id);
        if (!existing)
            return null;
        const now = new Date().toISOString();
        const updates = ['updatedAt = ?'];
        const params = [now];
        if (data.name !== undefined) {
            updates.push('name = ?');
            params.push(data.name);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            params.push(data.description);
        }
        if (data.industry !== undefined) {
            updates.push('industry = ?');
            params.push(data.industry);
        }
        if (data.website !== undefined) {
            updates.push('website = ?');
            params.push(data.website);
        }
        if (data.status !== undefined) {
            updates.push('status = ?');
            params.push(data.status);
        }
        if (data.emails !== undefined) {
            updates.push('emails = ?');
            params.push(JSON.stringify(data.emails));
        }
        if (data.phones !== undefined) {
            updates.push('phones = ?');
            params.push(JSON.stringify(data.phones));
        }
        if (data.annualRevenue !== undefined) {
            updates.push('annualRevenue = ?');
            params.push(data.annualRevenue);
        }
        if (data.numberOfEmployees !== undefined) {
            updates.push('numberOfEmployees = ?');
            params.push(data.numberOfEmployees);
        }
        if (data.linkedinProfile !== undefined) {
            updates.push('linkedinProfile = ?');
            params.push(data.linkedinProfile);
        }
        if (data.address !== undefined) {
            updates.push('address = ?');
            params.push(JSON.stringify(data.address));
        }
        params.push(id);
        this.db.prepare(`
        UPDATE organizations SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);
        return this.findById(id) ?? null;
    }
    softDelete(id) {
        const existing = this.findById(id);
        if (!existing)
            return false;
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      UPDATE organizations SET deletedAt = ?, updatedAt = ? WHERE id = ?
    `);
        const result = stmt.run(now, now, id);
        return result.changes > 0;
    }
    restore(id) {
        const existing = this.findById(id, true);
        if (!existing || !existing.deletedAt)
            return null;
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      UPDATE organizations SET deletedAt = NULL, updatedAt = ? WHERE id = ?
    `);
        stmt.run(now, id);
        return this.findById(id) || null;
    }
    hardDelete(id) {
        const stmt = this.db.prepare('DELETE FROM organizations WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
}
exports.OrganizationModel = OrganizationModel;
//# sourceMappingURL=Organization.js.map