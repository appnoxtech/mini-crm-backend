import * as fs from 'fs';
import * as path from 'path';
import {
    ImportJob,
    ImportResult,
    ImportPreview,
    FieldMapping,
    ImportEntityType,
    ImportFileFormat,
    DuplicateHandling,
    ImportError,
    FieldDefinition
} from '../types';
import { ImportModel } from '../models/Import';
import { FileParserService } from './fileParserService';
import { PersonProcessor } from './processors/personProcessor';
import { OrganizationProcessor } from './processors/organizationProcessor';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'imports');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export class ImportService {
    private importModel: ImportModel;
    private fileParser: FileParserService;
    private processors: Map<ImportEntityType, any>;

    constructor() {
        this.importModel = new ImportModel();
        this.fileParser = new FileParserService();

        // Initialize entity processors
        this.processors = new Map<ImportEntityType, any>([
            ['person', new PersonProcessor()],
            ['organization', new OrganizationProcessor()],
        ] as [ImportEntityType, any][]);
    }

    /**
     * Upload and parse file, return preview
     */
    async uploadFile(
        userId: number,
        file: { originalname: string; buffer: Buffer; mimetype: string },
        entityType: ImportEntityType
    ): Promise<ImportPreview> {
        // Detect file format
        const fileFormat = this.fileParser.detectFormat(file.originalname);

        // Save file temporarily
        const fileName = `${Date.now()}_${userId}_${file.originalname}`;
        const filePath = path.join(UPLOAD_DIR, fileName);
        fs.writeFileSync(filePath, file.buffer);

        try {
            // Validate file size
            this.fileParser.validateFileSize(filePath, 10);

            // Parse file
            const parsedData = await this.fileParser.parse(filePath, fileFormat);

            if (parsedData.totalRows === 0) {
                throw new Error('File contains no data rows');
            }

            // Generate suggested mappings
            const suggestedMappings = this.generateSuggestedMappings(
                parsedData.headers,
                entityType
            );

            // Create import job
            const importJob = await this.importModel.create({
                userId,
                entityType,
                fileName: file.originalname,
                fileFormat,
                totalRows: parsedData.totalRows,
                filePath,
            });

            return {
                importId: importJob.id,
                headers: parsedData.headers,
                sampleRows: parsedData.sampleRows,
                totalRows: parsedData.totalRows,
                suggestedMappings,
            };
        } catch (error) {
            // Clean up file on error
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            throw error;
        }
    }

    /**
     * Validate data with current mapping
     */
    async validateMapping(
        userId: number,
        importId: number,
        mapping: FieldMapping[]
    ): Promise<{ valid: boolean; errors: ImportError[]; totalErrors: number }> {
        const job = await this.importModel.findById(importId);
        if (!job) throw new Error('Import job not found');
        if (job.userId !== userId) throw new Error('Unauthorized');

        // Update status
        await this.importModel.updateStatus(importId, 'validating');

        // Clear previous errors
        await this.importModel.clearErrors(importId);

        // Get processor
        const processor = this.processors.get(job.entityType);
        if (!processor) throw new Error(`Unsupported entity type: ${job.entityType}`);

        // Get file path
        const filePath = await this.importModel.getFilePath(importId);
        if (!filePath || !fs.existsSync(filePath)) {
            throw new Error('Import file not found');
        }

        // Parse file
        const parsedData = await this.fileParser.parse(filePath, job.fileFormat);

        const errors: ImportError[] = [];

        // Validate each row
        for (let i = 0; i < parsedData.rows.length; i++) {
            const row = parsedData.rows[i];
            if (!row) continue;
            const mappedData = this.fileParser.mapRowData(row, parsedData.headers, mapping);

            const rowErrors = processor.validate(mappedData, i + 2); // +2 for 1-indexed + header row
            errors.push(...rowErrors);

            // Also check for duplicates during validation
            try {
                const duplicateCheck = await processor.checkDuplicate(mappedData);
                if (duplicateCheck.isDuplicate) {
                    errors.push({
                        row: i + 2,
                        column: duplicateCheck.field,
                        value: duplicateCheck.value,
                        errorType: 'duplicate',
                        message: `Duplicate ${duplicateCheck.field}: ${duplicateCheck.value} (existing ID: ${duplicateCheck.existingId})`,
                    });
                }
            } catch (e) {
                // Ignore duplicate check errors during validation
            }
        }

        // Save mapping
        await this.importModel.updateMapping(importId, mapping);
        await this.importModel.updateStatus(importId, 'mapping');

        // Save errors
        if (errors.length > 0) {
            await this.importModel.addErrors(importId, errors.slice(0, 1000)); // Limit stored errors
        }

        return {
            valid: errors.filter(e => e.errorType === 'validation').length === 0,
            errors: errors.slice(0, 100), // Return first 100 errors
            totalErrors: errors.length,
        };
    }

    /**
     * Start the import process
     */
    async startImport(
        userId: number,
        importId: number,
        options: { duplicateHandling: DuplicateHandling }
    ): Promise<ImportResult> {
        const job = await this.importModel.findById(importId);
        if (!job) throw new Error('Import job not found');
        if (job.userId !== userId) throw new Error('Unauthorized');

        // Update job configuration
        await this.importModel.updateDuplicateHandling(importId, options.duplicateHandling);
        await this.importModel.updateStatus(importId, 'processing');
        await this.importModel.clearErrors(importId);

        // Get processor
        const processor = this.processors.get(job.entityType);
        if (!processor) throw new Error(`Unsupported entity type: ${job.entityType}`);

        // Get file path
        const filePath = await this.importModel.getFilePath(importId);
        if (!filePath || !fs.existsSync(filePath)) {
            throw new Error('Import file not found');
        }

        // Parse file
        const parsedData = await this.fileParser.parse(filePath, job.fileFormat);

        const result: ImportResult = {
            importId,
            status: 'processing',
            summary: {
                total: parsedData.rows.length,
                success: 0,
                errors: 0,
                skipped: 0,
                duplicates: 0,
            },
            errors: [],
            createdEntityIds: [],
        };

        // Process each row
        for (let i = 0; i < parsedData.rows.length; i++) {
            const row = parsedData.rows[i];
            if (!row) continue;
            const mappedData = this.fileParser.mapRowData(row, parsedData.headers, job.mapping);

            try {
                // Validate first
                const validationErrors = processor.validate(mappedData, i + 2);
                if (validationErrors.length > 0) {
                    result.summary.errors++;
                    result.errors.push(...validationErrors);
                    continue;
                }

                // Stage the record
                await this.importModel.addStagedRecord(importId, mappedData, i + 2);
                result.summary.success++;
            } catch (error: any) {
                result.summary.errors++;
                result.errors.push({
                    row: i + 2,
                    errorType: 'system',
                    message: error.message,
                });
            }

            // Update progress every 10 rows
            if ((i + 1) % 10 === 0 || i === parsedData.rows.length - 1) {
                await this.importModel.updateProgress(
                    importId,
                    i + 1,
                    result.summary.success,
                    result.summary.errors,
                    result.summary.skipped
                );
            }
        }

        // Finalize
        // If we have successful staged records, status is 'staged', else 'failed' or 'completed' (if 0 rows)
        if (result.summary.success > 0) {
            result.status = 'staged';
            await this.importModel.updateStatus(
                importId,
                'staged',
                result.summary.errors > 0 ? `${result.summary.errors} errors occurred during staging` : undefined
            );
        } else {
            // If everything failed validation, we mark as failed (or completed with errors)
            // But for now let's use 'failed' if 0 success, implies nothing to merge
            if (result.summary.errors > 0 || result.summary.total > 0) {
                result.status = 'failed';
                await this.importModel.updateStatus(importId, 'failed', 'No valid records to merge');
            } else {
                result.status = 'completed'; // 0 rows total?
                await this.importModel.updateStatus(importId, 'completed');
            }
        }

        // Save any remaining errors (limit to 1000)
        if (result.errors.length > 0) {
            await this.importModel.addErrors(importId, result.errors.slice(0, 1000));
        }

        // Clean up file
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (e) {
            console.error('Failed to delete import file:', e);
        }

        // Limit returned errors
        result.errors = result.errors.slice(0, 100);

        return result;
    }

    /**
     * Merge staged import data into actual tables
     */
    async mergeImport(userId: number, importId: number): Promise<ImportResult> {
        const job = await this.importModel.findById(importId);
        if (!job) throw new Error('Import job not found');
        if (job.userId !== userId) throw new Error('Unauthorized');

        if (job.status !== 'staged') {
            throw new Error(`Cannot merge import with status: ${job.status}`);
        }

        await this.importModel.updateStatus(importId, 'processing');

        // Get processor
        const processor = this.processors.get(job.entityType);
        if (!processor) throw new Error(`Unsupported entity type: ${job.entityType}`);

        // Get staged records
        const stagedRecords = await this.importModel.getStagedRecords(importId);
        const duplicateHandling = job.duplicateHandling || 'skip';

        const result: ImportResult = {
            importId,
            status: 'processing',
            summary: {
                total: stagedRecords.length,
                success: 0,
                errors: 0,
                skipped: 0,
                duplicates: 0,
            },
            errors: [],
            createdEntityIds: [],
        };

        // Process each staged record
        for (let i = 0; i < stagedRecords.length; i++) {
            const record = stagedRecords[i];
            if (!record) continue;
            const { data, rowNumber } = record;

            try {
                // Process the record (duplicate check and write)
                const processResult = await processor.process(
                    data,
                    userId,
                    duplicateHandling
                );

                if (processResult.status === 'created') {
                    result.summary.success++;
                    if (processResult.id) {
                        result.createdEntityIds.push(processResult.id);
                        // Track created record for rollback
                        await this.importModel.addRecord(importId, processResult.id, 'created');
                    }
                } else if (processResult.status === 'updated') {
                    result.summary.success++;
                    if (processResult.id) {
                        await this.importModel.addRecord(importId, processResult.id, 'updated');
                    }
                } else if (processResult.status === 'skipped') {
                    result.summary.skipped++;
                    result.summary.duplicates++;
                }
            } catch (error: any) {
                result.summary.errors++;
                result.errors.push({
                    row: rowNumber,
                    errorType: 'system',
                    message: error.message,
                });
                // Log error to DB
                await this.importModel.addError(importId, {
                    row: rowNumber,
                    errorType: 'system',
                    message: error.message
                });
            }

            // Update progress every 10 rows
            if ((i + 1) % 10 === 0 || i === stagedRecords.length - 1) {
                await this.importModel.updateProgress(
                    importId,
                    i + 1, // We are re-using processedRows to count merged rows
                    result.summary.success,
                    result.summary.errors + (job.errorCount || 0), // Accumulate
                    result.summary.skipped
                );
            }
        }

        // Finalize
        result.status = 'completed';
        const totalErrors = result.summary.errors + (job.errorCount || 0);

        await this.importModel.updateStatus(
            importId,
            'completed',
            totalErrors > 0 ? `${totalErrors} errors occurred` : undefined
        );

        // Clear staged data
        await this.importModel.clearStagedRecords(importId);

        return result;
    }

    /**
     * Get import job by ID
     */
    async getImportJob(userId: number, importId: number): Promise<ImportJob | undefined> {
        const job = await this.importModel.findById(importId);
        if (!job || job.userId !== userId) return undefined;
        return job;
    }

    /**
     * Get import history for user
     */
    async getImportHistory(userId: number, limit: number = 20, offset: number = 0): Promise<{ imports: ImportJob[]; count: number }> {
        return this.importModel.findByUserId(userId, limit, offset);
    }

    /**
     * Get import errors
     */
    async getImportErrors(userId: number, importId: number, limit: number = 100): Promise<ImportError[]> {
        const job = await this.importModel.findById(importId);
        if (!job || job.userId !== userId) {
            throw new Error('Import job not found');
        }
        return this.importModel.getErrors(importId, limit);
    }

    /**
     * Cancel/delete import
     */
    async cancelImport(userId: number, importId: number): Promise<boolean> {
        const job = await this.importModel.findById(importId);
        if (!job || job.userId !== userId) {
            throw new Error('Import job not found');
        }

        // Delete file if exists
        const filePath = await this.importModel.getFilePath(importId);
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return this.importModel.delete(importId);
    }

    /**
     * Rollback import (undo created records)
     */
    async rollbackImport(userId: number, importId: number): Promise<{ success: boolean; count: number }> {
        const job = await this.importModel.findById(importId);
        if (!job) throw new Error('Import job not found');
        if (job.userId !== userId) throw new Error('Unauthorized');

        if (job.status === 'rolled_back') {
            throw new Error('Import is already rolled back');
        }

        // Get processor
        const processor = this.processors.get(job.entityType);
        if (!processor) throw new Error(`Unsupported entity type: ${job.entityType}`);

        // Get created entity IDs
        const createdIds = await this.importModel.getCreatedEntityIds(importId);
        let deletedCount = 0;

        // Delete each entity
        for (const id of createdIds) {
            try {
                if (await processor.delete(id)) {
                    deletedCount++;
                }
            } catch (error) {
                console.error(`Failed to rollback entity ${id}:`, error);
            }
        }

        // Update status
        await this.importModel.updateStatus(importId, 'rolled_back', `Rolled back: Deleted ${deletedCount} records`);

        return {
            success: true,
            count: deletedCount,
        };
    }

    /**
     * Save import template
     */
    async saveTemplate(userId: number, name: string, entityType: ImportEntityType, mapping: FieldMapping[]): Promise<number> {
        return this.importModel.saveTemplate(userId, name, entityType, mapping);
    }

    /**
     * Get user's templates
     */
    async getTemplates(userId: number, entityType?: ImportEntityType): Promise<any[]> {
        return this.importModel.getTemplates(userId, entityType);
    }

    /**
     * Delete template
     */
    async deleteTemplate(userId: number, templateId: number): Promise<boolean> {
        return this.importModel.deleteTemplate(templateId, userId);
    }

    /**
     * Get field definitions for an entity type
     */
    getFieldDefinitions(entityType: ImportEntityType): FieldDefinition[] {
        switch (entityType) {
            case 'person':
                return PersonProcessor.getFieldDefinitions() as FieldDefinition[];
            case 'organization':
                return OrganizationProcessor.getFieldDefinitions() as FieldDefinition[];
            default:
                return [];
        }
    }

    /**
     * Generate suggested mappings based on column headers
     */
    private generateSuggestedMappings(
        headers: string[],
        entityType: ImportEntityType
    ): FieldMapping[] {
        const fieldDefinitions = this.getFieldDefinitions(entityType);
        const mappings: FieldMapping[] = [];
        const usedFields = new Set<string>();

        for (const header of headers) {
            const normalizedHeader = header.toLowerCase().trim().replace(/[_\s-]+/g, ' ');

            // Find best matching field
            let bestMatch: { name: string; required: boolean } | null = null;
            let bestScore = 0;

            for (const field of fieldDefinitions) {
                if (usedFields.has(field.name)) continue;

                // Check exact match with field name
                if (normalizedHeader === field.name.toLowerCase()) {
                    bestMatch = field;
                    bestScore = 1;
                    break;
                }

                // Check aliases
                if (field.aliases) {
                    for (const alias of field.aliases) {
                        if (normalizedHeader === alias.toLowerCase()) {
                            bestMatch = field;
                            bestScore = 1;
                            break;
                        }
                        // Partial match
                        if (normalizedHeader.includes(alias.toLowerCase()) || alias.toLowerCase().includes(normalizedHeader)) {
                            const score = Math.min(normalizedHeader.length, alias.length) / Math.max(normalizedHeader.length, alias.length);
                            if (score > bestScore && score > 0.5) {
                                bestScore = score;
                                bestMatch = field;
                            }
                        }
                    }
                }

                // Calculate similarity with field name
                const similarity = this.calculateSimilarity(normalizedHeader, field.name.toLowerCase());
                if (similarity > bestScore && similarity > 0.6) {
                    bestScore = similarity;
                    bestMatch = field;
                }
            }

            if (bestMatch) {
                mappings.push({
                    sourceColumn: header,
                    targetField: bestMatch.name,
                    isRequired: bestMatch.required,
                });
                usedFields.add(bestMatch.name);
            } else {
                // Add unmapped column
                mappings.push({
                    sourceColumn: header,
                    targetField: '',
                    isRequired: false,
                });
            }
        }

        return mappings;
    }

    /**
     * Calculate string similarity (Levenshtein-based)
     */
    private calculateSimilarity(str1: string, str2: string): number {
        const len1 = str1.length;
        const len2 = str2.length;

        if (len1 === 0) return len2 === 0 ? 1 : 0;
        if (len2 === 0) return 0;

        const matrix: number[][] = [];

        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0]![j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i]![j] = Math.min(
                    matrix[i - 1]![j]! + 1,
                    matrix[i]![j - 1]! + 1,
                    matrix[i - 1]![j - 1]! + cost
                );
            }
        }

        const distance = matrix[len1]![len2]!;
        return 1 - distance / Math.max(len1, len2);
    }

    /**
     * Generate sample CSV for entity type
     */
    generateSampleCSV(entityType: ImportEntityType): string {
        const fieldDefs = this.getFieldDefinitions(entityType);
        const headers = fieldDefs.map(f => f.name);

        let sampleData: string[][] = [];

        if (entityType === 'person') {
            sampleData = [
                ['John', 'Doe', 'john.doe@example.com', '', '+1234567890', '', 'Acme Corp', 'USA'],
                ['Jane', 'Smith', 'jane.smith@example.com', '', '+0987654321', '', 'Tech Inc', 'UK'],
            ];
        } else if (entityType === 'organization') {
            sampleData = [
                ['Acme Corporation', 'Global manufacturing company', 'Manufacturing', 'https://acme.com', 'contact@acme.com', '', '+1234567890', '', '123 Main St', 'New York', 'NY', 'USA', '10001', '5000000', '500', 'https://linkedin.com/company/acme'],
                ['Tech Industries', 'Software development company', 'Technology', 'https://tech.io', 'info@tech.io', '', '+0987654321', '', '456 Tech Ave', 'San Francisco', 'CA', 'USA', '94102', '10000000', '200', ''],
            ];
        }

        const csvLines = [headers.join(',')];
        for (const row of sampleData) {
            csvLines.push(row.map(cell => `"${cell}"`).join(','));
        }

        return csvLines.join('\n');
    }
}
