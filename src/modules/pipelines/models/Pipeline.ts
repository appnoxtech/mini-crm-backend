import Database from 'better-sqlite3';
import { BaseEntity } from '../../../shared/types';

export interface Pipeline extends BaseEntity {
    name: string;
    description?: string;
    userId: number;
    isDefault: boolean;
    isActive: boolean;
    dealRotting: boolean;
    rottenDays: number;
}

type searchResult = {
    name: string;
    id: number;
    description?: string;
    isDefault: boolean;
    isActive: boolean;
}

export class PipelineModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS pipelines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        userId INTEGER NOT NULL,
        isDefault BOOLEAN DEFAULT 0,
        isActive BOOLEAN DEFAULT 1,
        dealRotting BOOLEAN DEFAULT 0,
        rottenDays INTEGER DEFAULT 30,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

        this.db.exec('CREATE INDEX IF NOT EXISTS idx_pipelines_userId ON pipelines(userId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_pipelines_isActive ON pipelines(isActive)');
    }

    create(data: Omit<Pipeline, 'id' | 'createdAt' | 'updatedAt'>): Pipeline {
        const now = new Date().toISOString();

        // If this is set as default, unset other defaults for this user
        if (data.isDefault) {
            this.db.prepare('UPDATE pipelines SET isDefault = 0 WHERE userId = ?').run(data.userId);
        }

        const stmt = this.db.prepare(`
      INSERT INTO pipelines (name, description, userId, isDefault, isActive, dealRotting, rottenDays, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            data.name,
            data.description || null,
            data.userId,
            data.isDefault ? 1 : 0,
            data.isActive ? 1 : 0,
            data.dealRotting ? 1 : 0,
            data.rottenDays,
            now,
            now
        );

        return this.findById(result.lastInsertRowid as number)!;
    }

    findById(id: number): Pipeline | undefined {
        const stmt = this.db.prepare('SELECT * FROM pipelines WHERE id = ?');
        const result = stmt.get(id) as any;
        if (!result) return undefined;

        return {
            ...result,
            isDefault: Boolean(result.isDefault),
            isActive: Boolean(result.isActive),
            dealRotting: Boolean(result.dealRotting)
        };
    }

    searchByPipelineName(name: string): searchResult[] {
        const stmt = this.db.prepare('SELECT * FROM pipelines WHERE name LIKE ?');
        const results = stmt.all(name) as any[];
        return results.map(r => ({
            ...r,
            isDefault: Boolean(r.isDefault),
            isActive: Boolean(r.isActive),
            dealRotting: Boolean(r.dealRotting)
        }));
    }

    findByUserId(userId: number, includeInactive: boolean = false): Pipeline[] {
        let query = 'SELECT * FROM pipelines WHERE userId = ?';
        if (!includeInactive) {
            query += ' AND isActive = 1';
        }
        query += ' ORDER BY isDefault DESC, name';

        const stmt = this.db.prepare(query);
        const results = stmt.all(userId) as any[];

        return results.map(r => ({
            ...r,
            isDefault: Boolean(r.isDefault),
            isActive: Boolean(r.isActive),
            dealRotting: Boolean(r.dealRotting)
        }));
    }

    update(id: number, userId: number, data: Partial<Omit<Pipeline, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Pipeline | null {
        const pipeline = this.findById(id);
        if (!pipeline || pipeline.userId !== userId) {
            return null;
        }

        const now = new Date().toISOString();
        const updates: string[] = [];
        const values: any[] = [];

        if (data.name !== undefined) {
            updates.push('name = ?');
            values.push(data.name);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            values.push(data.description);
        }
        if (data.isDefault !== undefined) {
            // If setting as default, unset other defaults
            if (data.isDefault) {
                this.db.prepare('UPDATE pipelines SET isDefault = 0 WHERE userId = ?').run(userId);
            }
            updates.push('isDefault = ?');
            values.push(data.isDefault ? 1 : 0);
        }
        if (data.isActive !== undefined) {
            updates.push('isActive = ?');
            values.push(data.isActive ? 1 : 0);
        }
        if (data.dealRotting !== undefined) {
            updates.push('dealRotting = ?');
            values.push(data.dealRotting ? 1 : 0);
        }
        if (data.rottenDays !== undefined) {
            updates.push('rottenDays = ?');
            values.push(data.rottenDays);
        }

        if (updates.length === 0) {
            return pipeline;
        }

        updates.push('updatedAt = ?');
        values.push(now);
        values.push(id, userId);

        const stmt = this.db.prepare(`
      UPDATE pipelines 
      SET ${updates.join(', ')}
      WHERE id = ? AND userId = ?
    `);

        stmt.run(...values);
        return this.findById(id) || null;
    }

    delete(id: number, userId: number): boolean {
        const pipeline = this.findById(id);
        if (!pipeline || pipeline.userId !== userId) {
            return false;
        }

        // Check if pipeline has deals
        const dealCount = this.db.prepare('SELECT COUNT(*) as count FROM deals WHERE pipelineId = ?').get(id) as { count: number };
        if (dealCount.count > 0) {
            throw new Error('Cannot delete pipeline with existing deals');
        }

        const stmt = this.db.prepare('DELETE FROM pipelines WHERE id = ? AND userId = ?');
        const result = stmt.run(id, userId);
        return result.changes > 0;
    }

    getStats(pipelineId: number): {
        totalDeals: number;
        totalValue: number;
        wonDeals: number;
        wonValue: number;
        lostDeals: number;
        lostValue: number;
    } {
        const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as totalDeals,
        SUM(CASE WHEN value IS NOT NULL THEN value ELSE 0 END) as totalValue,
        SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as wonDeals,
        SUM(CASE WHEN status = 'won' AND value IS NOT NULL THEN value ELSE 0 END) as wonValue,
        SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lostDeals,
        SUM(CASE WHEN status = 'lost' AND value IS NOT NULL THEN value ELSE 0 END) as lostValue
      FROM deals 
      WHERE pipelineId = ?
    `);

        const result = stmt.get(pipelineId) as any;

        return {
            totalDeals: result.totalDeals || 0,
            totalValue: result.totalValue || 0,
            wonDeals: result.wonDeals || 0,
            wonValue: result.wonValue || 0,
            lostDeals: result.lostDeals || 0,
            lostValue: result.lostValue || 0
        };
    }
}
