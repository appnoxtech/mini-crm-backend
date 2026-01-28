import Database from 'better-sqlite3';

export interface DealHistory {
  id: number;
  dealId: number;
  userId: number;
  eventType: string;
  fromValue?: string;
  toValue?: string;
  fromStageId?: number;
  toStageId?: number;
  stageDuration?: number;
  description?: string;

  metadata?: any;
  createdAt: string;
  leftAt?: string;
}

export class DealHistoryModel {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  initialize(): void {
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
        stageDuration REAL,
        description TEXT,
        metadata TEXT,
        createdAt TEXT NOT NULL,
        leftAt TEXT,
        FOREIGN KEY (dealId) REFERENCES deals(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (fromStageId) REFERENCES pipeline_stages(id) ON DELETE SET NULL,
        FOREIGN KEY (toStageId) REFERENCES pipeline_stages(id) ON DELETE SET NULL
      )
    `);

    try {
      this.db.exec('ALTER TABLE deal_history ADD COLUMN leftAt TEXT');
    } catch (e) {
      // Column already exists
    }

    // Change stageDuration to REAL if it was INTEGER before (for partial days)
    try {
      this.db.exec('ALTER TABLE deal_history MODIFY COLUMN stageDuration REAL');
    } catch (e) {
      // Skip if not supported or already REAL
    }

    this.db.exec('CREATE INDEX IF NOT EXISTS idx_deal_history_dealId ON deal_history(dealId)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_deal_history_userId ON deal_history(userId)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_deal_history_eventType ON deal_history(eventType)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_deal_history_createdAt ON deal_history(createdAt)');
  }

  create(data: Omit<DealHistory, 'id'>): DealHistory {
    const stmt = this.db.prepare(`
      INSERT INTO deal_history (
        dealId, userId, eventType, fromValue, toValue, fromStageId, toStageId,
        stageDuration, description, metadata, createdAt, leftAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.dealId,
      data.userId,
      data.eventType,
      data.fromValue || null,
      data.toValue || null,
      data.fromStageId || null,
      data.toStageId || null,
      data.stageDuration || null,
      data.description || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      data.createdAt,
      data.leftAt || null
    );

    return this.findById(result.lastInsertRowid as number)!;
  }

  private formatHistory(result: any): DealHistory {
    const history = {
      ...result,
      metadata: result.metadata ? JSON.parse(result.metadata) : undefined
    };

    // Calculate live stage duration if it's a stage_change and not yet closed
    if (history.eventType === 'stage_change' && !history.leftAt && history.createdAt) {
      const created = new Date(history.createdAt);
      const now = new Date();
      history.stageDuration = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    }

    return history;
  }

  findById(id: number): DealHistory | undefined {
    const stmt = this.db.prepare('SELECT * FROM deal_history WHERE id = ?');
    const result = stmt.get(id) as any;
    if (!result) return undefined;

    return this.formatHistory(result);
  }

  getDealHistory(dealId: number): DealHistory[] {
    const stmt = this.db.prepare('SELECT * FROM deal_history WHERE dealId = ?');
    const results = stmt.all(dealId) as any[];
    return results.map(r => this.formatHistory(r));
  }

  // findById(id: number): DealHistory | undefined {
  //     const stmt = this.db.prepare('SELECT * FROM deal_history WHERE id = ?');
  //     return stmt.get(id) as DealHistory | undefined;
  // }

  findByDealId(dealId: number, limit?: number): DealHistory[] {
    let query = 'SELECT * FROM deal_history WHERE dealId = ? ORDER BY createdAt DESC';
    let results: any[];

    if (limit) {
      query += ' LIMIT ?';
      results = this.db.prepare(query).all(dealId, limit) as any[];
    } else {
      results = this.db.prepare(query).all(dealId) as any[];
    }

    return results.map(r => this.formatHistory(r));
  }

  findLastStageChange(dealId: number): DealHistory | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM deal_history 
      WHERE dealId = ? AND eventType = 'stage_change'
      ORDER BY createdAt DESC 
      LIMIT 1
    `);

    const result = stmt.get(dealId) as any;
    return result ? this.formatHistory(result) : undefined;
  }

  findByEventType(dealId: number, eventType: string): DealHistory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM deal_history 
      WHERE dealId = ? AND eventType = ?
      ORDER BY createdAt DESC
    `);

    const results = stmt.all(dealId, eventType) as any[];
    return results.map(r => this.formatHistory(r));
  }

  /**
   * Closes the current open stage record for a deal.
   * Calculations are in days.
   */
  closeOpenStageRecord(dealId: number, closedAt?: string): void {
    const now = closedAt || new Date().toISOString();
    const openRecords = this.db.prepare(`
      SELECT * FROM deal_history 
      WHERE dealId = ? AND eventType = 'stage_change' AND leftAt IS NULL
    `).all(dealId) as any[];

    for (const record of openRecords) {
      const created = new Date(record.createdAt);
      const left = new Date(now);
      const durationInDays = (left.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

      this.db.prepare(`
        UPDATE deal_history 
        SET leftAt = ?, stageDuration = ? 
        WHERE id = ?
      `).run(now, durationInDays, record.id);
    }
  }

  /**
   * Returns total time spent in each stage for a deal.
   * Sums historical durations + live duration for active stage.
   */
  getStageDurations(dealId: number): Array<{ stageId: number; stageName: string; totalDuration: number }> {
    const records = this.db.prepare(`
      SELECT 
        dh.toStageId as stageId,
        ps.name as stageName,
        dh.stageDuration,
        dh.createdAt,
        dh.leftAt
      FROM deal_history dh
      LEFT JOIN pipeline_stages ps ON dh.toStageId = ps.id
      WHERE dh.dealId = ? AND dh.eventType = 'stage_change'
    `).all(dealId) as any[];

    const stageMap = new Map<number, { name: string; total: number }>();
    const now = new Date();

    for (const record of records) {
      if (!record.stageId) continue;

      let duration = record.stageDuration || 0;

      // If still in this stage, add current live time
      if (!record.leftAt) {
        const created = new Date(record.createdAt);
        duration += (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      }

      const existing = stageMap.get(record.stageId) || { name: record.stageName, total: 0 };
      existing.total += duration;
      stageMap.set(record.stageId, existing);
    }

    return Array.from(stageMap.entries()).map(([id, data]) => ({
      stageId: id,
      stageName: data.name,
      totalDuration: Math.round(data.total * 100) / 100 // Round to 2 decimals
    }));
  }

  getTimeInStages(dealId: number): Array<{ stageId: number; stageName: string; duration: number }> {
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

    return stmt.all(dealId) as Array<{ stageId: number; stageName: string; duration: number }>;
  }

  delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM deal_history WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}
