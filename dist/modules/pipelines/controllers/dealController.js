"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealController = void 0;
const responses_1 = require("../../../shared/responses/responses");
class DealController {
    dealService;
    constructor(dealService) {
        this.dealService = dealService;
    }
    async createDeal(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const deal = await this.dealService.createDeal(req.user.id, req.body);
            return responses_1.ResponseHandler.created(res, deal, 'Deal created successfully');
        }
        catch (error) {
            console.error('Error creating deal:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to create deal');
        }
    }
    async searchDeals(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { search } = req.query;
            console.log(search);
            const result = await this.dealService.searchDeals(search);
            return responses_1.ResponseHandler.success(res, result, 'Deals fetched successfully');
        }
        catch (error) {
            console.error('Error searching deals:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to search deals');
        }
    }
    async getDeals(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { pipelineId, stageId, status, search, page, limit } = req.query;
            const result = await this.dealService.getDeals(req.user.id, {
                pipelineId: pipelineId ? Number(pipelineId) : undefined,
                stageId: stageId ? Number(stageId) : undefined,
                status: status,
                search: search,
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined
            });
            return responses_1.ResponseHandler.success(res, result, 'Deals fetched successfully');
        }
        catch (error) {
            console.error('Error fetching deals:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch deals');
        }
    }
    async getDealById(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { id } = req.params;
            const deal = await this.dealService.getDealById(Number(id), req.user.id);
            if (!deal) {
                return responses_1.ResponseHandler.notFound(res, 'Deal not found');
            }
            return responses_1.ResponseHandler.success(res, deal, 'Deal fetched successfully');
        }
        catch (error) {
            console.error('Error fetching deal:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch deal');
        }
    }
    async updateDeal(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { dealId } = req.params;
            const dealData = await this.dealService.updateDeal(Number(dealId), req.user.id, req.body);
            if (!dealData) {
                return responses_1.ResponseHandler.notFound(res, 'Deal not found');
            }
            return responses_1.ResponseHandler.success(res, dealData, 'Deal updated successfully');
        }
        catch (error) {
            console.error('Error updating deal:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to update deal');
        }
    }
    async moveDeal(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { dealId } = req.params;
            const { toStageId, note } = req.body;
            if (!toStageId) {
                return responses_1.ResponseHandler.validationError(res, { toStageId: 'Target stage ID is required' });
            }
            const result = await this.dealService.moveDealToStage(Number(dealId), req.user.id, Number(toStageId), note);
            return responses_1.ResponseHandler.success(res, result, 'Deal moved successfully');
        }
        catch (error) {
            console.error('Error moving deal:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to move deal');
        }
    }
    async closeDeal(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { dealId } = req.params;
            const { status, lostReason } = req.body;
            if (!status || !['won', 'lost'].includes(status)) {
                return responses_1.ResponseHandler.validationError(res, { status: 'Status must be either "won" or "lost"' });
            }
            const deal = await this.dealService.closeDeal(Number(dealId), req.user.id, status, lostReason);
            if (!deal) {
                return responses_1.ResponseHandler.notFound(res, 'Deal not found');
            }
            return responses_1.ResponseHandler.success(res, deal, `Deal marked as ${status}`);
        }
        catch (error) {
            console.error('Error closing deal:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to close deal');
        }
    }
    async deleteDeal(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { dealId } = req.params;
            const success = await this.dealService.deleteDeal(Number(dealId), req.user.id);
            if (!success) {
                return responses_1.ResponseHandler.notFound(res, 'Deal not found');
            }
            return responses_1.ResponseHandler.success(res, { success }, 'Deal deleted successfully');
        }
        catch (error) {
            console.error('Error deleting deal:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to delete deal');
        }
    }
    async getRottenDeals(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { pipelineId } = req.query;
            const deals = await this.dealService.getRottenDeals(req.user.id, pipelineId ? Number(pipelineId) : undefined);
            return responses_1.ResponseHandler.success(res, { deals }, 'Rotten deals fetched successfully');
        }
        catch (error) {
            console.error('Error fetching rotten deals:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch rotten deals');
        }
    }
    async makeDealAsWon(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { dealId } = req.params;
            const deal = await this.dealService.makeDealAsWon(Number(dealId));
            if (!deal) {
                return responses_1.ResponseHandler.notFound(res, 'Deal not found');
            }
            return responses_1.ResponseHandler.success(res, deal, 'Deal marked as won');
        }
        catch (error) {
            console.error('Error marking deal as won:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to mark deal as won');
        }
    }
    async makeDealAsLost(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { dealId } = req.params;
            const info = req.body;
            console.log("log from controller", info);
            const deal = await this.dealService.makeDealAsLost(Number(dealId), info);
            if (!deal) {
                return responses_1.ResponseHandler.notFound(res, 'Deal not found');
            }
            return responses_1.ResponseHandler.success(res, deal, 'Deal marked as lost');
        }
        catch (error) {
            console.error('Error marking deal as lost:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to mark deal as lost');
        }
    }
    async resetDeal(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { dealId } = req.params;
            const deal = await this.dealService.resetDeal(Number(dealId));
            if (!deal) {
                return responses_1.ResponseHandler.notFound(res, 'Deal not found');
            }
            return responses_1.ResponseHandler.success(res, deal, 'Deal reset successfully');
        }
        catch (error) {
            console.error('Error resetting deal:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to reset deal');
        }
    }
    async getDealHistory(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { dealId } = req.params;
            const deal = await this.dealService.getDealHistory(Number(dealId));
            if (!deal) {
                return responses_1.ResponseHandler.notFound(res, 'Deal not found');
            }
            return responses_1.ResponseHandler.success(res, deal, 'Deal history fetched successfully');
        }
        catch (error) {
            console.error('Error fetching deal history:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch deal history');
        }
    }
    async uploadDealFiles(req, res) {
        try {
            const { dealId } = req.params;
            const files = req.processedFiles;
            if (!files || files.length === 0) {
                return responses_1.ResponseHandler.validationError(res, 'No files were processed');
            }
            console.log("log from controller", files);
            return responses_1.ResponseHandler.success(res, { dealId, files }, 'Files uploaded and processed successfully');
        }
        catch (error) {
            console.error('Error in uploadDealFiles:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to handle file upload');
        }
    }
}
exports.DealController = DealController;
//# sourceMappingURL=dealController.js.map