"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabelModel = void 0;
class LabelModel {
    db;
    constructor(db) {
        this.db = db;
    }
    initialize() {
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
    create(data) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO label (
        value, color, orderIndex, pipelineId, userId, organizationId, personId, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(data.value, data.color, data.orderIndex, data.pipelineId, data.userId, data.organizationId, data.personId, now, now);
        return this.findById(result.lastInsertRowid);
    }
    findByPipelineId(pipelineId) {
        const stmt = this.db.prepare('SELECT * FROM label WHERE pipelineId = ?');
        const result = stmt.all(pipelineId);
        return result;
    }
    findByOrganizationId(organizationId) {
        const stmt = this.db.prepare('SELECT * FROM label WHERE organizationId = ?');
        const result = stmt.all(organizationId);
        return result;
    }
    findByPersonId(personId) {
        const stmt = this.db.prepare('SELECT * FROM label WHERE personId = ?');
        const result = stmt.all(personId);
        return result;
    }
    findById(id) {
        const stmt = this.db.prepare('SELECT * FROM label WHERE id = ?');
        const result = stmt.get(id);
        if (!result)
            return undefined;
        return result;
    }
    findByUserId(userId, filters = {}) {
        let query = 'SELECT * FROM label WHERE userId = ?';
        const params = [userId];
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
        const countResult = this.db.prepare(countQuery).get(...params);
        // Add pagination
        if (filters.limit) {
            query += ' LIMIT ? OFFSET ?';
            params.push(filters.limit, filters.offset || 0);
        }
        const stmt = this.db.prepare(query);
        const results = stmt.all(...params);
        return {
            label: results,
            total: countResult.count
        };
    }
    update(id, data) {
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
        const result = stmt.run(data.value, data.color, data.orderIndex, data.pipelineId, data.userId, data.organizationId, data.personId, now, id);
        if (result.changes === 0)
            return undefined;
        return this.findById(id);
    }
    delete(id) {
        const stmt = this.db.prepare('DELETE FROM label WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
}
exports.LabelModel = LabelModel;
//# sourceMappingURL=Label.js.map