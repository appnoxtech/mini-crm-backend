import Database from 'better-sqlite3';
import { ImportJob, ImportResult, ImportPreview, FieldMapping, ImportEntityType, DuplicateHandling, ImportError, FieldDefinition } from '../types';
export declare class ImportService {
    private db;
    private importModel;
    private fileParser;
    private processors;
    constructor(db: Database.Database);
    /**
     * Upload and parse file, return preview
     */
    uploadFile(userId: number, file: {
        originalname: string;
        buffer: Buffer;
        mimetype: string;
    }, entityType: ImportEntityType): Promise<ImportPreview>;
    /**
     * Validate data with current mapping
     */
    validateMapping(userId: number, importId: number, mapping: FieldMapping[]): Promise<{
        valid: boolean;
        errors: ImportError[];
        totalErrors: number;
    }>;
    /**
     * Start the import process
     */
    startImport(userId: number, importId: number, options: {
        duplicateHandling: DuplicateHandling;
    }): Promise<ImportResult>;
    /**
     * Get import job by ID
     */
    getImportJob(userId: number, importId: number): ImportJob | undefined;
    /**
     * Get import history for user
     */
    getImportHistory(userId: number, limit?: number, offset?: number): {
        imports: ImportJob[];
        count: number;
    };
    /**
     * Get import errors
     */
    getImportErrors(userId: number, importId: number, limit?: number): ImportError[];
    /**
     * Cancel/delete import
     */
    cancelImport(userId: number, importId: number): boolean;
    /**
     * Save import template
     */
    saveTemplate(userId: number, name: string, entityType: ImportEntityType, mapping: FieldMapping[]): number;
    /**
     * Get user's templates
     */
    getTemplates(userId: number, entityType?: ImportEntityType): any[];
    /**
     * Delete template
     */
    deleteTemplate(userId: number, templateId: number): boolean;
    /**
     * Get field definitions for an entity type
     */
    getFieldDefinitions(entityType: ImportEntityType): FieldDefinition[];
    /**
     * Generate suggested mappings based on column headers
     */
    private generateSuggestedMappings;
    /**
     * Calculate string similarity (Levenshtein-based)
     */
    private calculateSimilarity;
    /**
     * Generate sample CSV for entity type
     */
    generateSampleCSV(entityType: ImportEntityType): string;
}
//# sourceMappingURL=importService.d.ts.map