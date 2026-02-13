import { Pipeline, PipelineModel } from '../models/Pipeline';
import { PipelineStageModel } from '../models/PipelineStage';

export class PipelineService {
    constructor(
        private pipelineModel: PipelineModel,
        private stageModel: PipelineStageModel
    ) { }

    async createPipeline(userId: number, companyId: number, data: {
        name: string;
        description?: string;
        isDefault?: boolean;
        dealRotting?: boolean;
        rottenDays?: number;
        stagesData?: Array<{
            name: string;
            probability: number;
            orderIndex: number;
        }>;
    }): Promise<Pipeline> {

        // Validation
        if (!data.name || !data.name.trim()) {
            throw new Error('Pipeline name is required');
        }

        if (data.name.length > 100) {
            throw new Error('Pipeline name must be 100 characters or less');
        }

        if (data.rottenDays && (data.rottenDays < 1 || data.rottenDays > 365)) {
            throw new Error('Rotten days must be between 1 and 365');
        }

        const pipeline = await this.pipelineModel.create({
            companyId,
            name: data.name.trim(),
            description: data.description?.trim(),
            userId,
            isDefault: data.isDefault || false,
            isActive: true,
            dealRotting: data.dealRotting || false,
            rottenDays: data.rottenDays || 30,
            ownerIds: [userId]
        });

        // Use provided stages or create default stages
        const stagesToCreate = data.stagesData && data.stagesData.length > 0
            ? [...data.stagesData].sort((a, b) => a.orderIndex - b.orderIndex)
            : [
                { name: 'Lead', probability: 10 },
                { name: 'Qualified', probability: 25 },
                { name: 'Proposal', probability: 50 },
                { name: 'Negotiation', probability: 75 },
            ];

        for (let index = 0; index < stagesToCreate.length; index++) {
            const stage = stagesToCreate[index];
            if (!stage) continue;
            await this.stageModel.create({
                companyId: pipeline.companyId,
                pipelineId: pipeline.id,
                name: stage.name,
                orderIndex: index,
                probability: stage.probability,
            });
        }

        return pipeline;
    }

    async getPipelines(userId: number, companyId: number, includeStages: boolean = false, includeInactive: boolean = false): Promise<any[]> {
        const pipelines = await this.pipelineModel.findByUserId(userId, companyId, includeInactive);

        if (!includeStages) {
            const result = [];
            for (const p of pipelines) {
                const stages = await this.stageModel.findByPipelineId(p.id, companyId);
                result.push({
                    ...p,
                    stageCount: stages.length
                });
            }
            return result;
        }

        const result = [];
        for (const p of pipelines) {
            const stages = await this.stageModel.getStageWithDealCount(p.id, companyId);
            const stats = await this.pipelineModel.getStats(p.id, companyId);

            result.push({
                ...p,
                stages,
                stageCount: stages.length,
                dealCount: stats.totalDeals,
                totalValue: stats.totalValue,
                stats
            });
        }
        return result;
    }

    async getPipelineById(id: number, companyId: number, userId: number): Promise<any | null> {
        const pipeline = await this.pipelineModel.findById(id, companyId, userId);

        if (!pipeline) {
            return null;
        }

        const stages = await this.stageModel.getStageWithDealCount(id, companyId);
        const stats = await this.pipelineModel.getStats(id, companyId);

        // Calculate conversion rate
        const conversionRate = stats.totalDeals > 0
            ? ((stats.wonDeals / (stats.wonDeals + stats.lostDeals)) * 100) || 0
            : 0;

        return {
            ...pipeline,
            stages,
            stats: {
                ...stats,
                conversionRate: Math.round(conversionRate * 10) / 10
            }
        };
    }

    async updatePipeline(id: number, companyId: number, userId: number, data: {
        name?: string;
        description?: string;
        isDefault?: boolean;
        isActive?: boolean;
        dealRotting?: boolean;
        rottenDays?: number;
        stagesData?: Array<{
            stageId?: number | null;
            name: string;
            orderIndex: number;
            probability?: number;
            rottenDays?: number;
        }>;
        deletedStagesIds?: Array<{ stageId: number, moveDealsToStageId: number }>;
    }): Promise<Pipeline | null> {
        // Validation
        if (data.name !== undefined) {
            if (!data.name.trim()) {
                throw new Error('Pipeline name cannot be empty');
            }
            if (data.name.length > 100) {
                throw new Error('Pipeline name must be 100 characters or less');
            }
        }

        if (data.rottenDays !== undefined && (data.rottenDays < 1 || data.rottenDays > 365)) {
            throw new Error('Rotten days must be between 1 and 365');
        }

        // Update pipeline basic info
        const pipeline = await this.pipelineModel.update(id, companyId, userId, {
            name: data.name,
            description: data.description,
            isDefault: data.isDefault,
            isActive: data.isActive,
            dealRotting: data.dealRotting,
            rottenDays: data.rottenDays
        });

        if (!pipeline) {
            return null;
        }

        // Handle deleted stages first
        if (data.deletedStagesIds && data.deletedStagesIds.length > 0) {
            for (const stageToDelete of data.deletedStagesIds) {
                const moveDealsToStageId = stageToDelete.moveDealsToStageId;
                const stageId = stageToDelete.stageId;

                const stage = await this.stageModel.findById(Number(stageId), companyId);
                if (stage && stage.pipelineId === id) {
                    await this.stageModel.delete(Number(stageId), companyId, Number(moveDealsToStageId));
                }
            }
        }

        // Handle stages data (add/update)
        if (data.stagesData && data.stagesData.length > 0) {
            // Separate existing stages from new ones
            const existingStages = data.stagesData.filter(s => s.stageId);
            const newStages = data.stagesData.filter(s => !s.stageId);

            // Bulk update existing stages (handles orderIndex conflicts automatically)
            if (existingStages.length > 0) {
                const stagesToUpdate = existingStages.map(s => ({
                    stageId: Number(s.stageId),
                    name: s.name,
                    orderIndex: s.orderIndex,
                    probability: s.probability,
                    rottenDays: s.rottenDays
                }));

                await this.stageModel.bulkUpdate(id, companyId, stagesToUpdate);
            }

            // Create new stages
            for (const stageInfo of newStages) {
                await this.stageModel.create({
                    companyId: pipeline.companyId,
                    pipelineId: id,
                    name: stageInfo.name,
                    orderIndex: stageInfo.orderIndex,
                    probability: stageInfo.probability || 0,
                    rottenDays: stageInfo.rottenDays
                });
            }
        }

        return pipeline;
    }

    async deletePipeline(id: number, companyId: number, userId: number): Promise<{ success: boolean; dealsAffected: number }> {

        const pipeline = await this.pipelineModel.findById(id, companyId, userId);

        if (!pipeline) {
            throw new Error('Pipeline not found');
        }

        const stats = await this.pipelineModel.getStats(id, companyId);

        if (stats.totalDeals > 0) {
            throw new Error(`Cannot delete pipeline with ${stats.totalDeals} existing deals`);
        }

        // Ensure user has at least one other pipeline
        const userPipelines = await this.pipelineModel.findByUserId(userId, companyId);
        if (userPipelines.length <= 1) {
            throw new Error('Cannot delete the only pipeline. Create another pipeline first.');
        }

        const success = await this.pipelineModel.delete(id, companyId, userId);

        return {
            success,
            dealsAffected: 0
        };
    }

    async getDefaultPipeline(userId: number, companyId: number): Promise<Pipeline | null> {
        const pipelines = await this.pipelineModel.findByUserId(userId, companyId);
        return pipelines.find(p => p.isDefault) || pipelines[0] || null;
    }
}
