import { Request, Response } from 'express';
import { DealService } from '../services/dealService';
import { AuthenticatedRequest } from '../../../shared/types';
import { ResponseHandler } from '../../../shared/responses/responses';
import { string } from 'zod';

export class DealController {
    constructor(private dealService: DealService) { }

    async createDeal(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const deal = await this.dealService.createDeal(req.user.id, req.body);

            return ResponseHandler.created(res, deal, 'Deal created successfully');
        } catch (error: any) {
            console.error('Error creating deal:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to create deal');
        }
    }

    async searchDeals(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const search = (req.query.search as string) || '';
            const includeDeleted = req.query.includeDeleted === 'true';

            const result = await this.dealService.searchDeals(
                req.user.id,
                search.trim(),
                includeDeleted
            );

            return ResponseHandler.success(res, result, 'Deals fetched successfully');
        } catch (error: any) {
            console.error('Error searching deals:', error);
            return ResponseHandler.internalError(res, 'Failed to search deals');
        }
    }


    async getDeals(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { pipelineId, stageId, status, search, page, limit } = req.query;

            const result = await this.dealService.getDeals(req.user.id, {
                pipelineId: pipelineId ? Number(pipelineId) : undefined,
                stageId: stageId ? Number(stageId) : undefined,
                status: status as string,
                search: search as string,
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined
            });

            return ResponseHandler.success(res, result, 'Deals fetched successfully');
        } catch (error: any) {
            console.error('Error fetching deals:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch deals');
        }
    }

    async getDealById(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { id } = req.params;

            const deal = await this.dealService.getDealById(Number(id), req.user.id);

            if (!deal) {
                return ResponseHandler.notFound(res, 'Deal not found');
            }

            return ResponseHandler.success(res, deal, 'Deal fetched successfully');
        } catch (error: any) {
            console.error('Error fetching deal:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch deal');
        }
    }

    async updateDeal(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { dealId } = req.params;

            const dealData = await this.dealService.updateDeal(Number(dealId), req.user.id, req.body);

            if (!dealData) {
                return ResponseHandler.notFound(res, 'Deal not found');
            }

            return ResponseHandler.success(res, dealData, 'Deal updated successfully');
        } catch (error: any) {
            console.error('Error updating deal:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to update deal');
        }
    }

    async moveDeal(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { dealId } = req.params;
            const { toStageId, note } = req.body;

            if (!toStageId) {
                return ResponseHandler.validationError(res, { toStageId: 'Target stage ID is required' });
            }

            const result = await this.dealService.moveDealToStage(Number(dealId), req.user.id, Number(toStageId), note);

            return ResponseHandler.success(res, result, 'Deal moved successfully');
        } catch (error: any) {
            console.error('Error moving deal:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to move deal');
        }
    }

    async closeDeal(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { dealId } = req.params;
            const { status, lostReason } = req.body;

            if (!status || !['won', 'lost'].includes(status)) {
                return ResponseHandler.validationError(res, { status: 'Status must be either "won" or "lost"' });
            }

            const deal = await this.dealService.closeDeal(Number(dealId), req.user.id, status, lostReason);

            if (!deal) {
                return ResponseHandler.notFound(res, 'Deal not found');
            }

            return ResponseHandler.success(res, deal, `Deal marked as ${status}`);
        } catch (error: any) {
            console.error('Error closing deal:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to close deal');
        }
    }

    async deleteDeal(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { dealId } = req.params;

            const success = await this.dealService.deleteDeal(Number(dealId), req.user.id);

            if (!success) {
                return ResponseHandler.notFound(res, 'Deal not found');
            }

            return ResponseHandler.success(res, { success }, 'Deal deleted successfully');
        } catch (error: any) {
            console.error('Error deleting deal:', error);
            return ResponseHandler.internalError(res, 'Failed to delete deal');
        }
    }

    async getRottenDeals(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { pipelineId } = req.query;

            const deals = await this.dealService.getRottenDeals(
                req.user.id,
                pipelineId ? Number(pipelineId) : undefined
            );

            return ResponseHandler.success(res, { deals }, 'Rotten deals fetched successfully');
        } catch (error: any) {
            console.error('Error fetching rotten deals:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch rotten deals');
        }
    }

    async makeDealAsWon(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { dealId } = req.params;

            const deal = await this.dealService.makeDealAsWon(Number(dealId), req.user.id);

            if (!deal) {
                return ResponseHandler.notFound(res, 'Deal not found');
            }

            return ResponseHandler.success(res, deal, 'Deal marked as won');
        } catch (error: any) {
            console.error('Error marking deal as won:', error);
            return ResponseHandler.internalError(res, 'Failed to mark deal as won');
        }
    }

    async makeDealAsLost(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { dealId } = req.params;
            const info = req.body;
            console.log("log from controller", info);
            const deal = await this.dealService.makeDealAsLost(Number(dealId), req.user.id, info);

            if (!deal) {
                return ResponseHandler.notFound(res, 'Deal not found');
            }

            return ResponseHandler.success(res, deal, 'Deal marked as lost');
        } catch (error: any) {
            console.error('Error marking deal as lost:', error);
            return ResponseHandler.internalError(res, 'Failed to mark deal as lost');
        }
    }

    async resetDeal(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { dealId } = req.params;

            const deal = await this.dealService.resetDeal(Number(dealId), req.user.id);

            if (!deal) {
                return ResponseHandler.notFound(res, 'Deal not found');
            }

            return ResponseHandler.success(res, deal, 'Deal reset successfully');
        } catch (error: any) {
            console.error('Error resetting deal:', error);
            return ResponseHandler.internalError(res, 'Failed to reset deal');
        }
    }
    async getDealHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { dealId } = req.params;

            const deal = await this.dealService.getDealHistory(Number(dealId));

            if (!deal) {
                return ResponseHandler.notFound(res, 'Deal not found');
            }

            return ResponseHandler.success(res, deal, 'Deal history fetched successfully');
        } catch (error: any) {
            console.error('Error fetching deal history:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch deal history');
        }
    }

    async uploadDealFiles(req: Request, res: Response): Promise<void> {
        try {
            const { dealId } = req.params;
            const files = req.processedFiles;

            if (!files || files.length === 0) {
                return ResponseHandler.validationError(res, 'No files were processed');
            }
            console.log("log from controller", files);

            return ResponseHandler.success(res, { dealId, files }, 'Files uploaded and processed successfully');
        } catch (error: any) {
            console.error('Error in uploadDealFiles:', error);
            return ResponseHandler.internalError(res, 'Failed to handle file upload');
        }
    }

    async removeLabelFromDeal(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { dealId } = req.params;
            const { labelId } = req.body;

            const deal = await this.dealService.removeLabelFromDeal(Number(dealId), Number(labelId), req.user.id);

            if (!deal) {
                return ResponseHandler.notFound(res, 'Deal not found');
            }

            return ResponseHandler.success(res, deal, 'Label removed from deal successfully');
        } catch (error: any) {
            console.error('Error removing label from deal:', error);
            return ResponseHandler.internalError(res, 'Failed to remove label from deal');
        }
    }
}
