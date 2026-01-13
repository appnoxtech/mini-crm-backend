import { Pipeline, PipelineModel } from '../models/Pipeline';
import { PipelineStageModel } from '../models/PipelineStage';

export class PipelineService {
    constructor(
        private pipelineModel: PipelineModel,
        private stageModel: PipelineStageModel
    ) { }

    async createPipeline(userId: number, data: {
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

        const pipeline = this.pipelineModel.create({
            name: data.name.trim(),
            description: data.description?.trim(),
            userId,
            isDefault: data.isDefault || false,
            isActive: true,
            dealRotting: data.dealRotting || false,
            rottenDays: data.rottenDays || 30
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

        stagesToCreate.forEach((stage, index) => {
            this.stageModel.create({
                pipelineId: pipeline.id,
                name: stage.name,
                orderIndex: index,
                probability: stage.probability,
            });
        });

        return pipeline;
    }

    async getPipelines(userId: number, includeStages: boolean = false, includeInactive: boolean = false): Promise<any[]> {
        const pipelines = this.pipelineModel.findByUserId(userId, includeInactive);

        if (!includeStages) {
            return pipelines.map(p => ({
                ...p,
                stageCount: this.stageModel.findByPipelineId(p.id).length
            }));
        }

        return pipelines.map(p => {
            const stages = this.stageModel.getStageWithDealCount(p.id);
            const stats = this.pipelineModel.getStats(p.id);

            return {
                ...p,
                stages,
                stageCount: stages.length,
                dealCount: stats.totalDeals,
                totalValue: stats.totalValue,
                stats
            };
        });
    }

    async getPipelineById(id: number, userId: number): Promise<any | null> {
        const pipeline = this.pipelineModel.findById(id);

        if (!pipeline || pipeline.userId !== userId) {
            return null;
        }

        const stages = this.stageModel.getStageWithDealCount(id);
        const stats = this.pipelineModel.getStats(id);

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

    async updatePipeline(id: number, userId: number, data: {
        name?: string;
        description?: string;
        isDefault?: boolean;
        isActive?: boolean;
        dealRotting?: boolean;
        rottenDays?: number;
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

        return this.pipelineModel.update(id, userId, data);
    }

    async deletePipeline(id: number, userId: number): Promise<{ success: boolean; dealsAffected: number }> {

        const pipeline = this.pipelineModel.findById(id);

        if (!pipeline) {
            throw new Error('Pipeline not found');
        }

        const stats = this.pipelineModel.getStats(id);

        if (stats.totalDeals > 0) {
            throw new Error(`Cannot delete pipeline with ${stats.totalDeals} existing deals`);
        }

        // Ensure user has at least one other pipeline
        const userPipelines = this.pipelineModel.findByUserId(userId);
        if (userPipelines.length <= 1) {
            throw new Error('Cannot delete the only pipeline. Create another pipeline first.');
        }

        const success = this.pipelineModel.delete(id, userId);

        return {
            success,
            dealsAffected: 0
        };
    }

    async getDefaultPipeline(userId: number): Promise<Pipeline | null> {
        const pipelines = this.pipelineModel.findByUserId(userId);
        return pipelines.find(p => p.isDefault) || pipelines[0] || null;
    }
}
