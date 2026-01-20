"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabelController = void 0;
const responses_1 = require("../../../shared/responses/responses");
class LabelController {
    labelService;
    constructor(labelService) {
        this.labelService = labelService;
    }
    create = async (req, res) => {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const label = await this.labelService.createlabel(req.user.id, req.body);
            return responses_1.ResponseHandler.created(res, label, 'label created successfully');
        }
        catch (error) {
            console.error('Error creating label:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to create label');
        }
    };
    getAll = async (req, res) => {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const filters = {
                pipelineId: req.query.pipelineId ? Number(req.query.pipelineId) : undefined,
                search: req.query.search,
                page: req.query.page ? Number(req.query.page) : 1,
                limit: req.query.limit ? Number(req.query.limit) : 20
            };
            const result = await this.labelService.getlabels(req.user.id, filters);
            return responses_1.ResponseHandler.success(res, result, 'labels fetched successfully');
        }
        catch (error) {
            console.error('Error fetching labels:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to fetch labels');
        }
    };
    getAllByPipelineId = async (req, res) => {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const pipelineId = Number(req.params.pipelineId);
            const label = await this.labelService.getlabelByPipelineId(pipelineId, req.user.id);
            if (!label) {
                return responses_1.ResponseHandler.notFound(res, 'label not found');
            }
            return responses_1.ResponseHandler.success(res, label, 'label fetched successfully');
        }
        catch (error) {
            console.error('Error fetching label:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to fetch label');
        }
    };
    getAllByOrganizationId = async (req, res) => {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const organizationId = Number(req.params.organizationId);
            const label = await this.labelService.getlabelByOrganizationId(organizationId, req.user.id);
            if (!label) {
                return responses_1.ResponseHandler.notFound(res, 'label not found');
            }
            return responses_1.ResponseHandler.success(res, label, 'label fetched successfully');
        }
        catch (error) {
            console.error('Error fetching label:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to fetch label');
        }
    };
    getAllByPersonId = async (req, res) => {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const personId = Number(req.params.personId);
            const label = await this.labelService.getlabelByPersonId(personId, req.user.id);
            if (!label) {
                return responses_1.ResponseHandler.notFound(res, 'label not found');
            }
            return responses_1.ResponseHandler.success(res, label, 'label fetched successfully');
        }
        catch (error) {
            console.error('Error fetching label:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to fetch label');
        }
    };
    update = async (req, res) => {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const data = req.body;
            let level = [];
            console.log(data);
            for (let i = 0; i < data.length; i++) {
                const label = await this.labelService.updatelabel(data[i].id, data[i]);
                level.push(label);
            }
            if (!level) {
                return responses_1.ResponseHandler.notFound(res, 'label not found');
            }
            return responses_1.ResponseHandler.success(res, level, 'label updated successfully');
        }
        catch (error) {
            console.error('Error updating label:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to update label');
        }
    };
    delete = async (req, res) => {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const levelId = Number(req.params.levelId);
            const success = await this.labelService.deletelabel(levelId);
            if (!success) {
                return responses_1.ResponseHandler.notFound(res, 'label not found');
            }
            return responses_1.ResponseHandler.success(res, { success }, 'label deleted successfully');
        }
        catch (error) {
            console.error('Error deleting label:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to delete label');
        }
    };
}
exports.LabelController = LabelController;
//# sourceMappingURL=labelController.js.map