"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const middleware_1 = require("./middleware");
const db_1 = __importDefault(require("./db"));
const router = (0, express_1.Router)();
// Apply auth middleware to all leads routes
router.use(middleware_1.authMiddleware);
// Get all leads for the authenticated user
router.get('/', (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { stage, q, limit = 100, offset = 0 } = req.query;
        let query = 'SELECT * FROM leads WHERE userId = ?';
        const params = [req.user.id];
        if (stage && stage !== 'All') {
            query += ' AND stage = ?';
            params.push(stage);
        }
        if (q) {
            query += ' AND (name LIKE ? OR company LIKE ? OR notes LIKE ?)';
            const searchTerm = `%${q}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const leads = db_1.default.prepare(query).all(...params);
        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as count FROM leads WHERE userId = ?';
        const countParams = [req.user.id];
        if (stage && stage !== 'All') {
            countQuery += ' AND stage = ?';
            countParams.push(stage);
        }
        if (q) {
            countQuery += ' AND (name LIKE ? OR company LIKE ? OR notes LIKE ?)';
            const searchTerm = `%${q}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
        }
        const countResult = db_1.default.prepare(countQuery).get(...countParams);
        const totalCount = countResult.count;
        res.json({
            items: leads,
            count: totalCount
        });
    }
    catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
});
// Create a new lead
router.post('/', (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { name, company, value, notes } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }
        const now = new Date().toISOString();
        const stmt = db_1.default.prepare(`
      INSERT INTO leads (name, company, value, notes, stage, userId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 'OPEN', ?, ?, ?)
    `);
        const result = stmt.run(name.trim(), company?.trim() || null, value ? Number(value) : null, notes?.trim() || null, req.user.id, now, now);
        // Get the created lead
        const lead = db_1.default.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
        // Add initial history entry
        db_1.default.prepare(`
      INSERT INTO lead_history (leadId, type, text, at)
      VALUES (?, 'status', 'Stage → Open', ?)
    `).run(lead.id, now);
        res.status(201).json(lead);
    }
    catch (error) {
        console.error('Error creating lead:', error);
        res.status(500).json({ error: 'Failed to create lead' });
    }
});
// Update lead stage
router.post('/:id/stage', (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { id } = req.params;
        const { stage } = req.body;
        if (!['OPEN', 'WON', 'LOST'].includes(stage)) {
            return res.status(400).json({ error: 'Invalid stage' });
        }
        // Check if lead belongs to user
        const lead = db_1.default.prepare('SELECT * FROM leads WHERE id = ? AND userId = ?').get(id, req.user.id);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        const now = new Date().toISOString();
        // Update lead
        db_1.default.prepare(`
      UPDATE leads 
      SET stage = ?, updatedAt = ?, closedAt = ?
      WHERE id = ? AND userId = ?
    `).run(stage, now, stage === 'WON' ? now : null, id, req.user.id);
        // Add history entry
        db_1.default.prepare(`
      INSERT INTO lead_history (leadId, type, text, at)
      VALUES (?, 'status', ?, ?)
    `).run(id, `Stage → ${stage}`, now);
        // Get updated lead
        const updatedLead = db_1.default.prepare('SELECT * FROM leads WHERE id = ?').get(id);
        res.json(updatedLead);
    }
    catch (error) {
        console.error('Error updating lead stage:', error);
        res.status(500).json({ error: 'Failed to update lead stage' });
    }
});
// Add activity to lead
router.post('/:id/activity', (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { id } = req.params;
        const { type, text } = req.body;
        if (!type || !text || !text.trim()) {
            return res.status(400).json({ error: 'Type and text are required' });
        }
        // Check if lead belongs to user
        const lead = db_1.default.prepare('SELECT * FROM leads WHERE id = ? AND userId = ?').get(id, req.user.id);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        const now = new Date().toISOString();
        // Add history entry
        db_1.default.prepare(`
      INSERT INTO lead_history (leadId, type, text, at)
      VALUES (?, ?, ?, ?)
    `).run(id, type, text.trim(), now);
        res.json({ message: 'Activity added successfully' });
    }
    catch (error) {
        console.error('Error adding activity:', error);
        res.status(500).json({ error: 'Failed to add activity' });
    }
});
// Get lead history
router.get('/:id/history', (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { id } = req.params;
        // Check if lead belongs to user
        const lead = db_1.default.prepare('SELECT * FROM leads WHERE id = ? AND userId = ?').get(id, req.user.id);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        // Get history
        const history = db_1.default.prepare(`
      SELECT * FROM lead_history 
      WHERE leadId = ? 
      ORDER BY at DESC
    `).all(id);
        res.json(history);
    }
    catch (error) {
        console.error('Error fetching lead history:', error);
        res.status(500).json({ error: 'Failed to fetch lead history' });
    }
});
// Delete lead
router.delete('/:id', (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { id } = req.params;
        // Check if lead belongs to user
        const lead = db_1.default.prepare('SELECT * FROM leads WHERE id = ? AND userId = ?').get(id, req.user.id);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        // Delete lead (history will be deleted automatically due to CASCADE)
        db_1.default.prepare('DELETE FROM leads WHERE id = ? AND userId = ?').run(id, req.user.id);
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting lead:', error);
        res.status(500).json({ error: 'Failed to delete lead' });
    }
});
// Get stats for the authenticated user
router.get('/stats', (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const stats = db_1.default.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN stage = 'OPEN' THEN 1 ELSE 0 END) as openCount,
        SUM(CASE WHEN stage = 'WON' THEN 1 ELSE 0 END) as wonCount,
        SUM(CASE WHEN stage = 'LOST' THEN 1 ELSE 0 END) as lostCount,
        SUM(CASE WHEN value IS NOT NULL THEN value ELSE 0 END) as totalValue,
        SUM(CASE WHEN stage = 'WON' AND value IS NOT NULL THEN value ELSE 0 END) as wonValue
      FROM leads 
      WHERE userId = ?
    `).get(req.user.id);
        res.json({
            total: stats.total || 0,
            openCount: stats.openCount || 0,
            wonCount: stats.wonCount || 0,
            lostCount: stats.lostCount || 0,
            totalValue: stats.totalValue || 0,
            wonValue: stats.wonValue || 0
        });
    }
    catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});
exports.default = router;
//# sourceMappingURL=leadsRoutes.js.map