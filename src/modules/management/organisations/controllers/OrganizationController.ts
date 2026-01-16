import { Response } from 'express';
import { OrganizationService } from '../services/OrganizationService';
import { AuthenticatedRequest } from '../../../../shared/types';
import { ResponseHandler } from '../../../../shared/responses/responses';
import { CreateOrganizationData } from '../models/Organization';

export class OrganizationController {
    constructor(private organizationService: OrganizationService) { }

    async getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }

            const { q, limit = 100, offset = 0, includeDeleted } = req.query as any;

            const result = await this.organizationService.getAll({
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
            const organisation = await this.organizationService.getById(Number(id));

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

            // Pass the entire body (or only the fields you need)
            const organisationData: CreateOrganizationData = {
                name: req.body.name,
                description: req.body.description,
                website: req.body.website,
                industry: req.body.industry,
                status: req.body.status,
                emails: req.body.emails,
                phones: req.body.phones,
                annualRevenue: req.body.annualRevenue,
                numberOfEmployees: req.body.numberOfEmployees,
                linkedinProfile: req.body.linkedinProfile,
                address: req.body.address
            };

            const organisation = await this.organizationService.create(organisationData);

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
            const { name, description, website, industry, status, emails, phones, annualRevenue, numberOfEmployees, linkedinProfile, address } = req.body;

            const organisation = await this.organizationService.update(Number(id), {
                name,
                description,
                website,
                industry,
                status,
                emails,
                phones,
                annualRevenue,
                numberOfEmployees,
                linkedinProfile,
                address
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
            const success = await this.organizationService.delete(Number(id));

            if (!success) {
                return ResponseHandler.notFound(res, 'Organisation not found');
            }

            return ResponseHandler.success(res, null, 'Organisation deleted successfully');
        } catch (error) {
            console.error('Error deleting organisation:', error);
            return ResponseHandler.internalError(res, 'Failed to delete organisation');
        }
    }

    async searchByOrgName(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }

            const { q } = req.query;
            console.log(q);
            const organisations = await this.organizationService.searchByOrgName(q as string);

            return ResponseHandler.success(res, organisations);
        } catch (error) {
            console.error('Error searching organisations:', error);
            return ResponseHandler.internalError(res, 'Failed to search organisations');
        }
    }

    async restore(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }

            const { id } = req.params;
            const organisation = await this.organizationService.restore(Number(id));

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
