import Database from "better-sqlite3";
import { BaseEntity } from '../../../shared/types';

/**
 * needed field
 * Value
Color
orderIndex
pipelineId
userId
 * 
 */

export interface Lavel extends BaseEntity {
    value: string;
    color: string;
    orderIndex: number;
    pipelineId: number;
    userId: number;
}

export class LavelModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS lavel (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        value TEXT NOT NULL,
        color TEXT NOT NULL,
        orderIndex INTEGER NOT NULL,
        pipelineId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (pipelineId) REFERENCES pipelines(id) ON DELETE RESTRICT
      )
    `);

        this.db.exec('CREATE INDEX IF NOT EXISTS idx_lavel_userId ON lavel(userId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_lavel_pipelineId ON lavel(pipelineId)');
    }

    create(data: Omit<Lavel, 'id' | 'createdAt' | 'updatedAt'>): Lavel {
        const now = new Date().toISOString();

        const stmt = this.db.prepare(`
      INSERT INTO lavel (
        value, color, orderIndex, pipelineId, userId, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            data.value,
            data.color,
            data.orderIndex,
            data.pipelineId,
            data.userId,
            now,
            now
        );

        return this.findById(result.lastInsertRowid as number)!;
    }

    findByPipelineId(pipelineId: number): Lavel[] {
        const stmt = this.db.prepare('SELECT * FROM lavel WHERE pipelineId = ?');
        const result = stmt.all(pipelineId) as any[];
        return result;
    }

    findById(id: number): Lavel | undefined {
        const stmt = this.db.prepare('SELECT * FROM lavel WHERE id = ?');
        const result = stmt.get(id) as any;
        if (!result) return undefined;

        return result;
    }

    findByUserId(userId: number, filters: {
        pipelineId?: number;
        stageId?: number;
        status?: string;
        search?: string;
        limit?: number;
        offset?: number;
    } = {}): { lavel: Lavel[]; total: number } {
        let query = 'SELECT * FROM lavel WHERE userId = ?';
        const params: any[] = [userId];

        if (filters.pipelineId) {
            query += ' AND pipelineId = ?';
            params.push(filters.pipelineId);
        }

        if (filters.stageId) {
            query += ' AND pipelineId = ?';
            params.push(filters.stageId);
        }

        if (filters.status) {
            query += ' AND status = ?';
            params.push(filters.status);
        }

        if (filters.search) {
            query += ' AND (value LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm);
        }

        query += ' ORDER BY createdAt DESC';

        // Get total count
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
        const countResult = this.db.prepare(countQuery).get(...params) as { count: number };

        // Add pagination
        if (filters.limit) {
            query += ' LIMIT ? OFFSET ?';
            params.push(filters.limit, filters.offset || 0);
        }

        const stmt = this.db.prepare(query);
        const results = stmt.all(...params) as any[];

        return {
            lavel: results,
            total: countResult.count
        };
    }

    update(id: number, data: Partial<Lavel>): Lavel | undefined {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
            UPDATE lavel
            SET
                value = ?,
                color = ?,
                orderIndex = ?,
                pipelineId = ?,
                userId = ?,
                updatedAt = ?
            WHERE id = ?
        `);

        const result = stmt.run(
            data.value,
            data.color,
            data.orderIndex,
            data.pipelineId,
            data.userId,
            now,
            id
        );

        if (result.changes === 0) return undefined;

        return this.findById(id)!;
    }

    delete(id: number): boolean {
        const stmt = this.db.prepare('DELETE FROM lavel WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
}