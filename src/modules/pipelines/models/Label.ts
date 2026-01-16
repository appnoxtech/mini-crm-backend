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

export interface Label extends BaseEntity {
    value: string;
    color: string;
    orderIndex: number;
    pipelineId?: number;
    userId?: number;
    organizationId?: number;
    personId?: number;

}

export class LabelModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        this.db.exec('PRAGMA foreign_keys = ON;');

        this.db.exec(`
    CREATE TABLE IF NOT EXISTS label (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      value TEXT NOT NULL,
      color TEXT NOT NULL,
      orderIndex INTEGER NOT NULL,
      pipelineId INTEGER,
      userId INTEGER,
      organizationId INTEGER,
      personId INTEGER,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (pipelineId) REFERENCES pipelines(id) ON DELETE RESTRICT,
      FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE RESTRICT,
      FOREIGN KEY (personId) REFERENCES persons(id) ON DELETE RESTRICT
    )
  `);

        this.db.exec('CREATE INDEX IF NOT EXISTS idx_label_userId ON label(userId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_label_pipelineId ON label(pipelineId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_label_organizationId ON label(organizationId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_label_personId ON label(personId)');
    }


    create(data: Omit<Label, 'id' | 'createdAt' | 'updatedAt'>): Label {
        const now = new Date().toISOString();

        const stmt = this.db.prepare(`
      INSERT INTO label (
        value, color, orderIndex, pipelineId, userId, organizationId, personId, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            data.value,
            data.color,
            data.orderIndex,
            data.pipelineId,
            data.userId,
            data.organizationId,
            data.personId,
            now,
            now
        );

        return this.findById(result.lastInsertRowid as number)!;
    }

    findByPipelineId(pipelineId: number): Label[] {
        const stmt = this.db.prepare('SELECT * FROM label WHERE pipelineId = ?');
        const result = stmt.all(pipelineId) as any[];
        return result;
    }

    findByOrganizationId(organizationId: number): Label[] {
        const stmt = this.db.prepare('SELECT * FROM label WHERE organizationId = ?');
        const result = stmt.all(organizationId) as any[];
        return result;
    }

    findByPersonId(personId: number): Label[] {
        const stmt = this.db.prepare('SELECT * FROM label WHERE personId = ?');
        const result = stmt.all(personId) as any[];
        return result;
    }

    findById(id: number): Label | undefined {
        const stmt = this.db.prepare('SELECT * FROM label WHERE id = ?');
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
    } = {}): { label: Label[]; total: number } {
        let query = 'SELECT * FROM label WHERE userId = ?';
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
            label: results,
            total: countResult.count
        };
    }

    update(id: number, data: Partial<Label>): Label | undefined {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
            UPDATE label
            SET
                value = ?,
                color = ?,
                orderIndex = ?,
                pipelineId = ?,
                userId = ?,
                organizationId = ?,
                personId = ?,
                updatedAt = ?
            WHERE id = ?
        `);

        const result = stmt.run(
            data.value,
            data.color,
            data.orderIndex,
            data.pipelineId,
            data.userId,
            data.organizationId,
            data.personId,
            now,
            id
        );

        if (result.changes === 0) return undefined;

        return this.findById(id)!;
    }

    delete(id: number): boolean {
        const stmt = this.db.prepare('DELETE FROM label WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
}