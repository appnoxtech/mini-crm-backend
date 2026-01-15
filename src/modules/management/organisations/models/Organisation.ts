import Database from 'better-sqlite3';
import { BaseEntity } from '../../../../shared/types';

export interface Organization extends BaseEntity {
    name: string;
    description?: string;
    industry?: string;
    website?: string;
    status?: 'active' | 'inactive';

    emails?: { value: string; type: string }[];
    phones?: { value: string; type: string }[];

    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        pincode?: string;
    };

    deletedAt?: string;
}

export type searchOrgResult = {
    id: number;
    name: string;
    description: string;
    industry: string;
    website: string;
    status: string;
    emails: string;
    phones: string;
    address: string;
}


export interface CreateOrganizationData {
    name: string;
    description?: string;
    website?: string;
}

export interface UpdateOrganizationData {
    name?: string;
    description?: string;
    website?: string;
}

export class OrganizationModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        this.db.exec(`
        CREATE TABLE IF NOT EXISTS Organizations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            industry TEXT,
            website TEXT,
            status TEXT,
            emails TEXT,
            phones TEXT,
            address TEXT,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            deletedAt TEXT
        )
    `);

        this.db.exec('CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_organizations_deletedAt ON organizations(deletedAt)');
    }


    create(data: CreateOrganizationData & {
        industry?: string;
        status?: string;
        emails?: any[];
        phones?: any[];
        address?: any;
    }): Organization {
        const now = new Date().toISOString();

        const stmt = this.db.prepare(`
        INSERT INTO Organizations 
        (name, description, industry, website, status, emails, phones, address, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            data.name,
            data.description || null,
            data.industry || null,
            data.website || null,
            data.status || null,
            data.emails ? JSON.stringify(data.emails) : null,
            data.phones ? JSON.stringify(data.phones) : null,
            data.address ? JSON.stringify(data.address) : null,
            now,
            now
        );

        return this.findById(result.lastInsertRowid as number)!;
    }


    findById(id: number, includeDeleted = false): Organization | undefined {
        let query = 'SELECT * FROM Organizations WHERE id = ?';
        if (!includeDeleted) query += ' AND deletedAt IS NULL';

        const org = this.db.prepare(query).get(id) as any;
        if (!org) return undefined;

        return {
            ...org,
            emails: org.emails ? JSON.parse(org.emails) : [],
            phones: org.phones ? JSON.parse(org.phones) : [],
            address: org.address ? JSON.parse(org.address) : null
        };
    }

    searchByOrganizationName(search: string): searchOrgResult[] {
        const stmt = this.db.prepare(`
        SELECT * FROM organizations 
        WHERE name LIKE ? 
           OR description LIKE ? 
           OR industry LIKE ? 
           OR website LIKE ? 
           OR status LIKE ? 
           OR emails LIKE ? 
           OR phones LIKE ? 
           OR address LIKE ?
    `);

        const rows = stmt.all(
            `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`,
            `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`
        ) as any[]; // cast as any[] because DB returns raw JSON strings

        // Parse JSON fields and remove unwanted fields
        const result: searchOrgResult[] = rows.map(org => ({
            id: org.id,
            name: org.name,
            description: org.description,
            industry: org.industry,
            website: org.website,
            status: org.status,
            emails: org.emails ? JSON.parse(org.emails) : [],
            phones: org.phones ? JSON.parse(org.phones) : [],
            address: org.address ? JSON.parse(org.address) : null,
            // remove createdAt, updatedAt, deletedAt
        }));

        return result;
    }


    findAll(options: {
        search?: string;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    } = {}): { organizations: Organization[]; count: number } {
        let query = 'SELECT * FROM Organizations WHERE 1=1';
        const params: any[] = [];

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

        const organizations = this.db.prepare(query).all(...params) as Organization[];

        // Get total count
        let countQuery = 'SELECT COUNT(*) as count FROM Organizations WHERE 1=1';
        const countParams: any[] = [];

        if (!options.includeDeleted) {
            countQuery += ' AND deletedAt IS NULL';
        }

        if (options.search) {
            countQuery += ' AND (name LIKE ? OR description LIKE ? OR industry LIKE ? OR website LIKE ? OR status LIKE ? OR emails LIKE ? OR phones LIKE ? OR address LIKE ?)';
            const searchTerm = `%${options.search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        const countResult = this.db.prepare(countQuery).get(...countParams) as { count: number };

        return {
            organizations,
            count: countResult.count
        };
    }

    update(id: number, data: UpdateOrganizationData & any): Organization | null {
        const existing = this.findById(id);
        if (!existing) return null;

        const now = new Date().toISOString();
        const updates: string[] = ['updatedAt = ?'];
        const params: any[] = [now];

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

        if (data.address !== undefined) {
            updates.push('address = ?');
            params.push(JSON.stringify(data.address));
        }

        params.push(id);

        this.db.prepare(`
        UPDATE Organizations SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

        return this.findById(id) ?? null;
    }


    softDelete(id: number): boolean {
        const existing = this.findById(id);
        if (!existing) return false;

        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      UPDATE Organizations SET deletedAt = ?, updatedAt = ? WHERE id = ?
    `);

        const result = stmt.run(now, now, id);
        return result.changes > 0;
    }

    restore(id: number): Organization | null {
        const existing = this.findById(id, true);
        if (!existing || !existing.deletedAt) return null;

        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      UPDATE Organizations SET deletedAt = NULL, updatedAt = ? WHERE id = ?
    `);

        stmt.run(now, id);

        return this.findById(id) || null;
    }

    hardDelete(id: number): boolean {
        const stmt = this.db.prepare('DELETE FROM Organizations WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
}
