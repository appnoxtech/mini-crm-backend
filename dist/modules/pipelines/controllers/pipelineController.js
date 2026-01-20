"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineController = void 0;
const responses_1 = require("../../../shared/responses/responses");
class PipelineController {
    pipelineService;
    stageService;
    constructor(pipelineService, stageService) {
        this.pipelineService = pipelineService;
        this.stageService = stageService;
    }
    // Pipeline endpoints
    async createPipeline(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { name, description, isDefault, dealRotting, rottenDays, stagesData } = req.body;
            const pipeline = await this.pipelineService.createPipeline(req.user.id, {
                name,
                description,
                isDefault,
                dealRotting,
                rottenDays,
                stagesData
            });
            return responses_1.ResponseHandler.created(res, pipeline, 'Pipeline created successfully');
        }
        catch (error) {
            console.error('Error creating pipeline:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to create pipeline');
        }
    }
    async getPipelines(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { includeStages, includeInactive } = req.query;
            const pipelines = await this.pipelineService.getPipelines(req.user.id, includeStages === 'true', includeInactive === 'true');
            return responses_1.ResponseHandler.success(res, { pipelines }, 'Pipelines fetched successfully');
        }
        catch (error) {
            console.error('Error fetching pipelines:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch pipelines');
        }
    }
    async getPipelineById(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { id } = req.params;
            const pipeline = await this.pipelineService.getPipelineById(Number(id), req.user.id);
            if (!pipeline) {
                return responses_1.ResponseHandler.notFound(res, 'Pipeline not found');
            }
            const updatedPipeline = await this.pipelineService.getPipelineById(Number(id), req.user.id);
            return responses_1.ResponseHandler.success(res, updatedPipeline, 'Pipeline fetched successfully');
        }
        catch (error) {
            console.error('Error fetching pipeline:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch pipeline');
        }
    }
    async updatePipeline(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { id } = req.params;
            const { name, description, isDefault, isActive, dealRotting, rottenDays, stagesData, deletedStagesIds } = req.body;
            const pipeline = await this.pipelineService.updatePipeline(Number(id), req.user.id, {
                name,
                description,
                isDefault,
                isActive,
                dealRotting,
                rottenDays,
                stagesData,
                deletedStagesIds
            });
            if (!pipeline) {
                return responses_1.ResponseHandler.notFound(res, 'Pipeline not found');
            }
            return responses_1.ResponseHandler.success(res, pipeline, 'Pipeline updated successfully');
        }
        catch (error) {
            console.error('Error updating pipeline:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to update pipeline');
        }
    }
    async deletePipeline(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { id } = req.params;
            const result = await this.pipelineService.deletePipeline(Number(id), req.user.id);
            return responses_1.ResponseHandler.success(res, result, 'Pipeline deleted successfully');
        }
        catch (error) {
            console.error('Error deleting pipeline:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to delete pipeline');
        }
    }
    // Stage endpoints
    async createStage(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { pipelineId, name, orderIndex, probability, rottenDays } = req.body;
            const stage = await this.stageService.createStage(Number(pipelineId), req.user.id, {
                name,
                orderIndex,
                probability,
                rottenDays
            });
            return responses_1.ResponseHandler.created(res, stage, 'Stage created successfully');
        }
        catch (error) {
            console.error('Error creating stage:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to create stage');
        }
    }
    async getStages(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const pipelineId = req.params.pipelineId || req.body.pipelineId;
            const stages = await this.stageService.getStages(Number(pipelineId), req.user.id);
            return responses_1.ResponseHandler.success(res, { stages }, 'Stages fetched successfully');
        }
        catch (error) {
            console.error('Error fetching stages:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to fetch stages');
        }
    }
    async updateStage(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { name, probability, rottenDays, pipelineId, stageId } = req.body;
            const stage = await this.stageService.updateStage(Number(pipelineId), Number(stageId), req.user.id, { name, probability, rottenDays });
            if (!stage) {
                return responses_1.ResponseHandler.notFound(res, 'Stage not found');
            }
            return responses_1.ResponseHandler.success(res, stage, 'Stage updated successfully');
        }
        catch (error) {
            console.error('Error updating stage:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to update stage');
        }
    }
    async reorderStages(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { pipelineId } = req.params;
            const { stageOrder } = req.body;
            if (!Array.isArray(stageOrder)) {
                return responses_1.ResponseHandler.validationError(res, { stageOrder: 'Must be an array of stage IDs' });
            }
            const stages = await this.stageService.reorderStages(Number(pipelineId), req.user.id, stageOrder);
            return responses_1.ResponseHandler.success(res, { stages }, 'Stages reordered successfully');
        }
        catch (error) {
            console.error('Error reordering stages:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to reorder stages');
        }
    }
    async deleteStage(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { pipelineId, stageId } = req.params;
            const { moveDealsToStageId } = req.query;
            console.log("moveDealsToStageId ----> ", moveDealsToStageId);
            console.log("pipelineId ----> ", pipelineId);
            console.log("stageId ----> ", stageId);
            const result = await this.stageService.deleteStage(Number(pipelineId), Number(stageId), req.user.id, moveDealsToStageId ? Number(moveDealsToStageId) : undefined);
            return responses_1.ResponseHandler.success(res, result, 'Stage deleted successfully');
        }
        catch (error) {
            console.error('Error deleting stage:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to delete stage');
        }
    }
}
exports.PipelineController = PipelineController;
//# sourceMappingURL=pipelineController.js.map