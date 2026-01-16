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
    annualRevenue?: number;
    numberOfEmployees?: number;
    linkedinProfile?: string;
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
    annualRevenue: number;
    numberOfEmployees: number;
    linkedinProfile: string;
}


export interface CreateOrganizationData {
    name: string;
    description?: string;
    website?: string;
    industry?: string;
    status?: string;
    emails?: { value: string; type: string }[];
    phones?: { value: string; type: string }[];
    annualRevenue?: number;
    numberOfEmployees?: number;
    linkedinProfile?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        pincode?: string;
    };
}

export interface UpdateOrganizationData {
    name?: string;
    description?: string;
    website?: string;
    industry?: string;
    status?: string;
    emails?: { value: string; type: string }[];
    phones?: { value: string; type: string }[];
    annualRevenue?: number;
    numberOfEmployees?: number;
    linkedinProfile?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        pincode?: string;
    };
}

export class OrganizationModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
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

        this.db.exec('CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_organizations_deletedAt ON organizations(deletedAt)');

        // Ensure 'organisations' (with 's') works as a reference to 'organizations' (with 'z')
        this.db.exec('CREATE VIEW IF NOT EXISTS organisations AS SELECT * FROM organizations');
    }


    create(data: CreateOrganizationData): Organization {
        const now = new Date().toISOString();

        const stmt = this.db.prepare(`
        INSERT INTO organizations 
        (name, description, industry, website, status, emails, phones, annualRevenue, numberOfEmployees, linkedinProfile, address, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            data.name,
            data.description || null,
            data.industry || null,
            data.website || null,
            data.status || null,
            data.emails ? JSON.stringify(data.emails) : null,
            data.phones ? JSON.stringify(data.phones) : null,
            data.annualRevenue || null,
            data.numberOfEmployees || null,
            data.linkedinProfile || null,
            data.address ? JSON.stringify(data.address) : null,
            now,
            now
        );

        return this.findById(result.lastInsertRowid as number)!;
    }


    findById(id: number, includeDeleted = false): Organization | undefined {
        let query = 'SELECT * FROM organizations WHERE id = ?';
        if (!includeDeleted) query += ' AND deletedAt IS NULL';

        const org = this.db.prepare(query).get(id) as any;
        if (!org) return undefined;

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

    searchByOrgName(search: string): Organization[] {
        const stmt = this.db.prepare(`
        SELECT * FROM organizations 
        WHERE name LIKE ? 
        `);

        const rows = stmt.all(`%${search}%`) as any[];
        return rows.map((row) => this.findById(row.id)!);
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
           OR annualRevenue LIKE ? 
           OR numberOfEmployees LIKE ? 
           OR linkedinProfile LIKE ? 
           OR address LIKE ?
    `);

        const rows = stmt.all(
            `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`,
            `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`,
            `%${search}%`, `%${search}%`, `%${search}%`
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
            annualRevenue: org.annualRevenue,
            numberOfEmployees: org.numberOfEmployees,
            linkedinProfile: org.linkedinProfile,
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
        let query = 'SELECT * FROM organizations WHERE 1=1';
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
        let countQuery = 'SELECT COUNT(*) as count FROM organizations WHERE 1=1';
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
            organizations: organizations.map((org: any) => ({
                ...org,
                emails: typeof org.emails === 'string' ? JSON.parse(org.emails) : org.emails,
                phones: typeof org.phones === 'string' ? JSON.parse(org.phones) : org.phones,
                address: typeof org.address === 'string' ? JSON.parse(org.address) : org.address
            })),
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
        UPDATE organizations SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

        return this.findById(id) ?? null;
    }


    softDelete(id: number): boolean {
        const existing = this.findById(id);
        if (!existing) return false;

        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      UPDATE organizations SET deletedAt = ?, updatedAt = ? WHERE id = ?
    `);

        const result = stmt.run(now, now, id);
        return result.changes > 0;
    }

    restore(id: number): Organization | null {
        const existing = this.findById(id, true);
        if (!existing || !existing.deletedAt) return null;

        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      UPDATE organizations SET deletedAt = NULL, updatedAt = ? WHERE id = ?
    `);

        stmt.run(now, id);

        return this.findById(id) || null;
    }

    hardDelete(id: number): boolean {
        const stmt = this.db.prepare('DELETE FROM organizations WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
}
