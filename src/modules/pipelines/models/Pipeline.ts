import { prisma } from '../../../shared/prisma';
import { BaseEntity } from '../../../shared/types';
import { Prisma } from '@prisma/client';

export interface Pipeline extends BaseEntity {
    name: string;
    description?: string;
    userId: number;
    isDefault: boolean;
    isActive: boolean;
    dealRotting: boolean;
    ownerIds: number[];
    rottenDays: number;
}

type searchResult = {
    name: string;
    id: number;
    description?: string;
    isDefault: boolean;
    isActive: boolean;
}

export class PipelineModel {
    constructor() { }

    initialize(): void { }

    async create(data: Omit<Pipeline, 'id' | 'createdAt' | 'updatedAt' | 'ownerIds'> & { ownerIds: number[] }): Promise<Pipeline> {
        // If this is set as default, unset other defaults for these users
        if (data.isDefault) {
            // Unset for any user who is an owner of this pipeline
            await prisma.pipeline.updateMany({
                where: {
                    ownerIds: {
                        path: ['$'],
                        array_contains: data.ownerIds
                    }
                },
                data: {
                    isDefault: false
                }
            });
        }

        const pipeline = await prisma.pipeline.create({
            data: {
                name: data.name,
                description: data.description || null,
                userId: data.ownerIds[0] || 0,
                isDefault: data.isDefault,
                isActive: data.isActive,
                dealRotting: data.dealRotting,
                rottenDays: data.rottenDays,
                ownerIds: data.ownerIds as any
            }
        });

        return this.mapPrismaPipelineToPipeline(pipeline);
    }

    async findAccessiblePipelines(userId: number): Promise<Pipeline[]> {
        const rows = await prisma.pipeline.findMany({
            where: {
                OR: [
                    { userId },
                    {
                        ownerIds: {
                            array_contains: userId
                        }
                    }
                ]
            }
        });

        return rows.map((r: any) => this.mapPrismaPipelineToPipeline(r));
    }

    async findById(pipelineId: number, userId: number): Promise<Pipeline | null> {
        const result = await prisma.pipeline.findUnique({
            where: { id: pipelineId }
        });

        if (!result) return null;

        const ownerIds = (result.ownerIds as number[]) || [];
        if (result.userId !== userId && !ownerIds.includes(userId)) return null;

        return this.mapPrismaPipelineToPipeline(result);
    }

    async canUserAccessPipeline(pipelineId: number, userId: number): Promise<boolean> {
        const pipeline = await prisma.pipeline.findUnique({
            where: { id: pipelineId },
            select: { ownerIds: true, userId: true }
        });

        if (!pipeline) return false;

        const ownerIds = (pipeline.ownerIds as number[]) || [];
        return pipeline.userId === userId || ownerIds.includes(userId);
    }

    async addOwnersToPipeline(pipelineId: number, dealOwnerIds: number[]): Promise<void> {
        const pipeline = await prisma.pipeline.findUnique({
            where: { id: pipelineId },
            select: { ownerIds: true }
        });

        const existingOwners = (pipeline?.ownerIds as number[]) || [];
        const mergedOwners = Array.from(new Set([...existingOwners, ...dealOwnerIds]));

        await prisma.pipeline.update({
            where: { id: pipelineId },
            data: {
                ownerIds: mergedOwners as any,
                updatedAt: new Date()
            }
        });
    }

    async recalculatePipelineOwners(pipelineId: number): Promise<void> {
        const deals = await prisma.deal.findMany({
            where: { pipelineId, deletedAt: null },
            select: { ownerIds: true }
        });

        const ownerSet = new Set<number>();
        for (const deal of deals) {
            if (!deal.ownerIds) continue;
            (deal.ownerIds as number[]).forEach(id => ownerSet.add(id));
        }

        await prisma.pipeline.update({
            where: { id: pipelineId },
            data: {
                ownerIds: Array.from(ownerSet) as any,
                updatedAt: new Date()
            }
        });
    }

    async searchByPipelineName(name: string): Promise<searchResult[]> {
        const results = await prisma.pipeline.findMany({
            where: {
                name: { contains: name, mode: 'insensitive' }
            }
        });

        return results.map((r: any) => ({
            id: r.id,
            name: r.name,
            description: r.description || undefined,
            isDefault: r.isDefault,
            isActive: r.isActive
        }));
    }

    async findByUserId(userId: number, includeInactive: boolean = false): Promise<Pipeline[]> {
        const pipelines = await this.findAccessiblePipelines(userId);
        return pipelines.filter(p => includeInactive || p.isActive);
    }

    async update(id: number, userId: number, data: Partial<Omit<Pipeline, 'id' | 'createdAt' | 'updatedAt' | 'ownerIds'>>): Promise<Pipeline | null> {
        const pipeline = await this.findById(id, userId);
        if (!pipeline) return null;

        const updateData: any = {};

        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.isDefault !== undefined) {
            if (data.isDefault) {
                await prisma.pipeline.updateMany({
                    where: {
                        ownerIds: {
                            array_contains: pipeline.ownerIds
                        }
                    },
                    data: {
                        isDefault: false
                    }
                });
            }
            updateData.isDefault = data.isDefault;
        }
        if (data.isActive !== undefined) updateData.isActive = data.isActive;
        if (data.dealRotting !== undefined) updateData.dealRotting = data.dealRotting;
        if (data.rottenDays !== undefined) updateData.rottenDays = data.rottenDays;

        if (Object.keys(updateData).length === 0) return pipeline;

        const updated = await prisma.pipeline.update({
            where: { id },
            data: updateData
        });

        return this.mapPrismaPipelineToPipeline(updated);
    }

    async delete(id: number, userId: number): Promise<boolean> {
        const pipeline = await this.findById(id, userId);
        if (!pipeline) return false;

        const dealCount = await prisma.deal.count({
            where: { pipelineId: id, deletedAt: null }
        });
        if (dealCount > 0) {
            throw new Error('Cannot delete pipeline with existing deals');
        }

        await prisma.pipeline.delete({
            where: { id }
        });
        return true;
    }

    async getStats(pipelineId: number): Promise<{
        totalDeals: number;
        totalValue: number;
        wonDeals: number;
        wonValue: number;
        lostDeals: number;
        lostValue: number;
    }> {
        const stats = await prisma.deal.groupBy({
            by: ['status'],
            where: { pipelineId, deletedAt: null },
            _count: { _all: true },
            _sum: { value: true }
        });

        const result = {
            totalDeals: 0,
            totalValue: 0,
            wonDeals: 0,
            wonValue: 0,
            lostDeals: 0,
            lostValue: 0
        };

        stats.forEach((s: any) => {
            const count = s._count._all;
            const sum = s._sum.value || 0;
            result.totalDeals += count;
            result.totalValue += sum;
            if (s.status === 'won') {
                result.wonDeals = count;
                result.wonValue = sum;
            } else if (s.status === 'lost') {
                result.lostDeals = count;
                result.lostValue = sum;
            }
        });

        return result;
    }

    private mapPrismaPipelineToPipeline(p: any): Pipeline {
        return {
            id: p.id,
            name: p.name,
            description: p.description || undefined,
            userId: p.userId,
            isDefault: p.isDefault,
            isActive: p.isActive,
            dealRotting: p.dealRotting,
            rottenDays: p.rottenDays,
            ownerIds: (p.ownerIds as number[]) || [],
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString()
        };
    }
}
