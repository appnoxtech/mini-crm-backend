import { Response } from 'express';
import { LabelService } from '../services/labelService';
import { AuthenticatedRequest } from '../../../shared/types';
import { ResponseHandler } from '../../../shared/responses/responses';

export class LabelController {
    constructor(private labelService: LabelService) { }

    create = async (req: AuthenticatedRequest, res: Response) => {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const label = await this.labelService.createlabel(req.user.id, req.body);
            return ResponseHandler.created(res, label, 'label created successfully');
        } catch (error: any) {
            console.error('Error creating label:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to create label');
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

            const result = await this.labelService.getlabels(req.user.id, filters);
            return ResponseHandler.success(res, result, 'labels fetched successfully');
        } catch (error: any) {
            console.error('Error fetching labels:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to fetch labels');
        }
    };


    getAllByPipelineId = async (req: AuthenticatedRequest, res: Response) => {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const pipelineId = Number(req.params.pipelineId);
            const label = await this.labelService.getlabelByPipelineId(pipelineId, req.user.id);

            if (!label) {
                return ResponseHandler.notFound(res, 'label not found');
            }

            return ResponseHandler.success(res, label, 'label fetched successfully');
        } catch (error: any) {
            console.error('Error fetching label:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to fetch label');
        }
    };

    getAllByOrganizationId = async (req: AuthenticatedRequest, res: Response) => {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const organizationId = Number(req.params.organizationId);
            const label = await this.labelService.getlabelByOrganizationId(organizationId, req.user.id);

            if (!label) {
                return ResponseHandler.notFound(res, 'label not found');
            }

            return ResponseHandler.success(res, label, 'label fetched successfully');
        } catch (error: any) {
            console.error('Error fetching label:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to fetch label');
        }
    };

    getAllByPersonId = async (req: AuthenticatedRequest, res: Response) => {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const personId = Number(req.params.personId);
            const label = await this.labelService.getlabelByPersonId(personId, req.user.id);

            if (!label) {
                return ResponseHandler.notFound(res, 'label not found');
            }

            return ResponseHandler.success(res, label, 'label fetched successfully');
        } catch (error: any) {
            console.error('Error fetching label:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to fetch label');
        }
    };

    update = async (req: AuthenticatedRequest, res: Response) => {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const data = req.body;

            let level = [];


            for (let i = 0; i < data.length; i++) {
                const label = await this.labelService.updatelabel(data[i].id, data[i]);
                level.push(label);
            }

            if (!level) {
                return ResponseHandler.notFound(res, 'label not found');
            }

            return ResponseHandler.success(res, level, 'label updated successfully');
        } catch (error: any) {
            console.error('Error updating label:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to update label');
        }
    };

    delete = async (req: AuthenticatedRequest, res: Response) => {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const levelId = Number(req.params.levelId);
            const success = await this.labelService.deletelabel(levelId);

            if (!success) {
                return ResponseHandler.notFound(res, 'label not found');
            }

            return ResponseHandler.success(res, { success }, 'label deleted successfully');
        } catch (error: any) {
            console.error('Error deleting label:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to delete label');
        }
    };
}
