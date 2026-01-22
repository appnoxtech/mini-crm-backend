"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const Import_1 = require("../models/Import");
const fileParserService_1 = require("./fileParserService");
const personProcessor_1 = require("./processors/personProcessor");
const organizationProcessor_1 = require("./processors/organizationProcessor");
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'imports');
// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
class ImportService {
    db;
    importModel;
    fileParser;
    processors;
    constructor(db) {
        this.db = db;
        this.importModel = new Import_1.ImportModel(db);
        this.fileParser = new fileParserService_1.FileParserService();
        // Initialize entity processors
        this.processors = new Map([
            ['person', new personProcessor_1.PersonProcessor(db)],
            ['organization', new organizationProcessor_1.OrganizationProcessor(db)],
        ]);
    }
    /**
     * Upload and parse file, return preview
     */
    async uploadFile(userId, file, entityType) {
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
            const suggestedMappings = this.generateSuggestedMappings(parsedData.headers, entityType);
            // Create import job
            const importJob = this.importModel.create({
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
        }
        catch (error) {
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
    async validateMapping(userId, importId, mapping) {
        const job = this.importModel.findById(importId);
        if (!job)
            throw new Error('Import job not found');
        if (job.userId !== userId)
            throw new Error('Unauthorized');
        // Update status
        this.importModel.updateStatus(importId, 'validating');
        // Clear previous errors
        this.importModel.clearErrors(importId);
        // Get processor
        const processor = this.processors.get(job.entityType);
        if (!processor)
            throw new Error(`Unsupported entity type: ${job.entityType}`);
        // Get file path
        const filePath = this.importModel.getFilePath(importId);
        if (!filePath || !fs.existsSync(filePath)) {
            throw new Error('Import file not found');
        }
        // Parse file
        const parsedData = await this.fileParser.parse(filePath, job.fileFormat);
        const errors = [];
        // Validate each row
        for (let i = 0; i < parsedData.rows.length; i++) {
            const row = parsedData.rows[i];
            if (!row)
                continue;
            const mappedData = this.fileParser.mapRowData(row, parsedData.headers, mapping);
            const rowErrors = processor.validate(mappedData, i + 2); // +2 for 1-indexed + header row
            errors.push(...rowErrors);
            // Also check for duplicates during validation
            try {
                const duplicateCheck = processor.checkDuplicate(mappedData);
                if (duplicateCheck.isDuplicate) {
                    errors.push({
                        row: i + 2,
                        column: duplicateCheck.field,
                        value: duplicateCheck.value,
                        errorType: 'duplicate',
                        message: `Duplicate ${duplicateCheck.field}: ${duplicateCheck.value} (existing ID: ${duplicateCheck.existingId})`,
                    });
                }
            }
            catch (e) {
                // Ignore duplicate check errors during validation
            }
        }
        // Save mapping
        this.importModel.updateMapping(importId, mapping);
        this.importModel.updateStatus(importId, 'mapping');
        // Save errors
        if (errors.length > 0) {
            this.importModel.addErrors(importId, errors.slice(0, 1000)); // Limit stored errors
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
    async startImport(userId, importId, options) {
        const job = this.importModel.findById(importId);
        if (!job)
            throw new Error('Import job not found');
        if (job.userId !== userId)
            throw new Error('Unauthorized');
        // Update job configuration
        this.importModel.updateDuplicateHandling(importId, options.duplicateHandling);
        this.importModel.updateStatus(importId, 'processing');
        this.importModel.clearErrors(importId);
        // Get processor
        const processor = this.processors.get(job.entityType);
        if (!processor)
            throw new Error(`Unsupported entity type: ${job.entityType}`);
        // Get file path
        const filePath = this.importModel.getFilePath(importId);
        if (!filePath || !fs.existsSync(filePath)) {
            throw new Error('Import file not found');
        }
        // Parse file
        const parsedData = await this.fileParser.parse(filePath, job.fileFormat);
        const result = {
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
            if (!row)
                continue;
            const mappedData = this.fileParser.mapRowData(row, parsedData.headers, job.mapping);
            try {
                // Validate first
                const validationErrors = processor.validate(mappedData, i + 2);
                if (validationErrors.length > 0) {
                    result.summary.errors++;
                    result.errors.push(...validationErrors);
                    continue;
                }
                // Process the record
                const processResult = processor.process(mappedData, userId, options.duplicateHandling);
                if (processResult.status === 'created') {
                    result.summary.success++;
                    if (processResult.id) {
                        result.createdEntityIds.push(processResult.id);
                    }
                }
                else if (processResult.status === 'updated') {
                    result.summary.success++;
                }
                else if (processResult.status === 'skipped') {
                    result.summary.skipped++;
                    result.summary.duplicates++;
                }
            }
            catch (error) {
                result.summary.errors++;
                result.errors.push({
                    row: i + 2,
                    errorType: 'system',
                    message: error.message,
                });
            }
            // Update progress every 10 rows
            if ((i + 1) % 10 === 0 || i === parsedData.rows.length - 1) {
                this.importModel.updateProgress(importId, i + 1, result.summary.success, result.summary.errors, result.summary.skipped);
            }
        }
        // Finalize
        result.status = 'completed';
        this.importModel.updateStatus(importId, 'completed', result.summary.errors > 0 ? `${result.summary.errors} errors occurred` : undefined);
        // Save any remaining errors (limit to 1000)
        if (result.errors.length > 0) {
            this.importModel.addErrors(importId, result.errors.slice(0, 1000));
        }
        // Clean up file
        try {
            fs.unlinkSync(filePath);
        }
        catch (e) {
            console.error('Failed to delete import file:', e);
        }
        // Limit returned errors
        result.errors = result.errors.slice(0, 100);
        return result;
    }
    /**
     * Get import job by ID
     */
    getImportJob(userId, importId) {
        const job = this.importModel.findById(importId);
        if (!job || job.userId !== userId)
            return undefined;
        return job;
    }
    /**
     * Get import history for user
     */
    getImportHistory(userId, limit = 20, offset = 0) {
        return this.importModel.findByUserId(userId, limit, offset);
    }
    /**
     * Get import errors
     */
    getImportErrors(userId, importId, limit = 100) {
        const job = this.importModel.findById(importId);
        if (!job || job.userId !== userId) {
            throw new Error('Import job not found');
        }
        return this.importModel.getErrors(importId, limit);
    }
    /**
     * Cancel/delete import
     */
    cancelImport(userId, importId) {
        const job = this.importModel.findById(importId);
        if (!job || job.userId !== userId) {
            throw new Error('Import job not found');
        }
        // Delete file if exists
        const filePath = this.importModel.getFilePath(importId);
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return this.importModel.delete(importId);
    }
    /**
     * Save import template
     */
    saveTemplate(userId, name, entityType, mapping) {
        return this.importModel.saveTemplate(userId, name, entityType, mapping);
    }
    /**
     * Get user's templates
     */
    getTemplates(userId, entityType) {
        return this.importModel.getTemplates(userId, entityType);
    }
    /**
     * Delete template
     */
    deleteTemplate(userId, templateId) {
        return this.importModel.deleteTemplate(templateId, userId);
    }
    /**
     * Get field definitions for an entity type
     */
    getFieldDefinitions(entityType) {
        switch (entityType) {
            case 'person':
                return personProcessor_1.PersonProcessor.getFieldDefinitions();
            case 'organization':
                return organizationProcessor_1.OrganizationProcessor.getFieldDefinitions();
            default:
                return [];
        }
    }
    /**
     * Generate suggested mappings based on column headers
     */
    generateSuggestedMappings(headers, entityType) {
        const fieldDefinitions = this.getFieldDefinitions(entityType);
        const mappings = [];
        const usedFields = new Set();
        for (const header of headers) {
            const normalizedHeader = header.toLowerCase().trim().replace(/[_\s-]+/g, ' ');
            // Find best matching field
            let bestMatch = null;
            let bestScore = 0;
            for (const field of fieldDefinitions) {
                if (usedFields.has(field.name))
                    continue;
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
            }
            else {
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
    calculateSimilarity(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        if (len1 === 0)
            return len2 === 0 ? 1 : 0;
        if (len2 === 0)
            return 0;
        const matrix = [];
        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
            }
        }
        const distance = matrix[len1][len2];
        return 1 - distance / Math.max(len1, len2);
    }
    /**
     * Generate sample CSV for entity type
     */
    generateSampleCSV(entityType) {
        const fieldDefs = this.getFieldDefinitions(entityType);
        const headers = fieldDefs.map(f => f.name);
        let sampleData = [];
        if (entityType === 'person') {
            sampleData = [
                ['John', 'Doe', 'john.doe@example.com', '', '+1234567890', '', 'Acme Corp', 'USA'],
                ['Jane', 'Smith', 'jane.smith@example.com', '', '+0987654321', '', 'Tech Inc', 'UK'],
            ];
        }
        else if (entityType === 'organization') {
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
exports.ImportService = ImportService;
//# sourceMappingURL=importService.js.map