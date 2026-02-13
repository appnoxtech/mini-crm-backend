import { prisma } from '../../../shared/prisma';
import { BaseEntity } from '../../../shared/types';
import { Prisma } from '@prisma/client';

export interface Label extends BaseEntity {
    value: string;
    color: string;
    companyId: number;
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
                companyId: data.companyId,
                orderIndex: data.orderIndex,
                pipelineId: data.pipelineId || null,
                userId: data.userId || null,
                organizationId: data.organizationId || null,
                personId: data.personId || null
            }
        });

        return this.mapPrismaLabelToLabel(label);
    }

    async findByPipelineId(pipelineId: number, companyId: number): Promise<Label[]> {
        const rows = await prisma.label.findMany({
            where: { pipelineId, companyId }
        });
        return rows.map((r: any) => this.mapPrismaLabelToLabel(r));
    }

    async findByOrganizationId(organizationId: number, companyId: number): Promise<Label[]> {
        const rows = await prisma.label.findMany({
            where: { organizationId, companyId }
        });
        return rows.map((r: any) => this.mapPrismaLabelToLabel(r));
    }

    async findByPersonId(personId: number, companyId: number): Promise<Label[]> {
        const rows = await prisma.label.findMany({
            where: { personId, companyId }
        });
        return rows.map((r: any) => this.mapPrismaLabelToLabel(r));
    }

    async findById(id: number, companyId?: number): Promise<Label | null> {
        const label = await prisma.label.findFirst({
            where: {
                id,
                ...(companyId && { companyId })
            }
        });
        return label ? this.mapPrismaLabelToLabel(label) : null;
    }

    async findByUserId(userId: number, companyId: number, filters: {
        pipelineId?: number;
        stageId?: number;
        status?: string;
        search?: string;
        limit?: number;
        offset?: number;
    } = {}): Promise<{ label: Label[]; total: number }> {
        const where: any = { userId, companyId };

        if (filters.pipelineId) {
            where.pipelineId = filters.pipelineId;
        }

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

    async update(id: number, companyId: number, data: Partial<Label>): Promise<Label | null> {
        try {
            const updated = await prisma.label.update({
                where: {
                    id,
                    companyId
                },
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

    async delete(id: number, companyId: number): Promise<boolean> {
        try {
            await prisma.label.delete({
                where: {
                    id,
                    companyId
                }
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
            companyId: l.companyId,
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