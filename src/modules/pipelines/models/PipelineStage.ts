import { prisma } from '../../../shared/prisma';
import { BaseEntity } from '../../../shared/types';
import { Prisma } from '@prisma/client';

export interface PipelineStage extends BaseEntity {
    companyId: number;
    pipelineId: number;
    name: string;
    orderIndex: number;
    rottenDays?: number;
    probability: number;
}

export type searchResult = {
    name: string;
    id: number;
    description?: string;
    isDefault?: boolean;
    isActive?: boolean;
}

export class PipelineStageModel {
    constructor() { }

    initialize(): void { }

    async create(data: Omit<PipelineStage, 'id' | 'createdAt' | 'updatedAt'>): Promise<PipelineStage> {
        const stage = await prisma.pipelineStage.create({
            data: {
                companyId: data.companyId,
                pipelineId: data.pipelineId,
                name: data.name,
                orderIndex: data.orderIndex,
                rottenDays: data.rottenDays || null,
                probability: data.probability
            }
        });

        return this.mapPrismaStageToStage(stage);
    }

    async findById(id: number, companyId?: number): Promise<PipelineStage | null> {
        const stage = await prisma.pipelineStage.findFirst({
            where: {
                id,
                ...(companyId && { companyId })
            }
        });
        return stage ? this.mapPrismaStageToStage(stage) : null;
    }

    async findByPipelineId(pipelineId: number, companyId?: number): Promise<PipelineStage[]> {
        const stages = await prisma.pipelineStage.findMany({
            where: {
                pipelineId,
                ...(companyId && { companyId })
            },
            orderBy: { orderIndex: 'asc' }
        });
        return stages.map((s: any) => this.mapPrismaStageToStage(s));
    }

    async bulkUpdate(pipelineId: number, companyId: number, stagesData: Array<{
        stageId: number;
        name: string;
        orderIndex: number;
        probability?: number;
        rottenDays?: number;
    }>): Promise<void> {
        // Step 1: Set all to negative temporary values to avoid unique constraint conflicts
        let count = 1;
        for (const stageData of stagesData) {
            await prisma.pipelineStage.update({
                where: { id: stageData.stageId, companyId },
                data: { orderIndex: -(count++) }
            });
        }

        // Step 2: Update with final values
        for (const stageData of stagesData) {
            await prisma.pipelineStage.update({
                where: { id: stageData.stageId, companyId },
                data: {
                    name: stageData.name,
                    orderIndex: stageData.orderIndex,
                    probability: stageData.probability ?? 0,
                    rottenDays: stageData.rottenDays ?? null,
                    updatedAt: new Date()
                }
            });
        }
    }

    async update(id: number, companyId: number, data: Partial<Omit<PipelineStage, 'id' | 'pipelineId' | 'createdAt' | 'updatedAt'>>): Promise<PipelineStage | null> {
        try {
            const updated = await prisma.pipelineStage.update({
                where: { id, companyId },
                data: {
                    ...(data.name !== undefined && { name: data.name }),
                    ...(data.orderIndex !== undefined && { orderIndex: data.orderIndex }),
                    ...(data.rottenDays !== undefined && { rottenDays: data.rottenDays }),
                    ...(data.probability !== undefined && { probability: data.probability }),
                    updatedAt: new Date()
                }
            });
            return this.mapPrismaStageToStage(updated);
        } catch (error) {
            return null;
        }
    }

    async reorder(pipelineId: number, companyId: number, stageOrder: number[]): Promise<void> {
        // Step 1: Temporary negative values
        for (let i = 0; i < stageOrder.length; i++) {
            await prisma.pipelineStage.update({
                where: { id: stageOrder[i], pipelineId, companyId },
                data: { orderIndex: -(i + 1) }
            });
        }

        // Step 2: Final values
        for (let i = 0; i < stageOrder.length; i++) {
            await prisma.pipelineStage.update({
                where: { id: stageOrder[i], pipelineId, companyId },
                data: { orderIndex: i }
            });
        }
    }

    async searchByStageName(name: string, companyId: number): Promise<searchResult[]> {
        const results = await prisma.pipelineStage.findMany({
            where: {
                companyId,
                name: { contains: name, mode: 'insensitive' }
            }
        });

        return results.map((r: any) => ({
            id: r.id,
            name: r.name
        } as any));
    }

    async delete(id: number, companyId: number, moveDealsToStageId?: number): Promise<boolean> {
        const stage = await this.findById(id, companyId);
        if (!stage) return false;

        const dealCount = await prisma.deal.count({
            where: { stageId: id, companyId }
        });

        if (dealCount > 0) {
            if (!moveDealsToStageId) {
                throw new Error('Cannot delete stage with existing deals. Please specify a stage to move deals to.');
            }
            await prisma.deal.updateMany({
                where: { stageId: id, companyId },
                data: { stageId: moveDealsToStageId }
            });
        }

        await prisma.pipelineStage.delete({
            where: { id, companyId }
        });
        return true;
    }

    async getStageWithDealCount(pipelineId: number, companyId: number): Promise<Array<PipelineStage & { dealCount: number; totalValue: number }>> {
        const stages = await prisma.pipelineStage.findMany({
            where: { pipelineId, companyId },
            orderBy: { orderIndex: 'asc' },
            include: {
                deals: {
                    where: { status: 'OPEN', companyId },
                    select: { value: true }
                }
            }
        });

        return stages.map((s: any) => {
            const dealCount = s.deals.length;
            const totalValue = s.deals.reduce((acc: number, d: any) => acc + (d.value || 0), 0);
            return {
                ...this.mapPrismaStageToStage(s),
                dealCount,
                totalValue
            };
        });
    }

    private mapPrismaStageToStage(s: any): PipelineStage {
        return {
            id: s.id,
            companyId: s.companyId,
            pipelineId: s.pipelineId,
            name: s.name,
            orderIndex: s.orderIndex,
            rottenDays: s.rottenDays || undefined,
            probability: s.probability,
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString()
        };
    }
}
