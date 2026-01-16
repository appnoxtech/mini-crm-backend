import { Response } from 'express';
import { OrganisationService } from '../services/OrganisationService';
import { AuthenticatedRequest } from '../../../../shared/types';
import { ResponseHandler } from '../../../../shared/responses/responses';

export class OrganisationController {
    constructor(private organisationService: OrganisationService) { }

    async getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }

            const { q, limit = 100, offset = 0, includeDeleted } = req.query as any;

            const result = await this.organisationService.getAll({
                search: q as string,
                limit: Number(limit),
                offset: Number(offset),
                includeDeleted: includeDeleted === 'true'
            });

            return ResponseHandler.success(res, result);
        } catch (error) {
            console.error('Error fetching organisations:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch organisations');
        }
    }

    async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }

            const { id } = req.params;
            const organisation = await this.organisationService.getById(Number(id));

            if (!organisation) {
                return ResponseHandler.notFound(res, 'Organisation not found');
            }

            return ResponseHandler.success(res, organisation);
        } catch (error) {
            console.error('Error fetching organisation:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch organisation');
        }
    }

    async create(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }

            const { name, description, website } = req.body;

            const organisation = await this.organisationService.create({
                name,
                description,
                website: website || undefined
            });

            return ResponseHandler.created(res, organisation, 'Organisation created successfully');
        } catch (error: any) {
            console.error('Error creating organisation:', error);
            if (error.message === 'Organisation already exists') {
                return ResponseHandler.validationError(res, 'Organisation already exists');
            }
            return ResponseHandler.internalError(res, 'Failed to create organisation');
        }
    }

    async update(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }

            const { id } = req.params;
            const { name, description, website } = req.body;

            const organisation = await this.organisationService.update(Number(id), {
                name,
                description,
                website: website || undefined
            });

            if (!organisation) {
                return ResponseHandler.notFound(res, 'Organisation not found');
            }

            return ResponseHandler.success(res, organisation, 'Organisation updated successfully');
        } catch (error: any) {
            console.error('Error updating organisation:', error);
            if (error.message === 'Organisation already exists') {
                return ResponseHandler.validationError(res, 'Organisation already exists');
            }
            return ResponseHandler.internalError(res, 'Failed to update organisation');
        }
    }

    async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }

            const { id } = req.params;
            const success = await this.organisationService.delete(Number(id));

            if (!success) {
                return ResponseHandler.notFound(res, 'Organisation not found');
            }

            return ResponseHandler.success(res, null, 'Organisation deleted successfully');
        } catch (error) {
            console.error('Error deleting organisation:', error);
            return ResponseHandler.internalError(res, 'Failed to delete organisation');
        }
    }

    async restore(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }

            const { id } = req.params;
            const organisation = await this.organisationService.restore(Number(id));

            if (!organisation) {
                return ResponseHandler.notFound(res, 'Organisation not found or not deleted');
            }

            return ResponseHandler.success(res, organisation, 'Organisation restored successfully');
        } catch (error) {
            console.error('Error restoring organisation:', error);
            return ResponseHandler.internalError(res, 'Failed to restore organisation');
        }
    }
}
