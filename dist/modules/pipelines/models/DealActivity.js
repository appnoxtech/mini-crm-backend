"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealActivityModel = void 0;
class DealActivityModel {
    db;
    constructor(db) {
        this.db = db;
    }
    initialize() {
        this.db.exec(`
        CREATE TABLE IF NOT EXISTS deal_activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dealId INTEGER NOT NULL,
            userId INTEGER NOT NULL,
            activityType TEXT NOT NULL,
            subject TEXT,
            label TEXT,
            startDate TEXT,
            endDate TEXT,
            startTime TEXT,
            endTime TEXT,
            priority TEXT CHECK(priority IN ('low','medium','high','none')),
            busyFree TEXT CHECK(busyFree IN ('busy','free','notSet')),
            note TEXT,
            organization TEXT,
            email TEXT,
            files TEXT,
            participants TEXT,   -- store JSON string
            deal TEXT,           -- store JSON string
            persons TEXT,        -- store JSON string
            mataData TEXT,       -- store JSON string
            isDone INTEGER NOT NULL DEFAULT 0,
            completedAt TEXT,
            createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);
        // Add missing columns if they don't exist (for existing databases)
        const columnsToAdd = [
            { name: 'activityType', definition: 'TEXT' },
            { name: 'subject', definition: 'TEXT' },
            { name: 'label', definition: 'TEXT' },
            { name: 'startDate', definition: 'TEXT' },
            { name: 'endDate', definition: 'TEXT' },
            { name: 'startTime', definition: 'TEXT' },
            { name: 'endTime', definition: 'TEXT' },
            { name: 'priority', definition: 'TEXT' },
            { name: 'busyFree', definition: 'TEXT' },
            { name: 'note', definition: 'TEXT' },
            { name: 'organization', definition: 'TEXT' },
            { name: 'email', definition: 'TEXT' },
            { name: 'files', definition: 'TEXT' },
            { name: 'participants', definition: 'TEXT' },
            { name: 'deal', definition: 'TEXT' },
            { name: 'persons', definition: 'TEXT' },
            { name: 'mataData', definition: 'TEXT' },
            { name: 'isDone', definition: 'INTEGER DEFAULT 0' },
            { name: 'completedAt', definition: 'TEXT' },
        ];
        for (const column of columnsToAdd) {
            try {
                this.db.exec(`ALTER TABLE deal_activities ADD COLUMN ${column.name} ${column.definition}`);
                console.log(`Added ${column.name} column to deal_activities table`);
            }
            catch (error) {
                // Column already exists, ignore error
            }
        }
    }
    create(data) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
        INSERT INTO deal_activities (
            dealId, userId, activityType, subject, label,
            startDate, endDate, startTime, endTime,
            priority, busyFree, note, organization,
            email, files, participants, deal, persons, mataData,
            isDone, completedAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(data.dealId, data.userId, data.activityType, data.subject || null, data.label || null, data.startDate || null, data.endDate || null, data.startTime || null, data.endTime || null, data.priority || null, data.busyFree || null, data.note || null, data.organization || null, data.email ? JSON.stringify(data.email) : null, data.files ? JSON.stringify(data.files) : null, data.participants ? JSON.stringify(data.participants) : null, data.deal ? JSON.stringify(data.deal) : null, data.persons ? JSON.stringify(data.persons) : null, data.mataData ? JSON.stringify(data.mataData) : null, data.isDone ? 1 : 0, data.completedAt || null, now, now);
        // Update deal's lastActivityAt
        this.db.prepare('UPDATE deals SET lastActivityAt = ? WHERE id = ?').run(now, data.dealId);
        return this.findById(result.lastInsertRowid);
    }
    formatActivity(result) {
        return {
            ...result,
            isDone: Boolean(result.isDone),
            email: result.email ? JSON.parse(result.email) : undefined,
            participants: result.participants ? JSON.parse(result.participants) : [],
            deal: result.deal ? JSON.parse(result.deal) : {},
            files: result.files ? JSON.parse(result.files) : [],
            persons: result.persons ? JSON.parse(result.persons) : [],
            mataData: result.mataData ? JSON.parse(result.mataData) : []
        };
    }
    findById(id) {
        const stmt = this.db.prepare('SELECT * FROM deal_activities WHERE id = ?');
        const result = stmt.get(id);
        if (!result)
            return undefined;
        return this.formatActivity(result);
    }
    findByDealId(dealId, filters = {}) {
        let query = 'SELECT * FROM deal_activities WHERE dealId = ?';
        const params = [dealId];
        if (filters.activityType) {
            query += ' AND activityType = ?';
            params.push(filters.activityType);
        }
        if (filters.isDone !== undefined) {
            query += ' AND isDone = ?';
            params.push(filters.isDone ? 1 : 0);
        }
        query += ' ORDER BY startDate DESC, createdAt DESC';
        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }
        const stmt = this.db.prepare(query);
        const results = stmt.all(...params);
        return results.map(r => this.formatActivity(r));
    }
    // create note type activity 
    createNoteActivity(userId, dealId, note) {
        return this.create({
            userId,
            dealId,
            activityType: 'note',
            note,
            isDone: false
        });
    }
    createFileActivity(userId, dealId, files) {
        return this.create({
            userId,
            dealId,
            activityType: 'file',
            files,
            isDone: false
        });
    }
    findByUserId(userId, filters = {}) {
        let query = 'SELECT * FROM deal_activities WHERE userId = ?';
        const params = [userId];
        if (filters.activityType) {
            query += ' AND activityType = ?';
            params.push(filters.activityType);
        }
        if (filters.isDone !== undefined) {
            query += ' AND isDone = ?';
            params.push(filters.isDone ? 1 : 0);
        }
        if (filters.upcoming) {
            const today = new Date().toISOString().split('T')[0];
            query += ' AND startDate >= ? AND isDone = 0';
            params.push(today);
        }
        query += ' ORDER BY startDate ASC, createdAt DESC';
        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }
        const stmt = this.db.prepare(query);
        const results = stmt.all(...params);
        return results.map(r => this.formatActivity(r));
    }
    update(id, data) {
        const activity = this.findById(id);
        if (!activity)
            return null;
        const now = new Date().toISOString();
        const updates = [];
        const values = [];
        Object.entries(data).forEach(([key, value]) => {
            if (key === 'isDone') {
                updates.push(`${key} = ?`);
                values.push(value ? 1 : 0);
            }
            else if (['participants', 'deal', 'persons', 'mataData', 'files', 'email'].includes(key)) {
                updates.push(`${key} = ?`);
                values.push(value ? JSON.stringify(value) : null);
            }
            else {
                updates.push(`${key} = ?`);
                values.push(value === undefined ? null : value);
            }
        });
        if (updates.length === 0)
            return activity;
        updates.push('updatedAt = ?');
        values.push(now);
        values.push(id);
        const stmt = this.db.prepare(`
        UPDATE deal_activities 
        SET ${updates.join(', ')}
        WHERE id = ?
    `);
        stmt.run(...values);
        // Update deal's lastActivityAt
        this.db.prepare('UPDATE deals SET lastActivityAt = ? WHERE id = ?').run(now, activity.dealId);
        return this.findById(id) || null;
    }
    markAsComplete(id) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
        UPDATE deal_activities 
        SET isDone = 1, completedAt = ?, updatedAt = ?
        WHERE id = ?
    `);
        stmt.run(now, now, id);
        const activity = this.findById(id);
        if (activity) {
            // Update deal's lastActivityAt
            this.db.prepare('UPDATE deals SET lastActivityAt = ? WHERE id = ?').run(now, activity.dealId);
        }
        return activity || null;
    }
    delete(id) {
        const stmt = this.db.prepare('DELETE FROM deal_activities WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
    addActivityNote(userId, activityId, note) {
        const stmt = this.db.prepare(`
        UPDATE deal_activities 
        SET note = ?
        WHERE id = ?
    `);
        stmt.run(note, activityId);
        return this.findById(activityId) || null;
    }
    getUpcomingActivities(userId, days = 7) {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + days);
        const stmt = this.db.prepare(`
        SELECT * FROM deal_activities 
        WHERE userId = ? 
          AND isDone = 0 
          AND startDate >= ? 
          AND startDate <= ?
        ORDER BY startDate ASC, startTime ASC
    `);
        const results = stmt.all(userId, today.toISOString().split('T')[0], futureDate.toISOString().split('T')[0]);
        return results.map(r => this.formatActivity(r));
    }
}
exports.DealActivityModel = DealActivityModel;
//# sourceMappingURL=DealActivity.js.map