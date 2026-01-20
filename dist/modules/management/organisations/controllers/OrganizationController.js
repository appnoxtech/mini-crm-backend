"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationController = void 0;
const responses_1 = require("../../../../shared/responses/responses");
class OrganizationController {
    organizationService;
    constructor(organizationService) {
        this.organizationService = organizationService;
    }
    async getAll(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const { q, limit = 100, offset = 0, includeDeleted } = req.query;
            const result = await this.organizationService.getAll({
                search: q,
                limit: Number(limit),
                offset: Number(offset),
                includeDeleted: includeDeleted === 'true'
            });
            return responses_1.ResponseHandler.success(res, result);
        }
        catch (error) {
            console.error('Error fetching organisations:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch organisations');
        }
    }
    async getById(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const { id } = req.params;
            const organisation = await this.organizationService.getById(Number(id));
            if (!organisation) {
                return responses_1.ResponseHandler.notFound(res, 'Organisation not found');
            }
            return responses_1.ResponseHandler.success(res, organisation);
        }
        catch (error) {
            console.error('Error fetching organisation:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch organisation');
        }
    }
    async create(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            // Pass the entire body (or only the fields you need)
            const organisationData = {
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
            return responses_1.ResponseHandler.created(res, organisation, 'Organisation created successfully');
        }
        catch (error) {
            console.error('Error creating organisation:', error);
            if (error.message === 'Organisation already exists') {
                return responses_1.ResponseHandler.validationError(res, 'Organisation already exists');
            }
            return responses_1.ResponseHandler.internalError(res, 'Failed to create organisation');
        }
    }
    async update(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
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
                return responses_1.ResponseHandler.notFound(res, 'Organisation not found');
            }
            return responses_1.ResponseHandler.success(res, organisation, 'Organisation updated successfully');
        }
        catch (error) {
            console.error('Error updating organisation:', error);
            if (error.message === 'Organisation already exists') {
                return responses_1.ResponseHandler.validationError(res, 'Organisation already exists');
            }
            return responses_1.ResponseHandler.internalError(res, 'Failed to update organisation');
        }
    }
    async delete(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const { id } = req.params;
            const success = await this.organizationService.delete(Number(id));
            if (!success) {
                return responses_1.ResponseHandler.notFound(res, 'Organisation not found');
            }
            return responses_1.ResponseHandler.success(res, null, 'Organisation deleted successfully');
        }
        catch (error) {
            console.error('Error deleting organisation:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to delete organisation');
        }
    }
    async searchByOrgName(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const { q } = req.query;
            console.log(q);
            const organisations = await this.organizationService.searchByOrgName(q);
            return responses_1.ResponseHandler.success(res, organisations);
        }
        catch (error) {
            console.error('Error searching organisations:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to search organisations');
        }
    }
    async restore(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const { id } = req.params;
            const organisation = await this.organizationService.restore(Number(id));
            if (!organisation) {
                return responses_1.ResponseHandler.notFound(res, 'Organisation not found or not deleted');
            }
            return responses_1.ResponseHandler.success(res, organisation, 'Organisation restored successfully');
        }
        catch (error) {
            console.error('Error restoring organisation:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to restore organisation');
        }
    }
}
exports.OrganizationController = OrganizationController;
//# sourceMappingURL=OrganizationController.js.map