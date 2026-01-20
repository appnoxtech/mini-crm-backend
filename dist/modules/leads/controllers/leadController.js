"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadController = void 0;
const responses_1 = require("../../../shared/responses/responses");
class LeadController {
    leadService;
    constructor(leadService) {
        this.leadService = leadService;
    }
    async getLeads(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const { stage, q, limit = 100, offset = 0 } = req.query;
            const result = await this.leadService.getLeads(req.user.id, {
                stage: stage,
                search: q,
                limit: Number(limit),
                offset: Number(offset)
            });
            return responses_1.ResponseHandler.success(res, result);
        }
        catch (error) {
            console.error('Error fetching leads:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch leads');
        }
    }
    async createLead(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const { name, company, value, notes } = req.body;
            const lead = await this.leadService.createLead(req.user.id, {
                name,
                company,
                value,
                notes
            });
            return responses_1.ResponseHandler.created(res, lead, "Lead Created Successfully!");
        }
        catch (error) {
            console.error('Error creating lead:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to create lead');
        }
    }
    async updateLeadStage(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const { id } = req.params;
            const { stage } = req.body;
            const lead = await this.leadService.updateLeadStage(Number(id), req.user.id, stage);
            if (!lead) {
                res.status(404).json({ error: 'Lead not found' });
                return;
            }
            return responses_1.ResponseHandler.success(res, lead, "Lead stage Update Successfully");
        }
        catch (error) {
            console.error('Error updating lead stage:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to update lead stage');
        }
    }
    async addActivity(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const { id } = req.params;
            const { type, text } = req.body;
            await this.leadService.addActivity(Number(id), req.user.id, type, text);
            return responses_1.ResponseHandler.success(res, [], 'Activity added successfully');
        }
        catch (error) {
            console.error('Error adding activity:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to add activity');
        }
    }
    async getLeadHistory(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const { id } = req.params;
            const history = await this.leadService.getLeadHistory(Number(id), req.user.id);
            return responses_1.ResponseHandler.success(res, history, 'Successfully Fetched lead history');
        }
        catch (error) {
            console.error('Error fetching lead history:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch lead history');
        }
    }
    async deleteLead(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const { id } = req.params;
            const success = await this.leadService.deleteLead(Number(id), req.user.id);
            if (!success) {
                res.status(404).json({ error: 'Lead not found' });
                return;
            }
            return responses_1.ResponseHandler.success(res, 'Lead is Deleted Successfully');
        }
        catch (error) {
            console.error('Error deleting lead:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to delete lead');
        }
    }
    async getStats(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const stats = await this.leadService.getStats(req.user.id);
            return responses_1.ResponseHandler.success(res, stats);
        }
        catch (error) {
            console.error('Error fetching stats:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch stats');
        }
    }
}
exports.LeadController = LeadController;
//# sourceMappingURL=leadController.js.map