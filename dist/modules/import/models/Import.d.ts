import Database from 'better-sqlite3';
import { ImportJob, ImportStatus, ImportEntityType, ImportFileFormat, DuplicateHandling, FieldMapping, ImportError } from '../types';
export declare class ImportModel {
    private db;
    constructor(db: Database.Database);
    initialize(): void;
    private rowToImportJob;
    create(data: {
        userId: number;
        entityType: ImportEntityType;
        fileName: string;
        fileFormat: ImportFileFormat;
        totalRows: number;
        filePath: string;
    }): ImportJob;
    findById(id: number): ImportJob | undefined;
    findByUserId(userId: number, limit?: number, offset?: number): {
        imports: ImportJob[];
        count: number;
    };
    updateStatus(id: number, status: ImportStatus, errorSummary?: string): void;
    updateMapping(id: number, mapping: FieldMapping[]): void;
    updateDuplicateHandling(id: number, duplicateHandling: DuplicateHandling): void;
    updateProgress(id: number, processedRows: number, successCount: number, errorCount: number, skippedCount: number): void;
    getFilePath(id: number): string | undefined;
    delete(id: number): boolean;
    addStagedRecord(importId: number, data: any, rowNumber: number): void;
    getStagedRecords(importId: number): {
        data: any;
        rowNumber: number;
    }[];
    clearStagedRecords(importId: number): void;
    addRecord(importId: number, entityId: number, action: 'created' | 'updated'): void;
    getCreatedEntityIds(importId: number): number[];
    addError(importId: number, error: ImportError): void;
    addErrors(importId: number, errors: ImportError[]): void;
    getErrors(importId: number, limit?: number): ImportError[];
    clearErrors(importId: number): void;
    saveTemplate(userId: number, name: string, entityType: ImportEntityType, mapping: FieldMapping[]): number;
    getTemplates(userId: number, entityType?: ImportEntityType): any[];
    deleteTemplate(id: number, userId: number): boolean;
}
//# sourceMappingURL=Import.d.ts.map