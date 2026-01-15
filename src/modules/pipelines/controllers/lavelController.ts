import { Response } from 'express';
import { LavelService } from '../services/lavelService';
import { AuthenticatedRequest } from '../../../shared/types';
import { ResponseHandler } from '../../../shared/responses/responses';

export class LavelController {
    constructor(private lavelService: LavelService) { }

    create = async (req: AuthenticatedRequest, res: Response) => {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const lavel = await this.lavelService.createLavel(req.user.id, req.body);
            return ResponseHandler.created(res, lavel, 'Lavel created successfully');
        } catch (error: any) {
            console.error('Error creating lavel:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to create lavel');
        }
    };

    getAll = async (req: AuthenticatedRequest, res: Response) => {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const filters = {
                pipelineId: req.query.pipelineId ? Number(req.query.pipelineId) : undefined,
                search: req.query.search as string,
                page: req.query.page ? Number(req.query.page) : 1,
                limit: req.query.limit ? Number(req.query.limit) : 20
            };

            const result = await this.lavelService.getLavels(req.user.id, filters);
            return ResponseHandler.success(res, result, 'Lavels fetched successfully');
        } catch (error: any) {
            console.error('Error fetching lavels:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to fetch lavels');
        }
    };


    getAllByPipelineId = async (req: AuthenticatedRequest, res: Response) => {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const pipelineId = Number(req.params.pipelineId);
            const lavel = await this.lavelService.getLavelByPipelineId(pipelineId, req.user.id);

            if (!lavel) {
                return ResponseHandler.notFound(res, 'Lavel not found');
            }

            return ResponseHandler.success(res, lavel, 'Lavel fetched successfully');
        } catch (error: any) {
            console.error('Error fetching lavel:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to fetch lavel');
        }
    };

    update = async (req: AuthenticatedRequest, res: Response) => {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const data = req.body;

            let level = [];
            console.log(data);

            for (let i = 0; i < data.length; i++) {
                const lavel = await this.lavelService.updateLavel(data[i].id, data[i]);
                level.push(lavel);
            }

            if (!level) {
                return ResponseHandler.notFound(res, 'Lavel not found');
            }

            return ResponseHandler.success(res, level, 'Lavel updated successfully');
        } catch (error: any) {
            console.error('Error updating lavel:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to update lavel');
        }
    };

    delete = async (req: AuthenticatedRequest, res: Response) => {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const levelId = Number(req.params.levelId);
            const success = await this.lavelService.deleteLavel(levelId);

            if (!success) {
                return ResponseHandler.notFound(res, 'Lavel not found');
            }

            return ResponseHandler.success(res, { success }, 'Lavel deleted successfully');
        } catch (error: any) {
            console.error('Error deleting lavel:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to delete lavel');
        }
    };
}
