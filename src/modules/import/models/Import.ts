import { prisma } from '../../../shared/prisma';
import { ImportJob, ImportStatus, ImportEntityType, ImportFileFormat, DuplicateHandling, FieldMapping, ImportError } from '../types';

export class ImportModel {
    constructor(_db?: any) { }

    initialize(): void {
        // No-op with Prisma
    }

    private rowToImportJob(row: any): ImportJob {
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
            mapping: row.mapping ? (typeof row.mapping === 'string' ? JSON.parse(row.mapping) : row.mapping) : [],
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            completedAt: row.completedAt?.toISOString() || undefined,
            errorSummary: row.errorSummary || undefined,
        };
    }

    async create(data: {
        userId: number;
        entityType: ImportEntityType;
        fileName: string;
        fileFormat: ImportFileFormat;
        totalRows: number;
        filePath: string;
    }): Promise<ImportJob> {
        const job = await prisma.import.create({
            data: {
                userId: data.userId,
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

    async findById(id: number): Promise<ImportJob | null> {
        const row = await prisma.import.findUnique({
            where: { id }
        });
        return row ? this.rowToImportJob(row) : null;
    }

    async findByUserId(userId: number, limit: number = 20, offset: number = 0): Promise<{ imports: ImportJob[]; count: number }> {
        const [rows, count] = await Promise.all([
            prisma.import.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset
            }),
            prisma.import.count({ where: { userId } })
        ]);

        return {
            imports: rows.map((row: any) => this.rowToImportJob(row)),
            count,
        };
    }

    async updateStatus(id: number, status: ImportStatus, errorSummary?: string): Promise<void> {
        const completedAt = ['completed', 'failed', 'cancelled', 'rolled_back'].includes(status) ? new Date() : undefined;

        await prisma.import.update({
            where: { id },
            data: {
                status,
                completedAt,
                errorSummary: errorSummary || null
            }
        });
    }

    async updateMapping(id: number, mapping: FieldMapping[]): Promise<void> {
        await prisma.import.update({
            where: { id },
            data: {
                mapping: mapping as any
            }
        });
    }

    async updateDuplicateHandling(id: number, duplicateHandling: DuplicateHandling): Promise<void> {
        await prisma.import.update({
            where: { id },
            data: {
                duplicateHandling
            }
        });
    }

    async updateProgress(id: number, processedRows: number, successCount: number, errorCount: number, skippedCount: number): Promise<void> {
        await prisma.import.update({
            where: { id },
            data: {
                processedRows,
                successCount,
                errorCount,
                skippedCount
            }
        });
    }

    async getFilePath(id: number): Promise<string | null> {
        const result = await prisma.import.findUnique({
            where: { id },
            select: { filePath: true }
        });
        return result?.filePath || null;
    }

    async delete(id: number): Promise<boolean> {
        try {
            await prisma.import.delete({
                where: { id }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    // Staging methods
    async addStagedRecord(importId: number, data: any, rowNumber: number): Promise<void> {
        await prisma.importStaging.create({
            data: {
                importId,
                data: data as any,
                rowNumber
            }
        });
    }

    async getStagedRecords(importId: number): Promise<{ data: any; rowNumber: number }[]> {
        const rows = await prisma.importStaging.findMany({
            where: { importId },
            orderBy: { rowNumber: 'asc' }
        });

        return rows.map((row: any) => ({
            data: row.data,
            rowNumber: row.rowNumber,
        }));
    }

    async clearStagedRecords(importId: number): Promise<void> {
        await prisma.importStaging.deleteMany({
            where: { importId }
        });
    }

    // Import Actions tracking (for rollback)
    async addRecord(importId: number, entityId: number, action: 'created' | 'updated'): Promise<void> {
        if (action !== 'created') return;

        await prisma.importRecord.create({
            data: {
                importId,
                entityId,
                action
            }
        });
    }

    async getCreatedEntityIds(importId: number): Promise<number[]> {
        const rows = await prisma.importRecord.findMany({
            where: { importId, action: 'created' },
            select: { entityId: true }
        });
        return rows.map((r: any) => r.entityId);
    }

    // Import errors methods
    async addError(importId: number, error: ImportError): Promise<void> {
        await prisma.importError.create({
            data: {
                importId,
                rowNumber: error.row,
                columnName: error.column || null,
                value: error.value ? String(error.value) : null,
                errorType: error.errorType,
                message: error.message
            }
        });
    }

    async addErrors(importId: number, errors: ImportError[]): Promise<void> {
        await prisma.importError.createMany({
            data: errors.map(error => ({
                importId,
                rowNumber: error.row,
                columnName: error.column || null,
                value: error.value ? String(error.value) : null,
                errorType: error.errorType,
                message: error.message
            }))
        });
    }

    async getErrors(importId: number, limit: number = 100): Promise<ImportError[]> {
        const rows = await prisma.importError.findMany({
            where: { importId },
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

    async clearErrors(importId: number): Promise<void> {
        await prisma.importError.deleteMany({
            where: { importId }
        });
    }

    // Template methods
    async saveTemplate(userId: number, name: string, entityType: ImportEntityType, mapping: FieldMapping[]): Promise<number> {
        const template = await prisma.importTemplate.create({
            data: {
                userId,
                name,
                entityType,
                mapping: mapping as any
            }
        });
        return template.id;
    }

    async getTemplates(userId: number, entityType?: ImportEntityType): Promise<any[]> {
        const where: any = { userId };
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
            name: row.name,
            entityType: row.entityType,
            mapping: row.mapping,
            createdAt: row.createdAt.toISOString(),
        }));
    }

    async deleteTemplate(id: number, userId: number): Promise<boolean> {
        try {
            await prisma.importTemplate.delete({
                where: { id, userId }
            });
            return true;
        } catch (error) {
            return false;
        }
    }
}
