import { Request, Response } from 'express';
import { PipelineService } from '../services/pipelineService';
import { PipelineStageService } from '../services/pipelineStageService';
import { AuthenticatedRequest } from '../../../shared/types';
import { ResponseHandler } from '../../../shared/responses/responses';

export class PipelineController {
    constructor(
        private pipelineService: PipelineService,
        private stageService: PipelineStageService
    ) { }

    // Pipeline endpoints
    async createPipeline(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
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

            return ResponseHandler.created(res, pipeline, 'Pipeline created successfully');
        } catch (error: any) {
            console.error('Error creating pipeline:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to create pipeline');
        }
    }

    async getPipelines(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { includeStages, includeInactive } = req.query;

            const pipelines = await this.pipelineService.getPipelines(
                req.user.id,
                includeStages === 'true',
                includeInactive === 'true'
            );

            return ResponseHandler.success(res, { pipelines }, 'Pipelines fetched successfully');
        } catch (error: any) {
            console.error('Error fetching pipelines:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch pipelines');
        }
    }

    async getPipelineById(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { id } = req.params;

            const pipeline = await this.pipelineService.getPipelineById(Number(id), req.user.id);

            if (!pipeline) {
                return ResponseHandler.notFound(res, 'Pipeline not found');
            }

            const updatedPipeline = await this.pipelineService.getPipelineById(Number(id), req.user.id);
            return ResponseHandler.success(res, updatedPipeline, 'Pipeline fetched successfully');
        } catch (error: any) {
            console.error('Error fetching pipeline:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch pipeline');
        }
    }

    async updatePipeline(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { id } = req.params;
            const {
                name, description, isDefault, isActive, dealRotting, rottenDays,
                stagesData, deletedStagesIds
            } = req.body;

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
                return ResponseHandler.notFound(res, 'Pipeline not found');
            }

            return ResponseHandler.success(res, pipeline, 'Pipeline updated successfully');
        } catch (error: any) {
            console.error('Error updating pipeline:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to update pipeline');
        }
    }

    async deletePipeline(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { id } = req.params;

            const result = await this.pipelineService.deletePipeline(Number(id), req.user.id);

            return ResponseHandler.success(res, result, 'Pipeline deleted successfully');
        } catch (error: any) {
            console.error('Error deleting pipeline:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to delete pipeline');
        }
    }

    // Stage endpoints
    async createStage(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { pipelineId, name, orderIndex, probability, rottenDays } = req.body;

            const stage = await this.stageService.createStage(Number(pipelineId), req.user.id, {
                name,
                orderIndex,
                probability,
                rottenDays
            });

            return ResponseHandler.created(res, stage, 'Stage created successfully');
        } catch (error: any) {
            console.error('Error creating stage:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to create stage');
        }
    }

    async getStages(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const pipelineId = req.params.pipelineId || req.body.pipelineId;

            const stages = await this.stageService.getStages(Number(pipelineId), req.user.id);

            return ResponseHandler.success(res, { stages }, 'Stages fetched successfully');
        } catch (error: any) {
            console.error('Error fetching stages:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to fetch stages');
        }
    }

    async updateStage(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { name, probability, rottenDays, pipelineId, stageId } = req.body;


            const stage = await this.stageService.updateStage(
                Number(pipelineId),
                Number(stageId),
                req.user.id,
                { name, probability, rottenDays }
            );

            if (!stage) {
                return ResponseHandler.notFound(res, 'Stage not found');
            }

            return ResponseHandler.success(res, stage, 'Stage updated successfully');
        } catch (error: any) {
            console.error('Error updating stage:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to update stage');
        }
    }

    async reorderStages(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { pipelineId } = req.params;
            const { stageOrder } = req.body;

            if (!Array.isArray(stageOrder)) {
                return ResponseHandler.validationError(res, { stageOrder: 'Must be an array of stage IDs' });
            }

            const stages = await this.stageService.reorderStages(Number(pipelineId), req.user.id, stageOrder);

            return ResponseHandler.success(res, { stages }, 'Stages reordered successfully');
        } catch (error: any) {
            console.error('Error reordering stages:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to reorder stages');
        }
    }

    async deleteStage(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { pipelineId, stageId } = req.params;
            const { moveDealsToStageId } = req.query;




            const result = await this.stageService.deleteStage(
                Number(pipelineId),
                Number(stageId),
                req.user.id,
                moveDealsToStageId ? Number(moveDealsToStageId) : undefined
            );

            return ResponseHandler.success(res, result, 'Stage deleted successfully');
        } catch (error: any) {
            console.error('Error deleting stage:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to delete stage');
        }
    }
}
