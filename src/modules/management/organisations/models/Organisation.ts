import Database from 'better-sqlite3';
import { BaseEntity } from '../../../../shared/types';

export interface Organisation extends BaseEntity {
    name: string;
    description?: string;
    website?: string;
    deletedAt?: string;
}

export interface CreateOrganisationData {
    name: string;
    description?: string;
    website?: string;
}

export interface UpdateOrganisationData {
    name?: string;
    description?: string;
    website?: string;
}

export class OrganisationModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS organisations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        website TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT
      )
    `);

        // Create indexes
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_organisations_name ON organisations(name)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_organisations_deletedAt ON organisations(deletedAt)');
    }

    create(data: CreateOrganisationData): Organisation {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO organisations (name, description, website, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            data.name,
            data.description || null,
            data.website || null,
            now,
            now
        );

        const organisation = this.findById(result.lastInsertRowid as number);
        if (!organisation) throw new Error('Failed to create organisation');

        return organisation;
    }

    findById(id: number, includeDeleted: boolean = false): Organisation | undefined {
        let query = 'SELECT * FROM organisations WHERE id = ?';
        if (!includeDeleted) {
            query += ' AND deletedAt IS NULL';
        }
        const stmt = this.db.prepare(query);
        return stmt.get(id) as Organisation | undefined;
    }

    findAll(options: {
        search?: string;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    } = {}): { organisations: Organisation[]; count: number } {
        let query = 'SELECT * FROM organisations WHERE 1=1';
        const params: any[] = [];

        if (!options.includeDeleted) {
            query += ' AND deletedAt IS NULL';
        }

        if (options.search) {
            query += ' AND (name LIKE ? OR description LIKE ?)';
            const searchTerm = `%${options.search}%`;
            params.push(searchTerm, searchTerm);
        }

        query += ' ORDER BY createdAt DESC';

        if (options.limit) {
            query += ' LIMIT ? OFFSET ?';
            params.push(options.limit, options.offset || 0);
        }

        const organisations = this.db.prepare(query).all(...params) as Organisation[];

        // Get total count
        let countQuery = 'SELECT COUNT(*) as count FROM organisations WHERE 1=1';
        const countParams: any[] = [];

        if (!options.includeDeleted) {
            countQuery += ' AND deletedAt IS NULL';
        }

        if (options.search) {
            countQuery += ' AND (name LIKE ? OR description LIKE ?)';
            const searchTerm = `%${options.search}%`;
            countParams.push(searchTerm, searchTerm);
        }

        const countResult = this.db.prepare(countQuery).get(...countParams) as { count: number };

        return {
            organisations,
            count: countResult.count
        };
    }

    update(id: number, data: UpdateOrganisationData): Organisation | null {
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
        if (data.website !== undefined) {
            updates.push('website = ?');
            params.push(data.website);
        }

        params.push(id);

        const stmt = this.db.prepare(`
      UPDATE organisations SET ${updates.join(', ')} WHERE id = ?
    `);

        stmt.run(...params);

        return this.findById(id) || null;
    }

    softDelete(id: number): boolean {
        const existing = this.findById(id);
        if (!existing) return false;

        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      UPDATE organisations SET deletedAt = ?, updatedAt = ? WHERE id = ?
    `);

        const result = stmt.run(now, now, id);
        return result.changes > 0;
    }

    restore(id: number): Organisation | null {
        const existing = this.findById(id, true);
        if (!existing || !existing.deletedAt) return null;

        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      UPDATE organisations SET deletedAt = NULL, updatedAt = ? WHERE id = ?
    `);

        stmt.run(now, id);

        return this.findById(id) || null;
    }

    hardDelete(id: number): boolean {
        const stmt = this.db.prepare('DELETE FROM organisations WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
}
