import { prisma } from '../../../shared/prisma';
import { BaseEntity } from '../../../shared/types';
import { Prisma } from '@prisma/client';

export interface Label extends BaseEntity {
    value: string;
    color: string;
    orderIndex: number;
    pipelineId?: number;
    userId?: number;
    organizationId?: number;
    personId?: number;
}

export class LabelModel {
    constructor(_db?: any) { }

    initialize(): void {
        // No-op with Prisma
    }

    async create(data: Omit<Label, 'id' | 'createdAt' | 'updatedAt'>): Promise<Label> {
        const label = await prisma.label.create({
            data: {
                value: data.value,
                color: data.color,
                orderIndex: data.orderIndex,
                pipelineId: data.pipelineId || null,
                userId: data.userId || null,
                organizationId: data.organizationId || null,
                personId: data.personId || null
            }
        });

        return this.mapPrismaLabelToLabel(label);
    }

    async findByPipelineId(pipelineId: number): Promise<Label[]> {
        const rows = await prisma.label.findMany({
            where: { pipelineId }
        });
        return rows.map((r: any) => this.mapPrismaLabelToLabel(r));
    }

    async findByOrganizationId(organizationId: number): Promise<Label[]> {
        const rows = await prisma.label.findMany({
            where: { organizationId }
        });
        return rows.map((r: any) => this.mapPrismaLabelToLabel(r));
    }

    async findByPersonId(personId: number): Promise<Label[]> {
        const rows = await prisma.label.findMany({
            where: { personId }
        });
        return rows.map((r: any) => this.mapPrismaLabelToLabel(r));
    }

    async findById(id: number): Promise<Label | null> {
        const label = await prisma.label.findUnique({
            where: { id }
        });
        return label ? this.mapPrismaLabelToLabel(label) : null;
    }

    async findByUserId(userId: number, filters: {
        pipelineId?: number;
        stageId?: number;
        status?: string;
        search?: string;
        limit?: number;
        offset?: number;
    } = {}): Promise<{ label: Label[]; total: number }> {
        const where: any = { userId };

        if (filters.pipelineId) {
            where.pipelineId = filters.pipelineId;
        }

        // stageId is not directly on label in the new schema, if it was intended to filter by it
        // we might need a relation, but the original code was:
        // if (filters.stageId) { query += ' AND pipelineId = ?'; params.push(filters.stageId); }
        // which seems to reuse pipelineId.
        if (filters.stageId) {
            where.pipelineId = filters.stageId;
        }

        if (filters.search) {
            where.value = { contains: filters.search, mode: 'insensitive' };
        }

        const [rows, total] = await Promise.all([
            prisma.label.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: filters.limit,
                skip: filters.offset || 0
            }),
            prisma.label.count({ where })
        ]);

        return {
            label: rows.map((r: any) => this.mapPrismaLabelToLabel(r)),
            total
        };
    }

    async update(id: number, data: Partial<Label>): Promise<Label | null> {
        try {
            const updated = await prisma.label.update({
                where: { id },
                data: {
                    ...(data.value !== undefined && { value: data.value }),
                    ...(data.color !== undefined && { color: data.color }),
                    ...(data.orderIndex !== undefined && { orderIndex: data.orderIndex }),
                    ...(data.pipelineId !== undefined && { pipelineId: data.pipelineId }),
                    ...(data.userId !== undefined && { userId: data.userId }),
                    ...(data.organizationId !== undefined && { organizationId: data.organizationId }),
                    ...(data.personId !== undefined && { personId: data.personId }),
                    updatedAt: new Date()
                }
            });
            return this.mapPrismaLabelToLabel(updated);
        } catch (error) {
            return null;
        }
    }

    async delete(id: number): Promise<boolean> {
        try {
            await prisma.label.delete({
                where: { id }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    private mapPrismaLabelToLabel(l: any): Label {
        return {
            id: l.id,
            value: l.value,
            color: l.color || '',
            orderIndex: l.orderIndex,
            pipelineId: l.pipelineId || undefined,
            userId: l.userId || undefined,
            organizationId: l.organizationId || undefined,
            personId: l.personId || undefined,
            createdAt: l.createdAt.toISOString(),
            updatedAt: l.updatedAt.toISOString()
        };
    }
}