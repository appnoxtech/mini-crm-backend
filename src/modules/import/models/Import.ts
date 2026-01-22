import Database from 'better-sqlite3';
import { ImportJob, ImportStatus, ImportEntityType, ImportFileFormat, DuplicateHandling, FieldMapping, ImportError } from '../types';

interface ImportRow {
    id: number;
    userId: number;
    entityType: string;
    fileName: string;
    fileFormat: string;
    status: string;
    totalRows: number;
    processedRows: number;
    successCount: number;
    errorCount: number;
    skippedCount: number;
    duplicateHandling: string;
    mapping: string;  // JSON string
    filePath: string; // Temporary file path
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    errorSummary: string | null;
}

export class ImportModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        // Create imports table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS imports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        entityType TEXT NOT NULL,
        fileName TEXT NOT NULL,
        fileFormat TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        totalRows INTEGER DEFAULT 0,
        processedRows INTEGER DEFAULT 0,
        successCount INTEGER DEFAULT 0,
        errorCount INTEGER DEFAULT 0,
        skippedCount INTEGER DEFAULT 0,
        duplicateHandling TEXT DEFAULT 'skip',
        mapping TEXT,
        filePath TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        completedAt TEXT,
        errorSummary TEXT,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);

        // Create import_errors table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS import_errors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        importId INTEGER NOT NULL,
        rowNumber INTEGER NOT NULL,
        columnName TEXT,
        value TEXT,
        errorType TEXT NOT NULL,
        message TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (importId) REFERENCES imports(id) ON DELETE CASCADE
      )
    `);

        // Create import_templates table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS import_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        name TEXT NOT NULL,
        entityType TEXT NOT NULL,
        mapping TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);

        // Create import_records table to track created entries for rollback
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS import_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        importId INTEGER NOT NULL,
        entityId INTEGER NOT NULL,
        action TEXT NOT NULL, -- 'created' or 'updated'
        createdAt TEXT NOT NULL,
        FOREIGN KEY (importId) REFERENCES imports(id) ON DELETE CASCADE
      )
    `);

        // Create indexes
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_imports_userId ON imports(userId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_imports_status ON imports(status)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_imports_createdAt ON imports(createdAt)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_import_errors_importId ON import_errors(importId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_import_records_importId ON import_records(importId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_import_templates_userId ON import_templates(userId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_import_templates_entityType ON import_templates(entityType)');

        // Create import_staging table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS import_staging (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        importId INTEGER NOT NULL,
        data TEXT NOT NULL, -- JSON data
        rowNumber INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (importId) REFERENCES imports(id) ON DELETE CASCADE
      )
    `);
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_import_staging_importId ON import_staging(importId)');
    }

    private rowToImportJob(row: ImportRow): ImportJob {
        return {
            id: row.id,
            userId: row.userId,
            entityType: row.entityType as ImportEntityType,
            fileName: row.fileName,
            fileFormat: row.fileFormat as ImportFileFormat,
            status: row.status as ImportStatus,
            totalRows: row.totalRows,
            processedRows: row.processedRows,
            successCount: row.successCount,
            errorCount: row.errorCount,
            skippedCount: row.skippedCount,
            duplicateHandling: row.duplicateHandling as DuplicateHandling,
            mapping: row.mapping ? JSON.parse(row.mapping) : [],
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            completedAt: row.completedAt || undefined,
            errorSummary: row.errorSummary || undefined,
        };
    }

    create(data: {
        userId: number;
        entityType: ImportEntityType;
        fileName: string;
        fileFormat: ImportFileFormat;
        totalRows: number;
        filePath: string;
    }): ImportJob {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO imports (userId, entityType, fileName, fileFormat, totalRows, filePath, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `);

        const result = stmt.run(
            data.userId,
            data.entityType,
            data.fileName,
            data.fileFormat,
            data.totalRows,
            data.filePath,
            now,
            now
        );

        return this.findById(result.lastInsertRowid as number)!;
    }

    findById(id: number): ImportJob | undefined {
        const stmt = this.db.prepare('SELECT * FROM imports WHERE id = ?');
        const row = stmt.get(id) as ImportRow | undefined;
        return row ? this.rowToImportJob(row) : undefined;
    }

    findByUserId(userId: number, limit: number = 20, offset: number = 0): { imports: ImportJob[]; count: number } {
        const stmt = this.db.prepare(`
      SELECT * FROM imports 
      WHERE userId = ? 
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `);
        const rows = stmt.all(userId, limit, offset) as ImportRow[];

        const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM imports WHERE userId = ?');
        const countResult = countStmt.get(userId) as { count: number };

        return {
            imports: rows.map(row => this.rowToImportJob(row)),
            count: countResult.count,
        };
    }

    updateStatus(id: number, status: ImportStatus, errorSummary?: string): void {
        const now = new Date().toISOString();
        const completedAt = ['completed', 'failed', 'cancelled', 'rolled_back'].includes(status) ? now : null;

        const stmt = this.db.prepare(`
      UPDATE imports 
      SET status = ?, updatedAt = ?, completedAt = COALESCE(?, completedAt), errorSummary = ?
      WHERE id = ?
    `);
        stmt.run(status, now, completedAt, errorSummary || null, id);
    }

    updateMapping(id: number, mapping: FieldMapping[]): void {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      UPDATE imports SET mapping = ?, updatedAt = ? WHERE id = ?
    `);
        stmt.run(JSON.stringify(mapping), now, id);
    }

    updateDuplicateHandling(id: number, duplicateHandling: DuplicateHandling): void {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      UPDATE imports SET duplicateHandling = ?, updatedAt = ? WHERE id = ?
    `);
        stmt.run(duplicateHandling, now, id);
    }

    updateProgress(id: number, processedRows: number, successCount: number, errorCount: number, skippedCount: number): void {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      UPDATE imports 
      SET processedRows = ?, successCount = ?, errorCount = ?, skippedCount = ?, updatedAt = ?
      WHERE id = ?
    `);
        stmt.run(processedRows, successCount, errorCount, skippedCount, now, id);
    }

    getFilePath(id: number): string | undefined {
        const stmt = this.db.prepare('SELECT filePath FROM imports WHERE id = ?');
        const result = stmt.get(id) as { filePath: string } | undefined;
        return result?.filePath;
    }

    delete(id: number): boolean {
        const stmt = this.db.prepare('DELETE FROM imports WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    // Staging methods
    addStagedRecord(importId: number, data: any, rowNumber: number): void {
        const now = new Date().toISOString();
        const stmt = this.db.prepare('INSERT INTO import_staging (importId, data, rowNumber, createdAt) VALUES (?, ?, ?, ?)');
        stmt.run(importId, JSON.stringify(data), rowNumber, now);
    }

    getStagedRecords(importId: number): { data: any; rowNumber: number }[] {
        const stmt = this.db.prepare('SELECT data, rowNumber FROM import_staging WHERE importId = ? ORDER BY rowNumber');
        const rows = stmt.all(importId) as { data: string; rowNumber: number }[];
        return rows.map(row => ({
            data: JSON.parse(row.data),
            rowNumber: row.rowNumber,
        }));
    }

    clearStagedRecords(importId: number): void {
        this.db.prepare('DELETE FROM import_staging WHERE importId = ?').run(importId);
    }

    // Import Actions tracking (for rollback)
    addRecord(importId: number, entityId: number, action: 'created' | 'updated'): void {
        if (action !== 'created') return; // We only strictly rollback created records for now

        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO import_records (importId, entityId, action, createdAt)
      VALUES (?, ?, ?, ?)
    `);
        stmt.run(importId, entityId, action, now);
    }

    getCreatedEntityIds(importId: number): number[] {
        const stmt = this.db.prepare(`
      SELECT entityId FROM import_records 
      WHERE importId = ? AND action = 'created'
    `);
        const rows = stmt.all(importId) as { entityId: number }[];
        return rows.map(r => r.entityId);
    }

    // Import errors methods
    addError(importId: number, error: ImportError): void {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO import_errors (importId, rowNumber, columnName, value, errorType, message, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(
            importId,
            error.row,
            error.column || null,
            error.value ? String(error.value) : null,
            error.errorType,
            error.message,
            now
        );
    }

    addErrors(importId: number, errors: ImportError[]): void {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO import_errors (importId, rowNumber, columnName, value, errorType, message, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

        const insertMany = this.db.transaction((errs: ImportError[]) => {
            for (const error of errs) {
                stmt.run(
                    importId,
                    error.row,
                    error.column || null,
                    error.value ? String(error.value) : null,
                    error.errorType,
                    error.message,
                    now
                );
            }
        });

        insertMany(errors);
    }

    getErrors(importId: number, limit: number = 100): ImportError[] {
        const stmt = this.db.prepare(`
      SELECT rowNumber, columnName, value, errorType, message
      FROM import_errors 
      WHERE importId = ? 
      ORDER BY rowNumber 
      LIMIT ?
    `);
        const rows = stmt.all(importId, limit) as any[];

        return rows.map(row => ({
            row: row.rowNumber,
            column: row.columnName || undefined,
            value: row.value || undefined,
            errorType: row.errorType,
            message: row.message,
        }));
    }

    clearErrors(importId: number): void {
        const stmt = this.db.prepare('DELETE FROM import_errors WHERE importId = ?');
        stmt.run(importId);
    }

    // Template methods
    saveTemplate(userId: number, name: string, entityType: ImportEntityType, mapping: FieldMapping[]): number {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO import_templates (userId, name, entityType, mapping, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(userId, name, entityType, JSON.stringify(mapping), now, now);
        return result.lastInsertRowid as number;
    }

    getTemplates(userId: number, entityType?: ImportEntityType): any[] {
        let query = 'SELECT * FROM import_templates WHERE userId = ?';
        const params: any[] = [userId];

        if (entityType) {
            query += ' AND entityType = ?';
            params.push(entityType);
        }

        query += ' ORDER BY createdAt DESC';

        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params) as any[];

        return rows.map(row => ({
            id: row.id,
            userId: row.userId,
            name: row.name,
            entityType: row.entityType,
            mapping: JSON.parse(row.mapping),
            createdAt: row.createdAt,
        }));
    }

    deleteTemplate(id: number, userId: number): boolean {
        const stmt = this.db.prepare('DELETE FROM import_templates WHERE id = ? AND userId = ?');
        const result = stmt.run(id, userId);
        return result.changes > 0;
    }
}
