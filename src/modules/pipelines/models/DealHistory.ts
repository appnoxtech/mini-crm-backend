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

  create(data: Omit<DealHistory, 'id'>): DealHistory {
    const stmt = this.db.prepare(`
      INSERT INTO deal_history (
        dealId, userId, eventType, fromValue, toValue, fromStageId, toStageId,
        stageDuration, description, metadata, createdAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      data.metadata || null,
      data.createdAt
    );

    return this.findById(result.lastInsertRowid as number)!;
  }

  private formatHistory(result: any): DealHistory {
    return {
      ...result,
      metadata: result.metadata ? JSON.parse(result.metadata) : undefined
    };
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
