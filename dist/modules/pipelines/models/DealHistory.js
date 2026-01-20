"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealHistoryModel = void 0;
class DealHistoryModel {
    db;
    constructor(db) {
        this.db = db;
    }
    initialize() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS deal_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dealId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        eventType TEXT NOT NULL,
        fromValue TEXT,
        toValue TEXT,
        fromStageId INTEGER,
        toStageId INTEGER,
        stageDuration INTEGER,
        description TEXT,
        metadata TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (dealId) REFERENCES deals(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (fromStageId) REFERENCES pipeline_stages(id) ON DELETE SET NULL,
        FOREIGN KEY (toStageId) REFERENCES pipeline_stages(id) ON DELETE SET NULL
      )
    `);
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deal_history_dealId ON deal_history(dealId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deal_history_userId ON deal_history(userId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deal_history_eventType ON deal_history(eventType)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_deal_history_createdAt ON deal_history(createdAt)');
    }
    create(data) {
        const stmt = this.db.prepare(`
      INSERT INTO deal_history (
        dealId, userId, eventType, fromValue, toValue, fromStageId, toStageId,
        stageDuration, description, metadata, createdAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(data.dealId, data.userId, data.eventType, data.fromValue || null, data.toValue || null, data.fromStageId || null, data.toStageId || null, data.stageDuration || null, data.description || null, data.metadata || null, data.createdAt);
        return this.findById(result.lastInsertRowid);
    }
    formatHistory(result) {
        return {
            ...result,
            metadata: result.metadata ? JSON.parse(result.metadata) : undefined
        };
    }
    findById(id) {
        const stmt = this.db.prepare('SELECT * FROM deal_history WHERE id = ?');
        const result = stmt.get(id);
        if (!result)
            return undefined;
        return this.formatHistory(result);
    }
    getDealHistory(dealId) {
        const stmt = this.db.prepare('SELECT * FROM deal_history WHERE dealId = ?');
        const results = stmt.all(dealId);
        return results.map(r => this.formatHistory(r));
    }
    // findById(id: number): DealHistory | undefined {
    //     const stmt = this.db.prepare('SELECT * FROM deal_history WHERE id = ?');
    //     return stmt.get(id) as DealHistory | undefined;
    // }
    findByDealId(dealId, limit) {
        let query = 'SELECT * FROM deal_history WHERE dealId = ? ORDER BY createdAt DESC';
        let results;
        if (limit) {
            query += ' LIMIT ?';
            results = this.db.prepare(query).all(dealId, limit);
        }
        else {
            results = this.db.prepare(query).all(dealId);
        }
        return results.map(r => this.formatHistory(r));
    }
    findLastStageChange(dealId) {
        const stmt = this.db.prepare(`
      SELECT * FROM deal_history 
      WHERE dealId = ? AND eventType = 'stage_change'
      ORDER BY createdAt DESC 
      LIMIT 1
    `);
        const result = stmt.get(dealId);
        return result ? this.formatHistory(result) : undefined;
    }
    findByEventType(dealId, eventType) {
        const stmt = this.db.prepare(`
      SELECT * FROM deal_history 
      WHERE dealId = ? AND eventType = ?
      ORDER BY createdAt DESC
    `);
        const results = stmt.all(dealId, eventType);
        return results.map(r => this.formatHistory(r));
    }
    getTimeInStages(dealId) {
        const stmt = this.db.prepare(`
      SELECT 
        dh.toStageId as stageId,
        ps.name as stageName,
        dh.stageDuration as duration
      FROM deal_history dh
      LEFT JOIN pipeline_stages ps ON dh.toStageId = ps.id
      WHERE dh.dealId = ? AND dh.eventType = 'stage_change' AND dh.stageDuration IS NOT NULL
      ORDER BY dh.createdAt
    `);
        return stmt.all(dealId);
    }
    delete(id) {
        const stmt = this.db.prepare('DELETE FROM deal_history WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
}
exports.DealHistoryModel = DealHistoryModel;
//# sourceMappingURL=DealHistory.js.map