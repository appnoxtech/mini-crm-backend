"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadModel = void 0;
class LeadModel {
    db;
    constructor(db) {
        this.db = db;
    }
    initialize() {
        // Create leads table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        company TEXT,
        value REAL,
        stage TEXT NOT NULL DEFAULT 'OPEN',
        notes TEXT,
        userId INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        closedAt TEXT,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);
        // Create lead_history table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS lead_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        leadId INTEGER NOT NULL,
        type TEXT NOT NULL,
        text TEXT NOT NULL,
        at TEXT NOT NULL,
        FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE CASCADE
      )
    `);
        // Create indexes
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_leads_userId ON leads(userId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_leads_createdAt ON leads(createdAt)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_lead_history_leadId ON lead_history(leadId)');
    }
    createLead(leadData) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO leads (name, company, value, notes, stage, userId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 'OPEN', ?, ?, ?)
    `);
        const result = stmt.run(leadData.name, leadData.company || null, leadData.value || null, leadData.notes || null, leadData.userId, now, now);
        const lead = this.findById(result.lastInsertRowid);
        if (!lead)
            throw new Error('Failed to create lead');
        // Add initial history entry
        this.addHistory(lead.id, 'status', 'Stage → Open');
        return lead;
    }
    findById(id) {
        const stmt = this.db.prepare('SELECT * FROM leads WHERE id = ?');
        return stmt.get(id);
    }
    findByUserId(userId, options = {}) {
        let query = 'SELECT * FROM leads WHERE userId = ?';
        const params = [userId];
        if (options.stage && options.stage !== 'All') {
            query += ' AND stage = ?';
            params.push(options.stage);
        }
        if (options.search) {
            query += ' AND (name LIKE ? OR company LIKE ? OR notes LIKE ?)';
            const searchTerm = `%${options.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        query += ' ORDER BY createdAt DESC';
        if (options.limit) {
            query += ' LIMIT ? OFFSET ?';
            params.push(options.limit, options.offset || 0);
        }
        const leads = this.db.prepare(query).all(...params);
        // Get total count
        let countQuery = 'SELECT COUNT(*) as count FROM leads WHERE userId = ?';
        const countParams = [userId];
        if (options.stage && options.stage !== 'All') {
            countQuery += ' AND stage = ?';
            countParams.push(options.stage);
        }
        if (options.search) {
            countQuery += ' AND (name LIKE ? OR company LIKE ? OR notes LIKE ?)';
            const searchTerm = `%${options.search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
        }
        const countResult = this.db.prepare(countQuery).get(...countParams);
        return {
            leads,
            count: countResult.count
        };
    }
    updateStage(id, userId, stage) {
        const lead = this.findById(id);
        if (!lead || lead.userId !== userId) {
            return null;
        }
        const now = new Date().toISOString();
        const closedAt = stage === 'WON' ? now : null;
        const stmt = this.db.prepare(`
      UPDATE leads 
      SET stage = ?, updatedAt = ?, closedAt = ?
      WHERE id = ? AND userId = ?
    `);
        stmt.run(stage, now, closedAt, id, userId);
        // Add history entry
        this.addHistory(id, 'status', `Stage → ${stage}`);
        return this.findById(id) || null;
    }
    addHistory(leadId, type, text) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO lead_history (leadId, type, text, at)
      VALUES (?, ?, ?, ?)
    `);
        stmt.run(leadId, type, text, now);
    }
    getHistory(leadId) {
        const stmt = this.db.prepare(`
      SELECT * FROM lead_history 
      WHERE leadId = ? 
      ORDER BY at DESC
    `);
        return stmt.all(leadId);
    }
    deleteLead(id, userId) {
        const lead = this.findById(id);
        if (!lead || lead.userId !== userId) {
            return false;
        }
        const stmt = this.db.prepare('DELETE FROM leads WHERE id = ? AND userId = ?');
        const result = stmt.run(id, userId);
        return result.changes > 0;
    }
    getStats(userId) {
        const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN stage = 'OPEN' THEN 1 ELSE 0 END) as openCount,
        SUM(CASE WHEN stage = 'WON' THEN 1 ELSE 0 END) as wonCount,
        SUM(CASE WHEN stage = 'LOST' THEN 1 ELSE 0 END) as lostCount,
        SUM(CASE WHEN value IS NOT NULL THEN value ELSE 0 END) as totalValue,
        SUM(CASE WHEN stage = 'WON' AND value IS NOT NULL THEN value ELSE 0 END) as wonValue
      FROM leads 
      WHERE userId = ?
    `);
        const result = stmt.get(userId);
        return {
            total: result.total || 0,
            openCount: result.openCount || 0,
            wonCount: result.wonCount || 0,
            lostCount: result.lostCount || 0,
            totalValue: result.totalValue || 0,
            wonValue: result.wonValue || 0
        };
    }
}
exports.LeadModel = LeadModel;
//# sourceMappingURL=Lead.js.map