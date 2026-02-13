import { prisma } from '../../../shared/prisma';
import { ImportJob, ImportStatus, ImportEntityType, ImportFileFormat, DuplicateHandling, FieldMapping, ImportError } from '../types';

export class ImportModel {
    constructor() { }

    initialize(): void { }

    private rowToImportJob(row: any): ImportJob {
        return {
            id: row.id,
            userId: row.userId,
            companyId: row.companyId,
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
            mapping: row.mapping ? (typeof row.mapping === 'string' ? JSON.parse(row.mapping) : row.mapping) : [],
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            completedAt: row.completedAt?.toISOString() || undefined,
            errorSummary: row.errorSummary || undefined,
        };
    }

    async create(data: {
        userId: number;
        companyId: number;
        entityType: ImportEntityType;
        fileName: string;
        fileFormat: ImportFileFormat;
        totalRows: number;
        filePath: string;
    }): Promise<ImportJob> {
        const job = await prisma.import.create({
            data: {
                userId: data.userId,
                companyId: data.companyId,
                entityType: data.entityType,
                fileName: data.fileName,
                fileFormat: data.fileFormat,
                totalRows: data.totalRows,
                filePath: data.filePath,
                status: 'pending'
            }
        });

        return this.rowToImportJob(job);
    }

    async findById(id: number, companyId: number): Promise<ImportJob | null> {
        const row = await prisma.import.findFirst({
            where: { id, companyId }
        });
        return row ? this.rowToImportJob(row) : null;
    }

    async findByUserId(userId: number, companyId: number, limit: number = 20, offset: number = 0): Promise<{ imports: ImportJob[]; count: number }> {
        const [rows, count] = await Promise.all([
            prisma.import.findMany({
                where: { userId, companyId },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset
            }),
            prisma.import.count({ where: { userId, companyId } })
        ]);

        return {
            imports: rows.map((row: any) => this.rowToImportJob(row)),
            count,
        };
    }

    async updateStatus(id: number, companyId: number, status: ImportStatus, errorSummary?: string): Promise<void> {
        const completedAt = ['completed', 'failed', 'cancelled', 'rolled_back'].includes(status) ? new Date() : undefined;

        await prisma.import.updateMany({
            where: { id, companyId },
            data: {
                status,
                completedAt,
                errorSummary: errorSummary || null
            }
        });
    }

    async updateMapping(id: number, companyId: number, mapping: FieldMapping[]): Promise<void> {
        await prisma.import.updateMany({
            where: { id, companyId },
            data: {
                mapping: mapping as any
            }
        });
    }

    async updateDuplicateHandling(id: number, companyId: number, duplicateHandling: DuplicateHandling): Promise<void> {
        await prisma.import.updateMany({
            where: { id, companyId },
            data: {
                duplicateHandling
            }
        });
    }

    async updateProgress(id: number, companyId: number, processedRows: number, successCount: number, errorCount: number, skippedCount: number): Promise<void> {
        await prisma.import.updateMany({
            where: { id, companyId },
            data: {
                processedRows,
                successCount,
                errorCount,
                skippedCount
            }
        });
    }

    async getFilePath(id: number, companyId: number): Promise<string | null> {
        const result = await prisma.import.findFirst({
            where: { id, companyId },
            select: { filePath: true }
        });
        return result?.filePath || null;
    }

    async delete(id: number, companyId: number): Promise<boolean> {
        try {
            const result = await prisma.import.deleteMany({
                where: { id, companyId }
            });
            return result.count > 0;
        } catch (error) {
            return false;
        }
    }

    // Staging methods
    async addStagedRecord(importId: number, companyId: number, data: any, rowNumber: number): Promise<void> {
        await prisma.importStaging.create({
            data: {
                importId,
                companyId,
                data: data as any,
                rowNumber
            }
        });
    }

    async getStagedRecords(importId: number, companyId: number): Promise<{ data: any; rowNumber: number }[]> {
        const rows = await prisma.importStaging.findMany({
            where: { importId, companyId },
            orderBy: { rowNumber: 'asc' }
        });

        return rows.map((row: any) => ({
            data: row.data,
            rowNumber: row.rowNumber,
        }));
    }

    async clearStagedRecords(importId: number, companyId: number): Promise<void> {
        await prisma.importStaging.deleteMany({
            where: { importId, companyId }
        });
    }

    // Import Actions tracking (for rollback)
    async addRecord(importId: number, companyId: number, entityId: number, action: 'created' | 'updated'): Promise<void> {
        if (action !== 'created') return;

        await prisma.importRecord.create({
            data: {
                importId,
                companyId,
                entityId,
                action
            }
        });
    }

    async getCreatedEntityIds(importId: number, companyId: number): Promise<number[]> {
        const rows = await prisma.importRecord.findMany({
            where: { importId, companyId, action: 'created' },
            select: { entityId: true }
        });
        return rows.map((r: any) => r.entityId);
    }

    // Import errors methods
    async addError(importId: number, companyId: number, error: ImportError): Promise<void> {
        await prisma.importError.create({
            data: {
                importId,
                companyId,
                rowNumber: error.row,
                columnName: error.column || null,
                value: error.value ? String(error.value) : null,
                errorType: error.errorType,
                message: error.message
            }
        });
    }

    async addErrors(importId: number, companyId: number, errors: ImportError[]): Promise<void> {
        await prisma.importError.createMany({
            data: errors.map(error => ({
                importId,
                companyId,
                rowNumber: error.row,
                columnName: error.column || null,
                value: error.value ? String(error.value) : null,
                errorType: error.errorType,
                message: error.message
            }))
        });
    }

    async getErrors(importId: number, companyId: number, limit: number = 100): Promise<ImportError[]> {
        const rows = await prisma.importError.findMany({
            where: { importId, companyId },
            orderBy: { rowNumber: 'asc' },
            take: limit
        });

        return rows.map((row: any) => ({
            row: row.rowNumber,
            column: row.columnName || undefined,
            value: row.value || undefined,
            errorType: row.errorType as ImportError['errorType'],
            message: row.message,
        }));
    }

    async clearErrors(importId: number, companyId: number): Promise<void> {
        await prisma.importError.deleteMany({
            where: { importId, companyId }
        });
    }

    // Template methods
    async saveTemplate(userId: number, companyId: number, name: string, entityType: ImportEntityType, mapping: FieldMapping[]): Promise<number> {
        const template = await prisma.importTemplate.create({
            data: {
                userId,
                companyId,
                name,
                entityType,
                mapping: mapping as any
            }
        });
        return template.id;
    }

    async getTemplates(userId: number, companyId: number, entityType?: ImportEntityType): Promise<any[]> {
        const where: any = { userId, companyId };
        if (entityType) {
            where.entityType = entityType;
        }

        const rows = await prisma.importTemplate.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        return rows.map((row: any) => ({
            id: row.id,
            userId: row.userId,
            companyId: row.companyId,
            name: row.name,
            entityType: row.entityType,
            mapping: row.mapping,
            createdAt: row.createdAt.toISOString(),
        }));
    }

    async deleteTemplate(id: number, userId: number, companyId: number): Promise<boolean> {
        try {
            const result = await prisma.importTemplate.deleteMany({
                where: { id, userId, companyId }
            });
            return result.count > 0;
        } catch (error) {
            return false;
        }
    }
}
