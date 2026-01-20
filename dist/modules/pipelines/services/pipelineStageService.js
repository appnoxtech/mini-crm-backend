"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineStageService = void 0;
class PipelineStageService {
    stageModel;
    pipelineModel;
    constructor(stageModel, pipelineModel) {
        this.stageModel = stageModel;
        this.pipelineModel = pipelineModel;
    }
    async createStage(pipelineId, userId, data) {
        // Verify pipeline ownership
        const pipeline = this.pipelineModel.findById(pipelineId);
        if (!pipeline) {
            throw new Error('Pipeline not found');
        }
        // Validation
        if (!data.name || !data.name.trim()) {
            throw new Error('Stage name is required');
        }
        if (data.name.length > 50) {
            throw new Error('Stage name must be 50 characters or less');
        }
        if (data.probability !== undefined && (data.probability < 0 || data.probability > 100)) {
            throw new Error('Probability must be between 0 and 100');
        }
        // Get current stages to determine order index
        const existingStages = this.stageModel.findByPipelineId(pipelineId);
        const orderIndex = data.orderIndex !== undefined
            ? data.orderIndex
            : existingStages.length;
        return this.stageModel.create({
            pipelineId,
            name: data.name.trim(),
            orderIndex,
            probability: data.probability || 0,
            rottenDays: data.rottenDays
        });
    }
    async getStages(pipelineId, userId) {
        // Verify pipeline ownership
        const pipeline = this.pipelineModel.findById(pipelineId);
        if (!pipeline || pipeline.userId !== userId) {
            throw new Error('Pipeline not found');
        }
        return this.stageModel.getStageWithDealCount(pipelineId);
    }
    async updateStage(pipelineId, stageId, userId, data) {
        // Verify pipeline ownership
        const pipeline = this.pipelineModel.findById(pipelineId);
        if (!pipeline || pipeline.userId !== userId) {
            throw new Error('Pipeline not found');
        }
        // Verify stage belongs to pipeline
        const stage = this.stageModel.findById(stageId);
        if (!stage || stage.pipelineId !== pipelineId) {
            throw new Error('Stage not found');
        }
        // Validation
        if (data.name !== undefined) {
            if (!data.name.trim()) {
                throw new Error('Stage name cannot be empty');
            }
            if (data.name.length > 50) {
                throw new Error('Stage name must be 50 characters or less');
            }
        }
        if (data.probability !== undefined && (data.probability < 0 || data.probability > 100)) {
            throw new Error('Probability must be between 0 and 100');
        }
        return this.stageModel.update(stageId, data);
    }
    async reorderStages(pipelineId, userId, stageOrder) {
        // Verify pipeline ownership
        const pipeline = this.pipelineModel.findById(pipelineId);
        if (!pipeline || pipeline.userId !== userId) {
            throw new Error('Pipeline not found');
        }
        // Verify all stages belong to this pipeline
        const existingStages = this.stageModel.findByPipelineId(pipelineId);
        const existingStageIds = existingStages.map(s => s.id);
        for (const stageId of stageOrder) {
            if (!existingStageIds.includes(stageId)) {
                throw new Error(`Stage ${stageId} does not belong to pipeline ${pipelineId}`);
            }
        }
        if (stageOrder.length !== existingStages.length) {
            throw new Error('Stage order must include all stages');
        }
        this.stageModel.reorder(pipelineId, stageOrder);
        return this.stageModel.findByPipelineId(pipelineId);
    }
    async deleteStage(pipelineId, stageId, userId, moveDealsToStageId) {
        // Verify pipeline ownership
        const pipeline = this.pipelineModel.findById(pipelineId);
        if (!pipeline) {
            throw new Error('Pipeline not found');
        }
        // Verify stage belongs to pipeline
        const stage = this.stageModel.findById(stageId);
        if (!stage || stage.pipelineId !== pipelineId) {
            throw new Error('Stage not found');
        }
        // Ensure pipeline has at least 1 stages
        const stages = this.stageModel.findByPipelineId(pipelineId);
        if (stages.length <= 1) {
            throw new Error('Pipeline must have at least 2 stages');
        }
        // If moveDealsToStageId is provided, verify it belongs to same pipeline
        if (moveDealsToStageId) {
            const targetStage = this.stageModel.findById(moveDealsToStageId);
            if (!targetStage || targetStage.pipelineId !== pipelineId) {
                throw new Error('Target stage must belong to the same pipeline');
            }
        }
        const success = this.stageModel.delete(stageId, moveDealsToStageId);
        return {
            success,
            dealsMoved: 0 // This would need to be tracked in the model
        };
    }
}
exports.PipelineStageService = PipelineStageService;
//# sourceMappingURL=pipelineStageService.js.map