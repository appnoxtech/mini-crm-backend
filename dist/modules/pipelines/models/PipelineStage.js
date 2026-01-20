"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineStageModel = void 0;
class PipelineStageModel {
    db;
    constructor(db) {
        this.db = db;
    }
    initialize() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS pipeline_stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pipelineId INTEGER NOT NULL,
        name TEXT NOT NULL,
        orderIndex INTEGER NOT NULL,
        rottenDays INTEGER,
        probability INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (pipelineId) REFERENCES pipelines(id) ON DELETE CASCADE,
        UNIQUE(pipelineId, orderIndex)
      )
    `);
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipelineId ON pipeline_stages(pipelineId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_pipeline_stages_orderIndex ON pipeline_stages(orderIndex)');
    }
    create(data) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO pipeline_stages (pipelineId, name, orderIndex, rottenDays, probability, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(data.pipelineId, data.name, data.orderIndex, data.rottenDays || null, data.probability, now, now);
        return this.findById(result.lastInsertRowid);
    }
    searchByStageName(name) {
        const stmt = this.db.prepare('SELECT * FROM pipeline_stages WHERE name LIKE ?');
        const results = stmt.all(name);
        return results.map(r => ({
            ...r,
            isDefault: Boolean(r.isDefault),
            isActive: Boolean(r.isActive),
            dealRotting: Boolean(r.dealRotting)
        }));
    }
    findById(id) {
        const stmt = this.db.prepare('SELECT * FROM pipeline_stages WHERE id = ?');
        return stmt.get(id);
    }
    findByPipelineId(pipelineId) {
        const stmt = this.db.prepare('SELECT * FROM pipeline_stages WHERE pipelineId = ? ORDER BY orderIndex');
        return stmt.all(pipelineId);
    }
    bulkUpdate(pipelineId, stagesData) {
        const now = new Date().toISOString();
        // Step 1: Set all to negative temporary orderIndex values to avoid conflicts
        const tempStmt = this.db.prepare('UPDATE pipeline_stages SET orderIndex = ? WHERE id = ? AND pipelineId = ?');
        stagesData.forEach((stageData, index) => {
            tempStmt.run(-(index + 1), stageData.stageId, pipelineId);
        });
        // Step 2: Update all fields with actual positive orderIndex values
        const updateStmt = this.db.prepare(`
        UPDATE pipeline_stages 
        SET name = ?, orderIndex = ?, probability = ?, rottenDays = ?, updatedAt = ?
        WHERE id = ? AND pipelineId = ?
    `);
        stagesData.forEach((stageData) => {
            updateStmt.run(stageData.name, stageData.orderIndex, stageData.probability ?? 0, stageData.rottenDays ?? null, now, stageData.stageId, pipelineId);
        });
    }
    update(id, data) {
        const stage = this.findById(id);
        if (!stage) {
            return null;
        }
        const now = new Date().toISOString();
        const updates = [];
        const values = [];
        if (data.name !== undefined) {
            updates.push('name = ?');
            values.push(data.name);
        }
        if (data.orderIndex !== undefined) {
            updates.push('orderIndex = ?');
            values.push(data.orderIndex);
        }
        if (data.rottenDays !== undefined) {
            updates.push('rottenDays = ?');
            values.push(data.rottenDays);
        }
        if (data.probability !== undefined) {
            updates.push('probability = ?');
            values.push(data.probability);
        }
        if (updates.length === 0) {
            return stage;
        }
        updates.push('updatedAt = ?');
        values.push(now);
        values.push(id);
        const stmt = this.db.prepare(`
      UPDATE pipeline_stages 
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
        stmt.run(...values);
        return this.findById(id) || null;
    }
    reorder(pipelineId, stageOrder) {
        // Step 1: Set all to negative temporary values to avoid conflicts
        const tempStmt = this.db.prepare('UPDATE pipeline_stages SET orderIndex = ? WHERE id = ? AND pipelineId = ?');
        stageOrder.forEach((stageId, index) => {
            tempStmt.run(-(index + 1), stageId, pipelineId);
        });
        // Step 2: Set to actual positive values
        const finalStmt = this.db.prepare('UPDATE pipeline_stages SET orderIndex = ? WHERE id = ? AND pipelineId = ?');
        stageOrder.forEach((stageId, index) => {
            finalStmt.run(index, stageId, pipelineId);
        });
    }
    delete(id, moveDealsToStageId) {
        const stage = this.findById(id);
        if (!stage) {
            return false;
        }
        // Check if stage has deals
        const dealCount = this.db.prepare('SELECT COUNT(*) as count FROM deals WHERE stageId = ?').get(id);
        if (dealCount.count > 0) {
            if (!moveDealsToStageId) {
                throw new Error('Cannot delete stage with existing deals. Please specify a stage to move deals to.');
            }
            // Move deals to specified stage
            this.db.prepare('UPDATE deals SET stageId = ? WHERE stageId = ?').run(moveDealsToStageId, id);
        }
        const stmt = this.db.prepare('DELETE FROM pipeline_stages WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
    getStageWithDealCount(pipelineId) {
        const stmt = this.db.prepare(`
      SELECT 
        ps.*,
        COUNT(d.id) as dealCount,
        SUM(CASE WHEN d.value IS NOT NULL THEN d.value ELSE 0 END) as totalValue
      FROM pipeline_stages ps
      LEFT JOIN deals d ON ps.id = d.stageId AND d.status = 'open'
      WHERE ps.pipelineId = ?
      GROUP BY ps.id
      ORDER BY ps.orderIndex
    `);
        const results = stmt.all(pipelineId);
        return results.map(r => ({
            ...r,
            dealCount: r.dealCount || 0,
            totalValue: r.totalValue || 0
        }));
    }
}
exports.PipelineStageModel = PipelineStageModel;
//# sourceMappingURL=PipelineStage.js.map