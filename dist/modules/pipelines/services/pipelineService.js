"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineService = void 0;
class PipelineService {
    pipelineModel;
    stageModel;
    constructor(pipelineModel, stageModel) {
        this.pipelineModel = pipelineModel;
        this.stageModel = stageModel;
    }
    async createPipeline(userId, data) {
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
    async getPipelines(userId, includeStages = false, includeInactive = false) {
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
    async getPipelineById(id, userId) {
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
    async updatePipeline(id, userId, data) {
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
        const pipeline = this.pipelineModel.update(id, userId, {
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
                const stage = this.stageModel.findById(Number(stageId));
                if (stage && stage.pipelineId === id) {
                    this.stageModel.delete(Number(stageId), Number(moveDealsToStageId));
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
                this.stageModel.bulkUpdate(id, stagesToUpdate);
            }
            // Create new stages
            for (const stageInfo of newStages) {
                this.stageModel.create({
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
    async deletePipeline(id, userId) {
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
    async getDefaultPipeline(userId) {
        const pipelines = this.pipelineModel.findByUserId(userId);
        return pipelines.find(p => p.isDefault) || pipelines[0] || null;
    }
}
exports.PipelineService = PipelineService;
//# sourceMappingURL=pipelineService.js.map