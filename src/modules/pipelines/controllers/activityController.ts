import { Request, Response } from 'express';
import { DealActivityService } from '../services/dealActivityService';
import { AuthenticatedRequest } from '../../../shared/types';
import { ResponseHandler } from '../../../shared/responses/responses';

export class ActivityController {
    constructor(private activityService: DealActivityService) { }

    async createActivity(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { dealId } = req.params;

            const activity = await this.activityService.createActivity(Number(dealId), req.user.companyId, req.user.id, req.body);

            return ResponseHandler.created(res, activity, 'Activity created successfully');
        } catch (error: any) {
            console.error('Error creating activity:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to create activity');
        }
    }

    async getAllActivitiesOfDeal(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { dealId } = req.params;
            const { activityType, isDone, limit } = req.query;



            const result = await this.activityService.getAllActivitiesOfDeal(Number(dealId), req.user.companyId, {
                activityType: activityType as string,
                isDone: isDone === 'true' ? true : isDone === 'false' ? false : undefined,
                limit: limit ? Number(limit) : undefined
            });

            return ResponseHandler.success(res, result, 'Activities fetched successfully');
        } catch (error: any) {
            console.error('Error fetching activities:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to fetch activities');
        }
    }

    async createNoteActivity(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { dealId } = req.params;
            const { note } = req.body;

            const activity = await this.activityService.createNoteActivity(req.user.id, Number(dealId), req.user.companyId, note);

            return ResponseHandler.created(res, activity, 'Activity created successfully');
        } catch (error: any) {
            console.error('Error creating activity:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to create activity');
        }
    }

    async getActivitiesForDeal(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { dealId } = req.params;
            const { activityType, isDone, limit } = req.query;



            const result = await this.activityService.getActivitiesForDeal(Number(dealId), req.user.companyId, {
                activityType: activityType as string,
                isDone: isDone === 'true' ? true : isDone === 'false' ? false : undefined,
                limit: limit ? Number(limit) : undefined
            });

            return ResponseHandler.success(res, result, 'Activities fetched successfully');
        } catch (error: any) {
            console.error('Error fetching activities:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to fetch activities');
        }
    }

    async getActivitiesForUser(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { activityType, isDone, upcoming, limit } = req.query;

            const activities = await this.activityService.getActivitiesForUser(req.user.id, req.user.companyId, {
                activityType: activityType as string,
                isDone: isDone === 'true' ? true : isDone === 'false' ? false : undefined,
                upcoming: upcoming === 'true',
                limit: limit ? Number(limit) : undefined
            });

            return ResponseHandler.success(res, { activities }, 'Activities fetched successfully');
        } catch (error: any) {
            console.error('Error fetching activities:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch activities');
        }
    }

    async updateActivity(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { dealId, activityId } = req.params;

            const activity = await this.activityService.updateActivity(Number(activityId), req.user.companyId, req.user.id, req.body);

            if (!activity) {
                return ResponseHandler.notFound(res, 'Activity not found');
            }

            return ResponseHandler.success(res, activity, 'Activity updated successfully');
        } catch (error: any) {
            console.error('Error updating activity:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to update activity');
        }
    }

    async completeActivity(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { dealId, activityId } = req.params;

            const activity = await this.activityService.markActivityAsComplete(Number(activityId), req.user.companyId, req.user.id);

            if (!activity) {
                return ResponseHandler.notFound(res, 'Activity not found');
            }

            return ResponseHandler.success(res, activity, 'Activity marked as complete');
        } catch (error: any) {
            console.error('Error completing activity:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to complete activity');
        }
    }

    async deleteActivity(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { dealId, activityId } = req.params;

            const success = await this.activityService.deleteActivity(Number(activityId), req.user.companyId, req.user.id);

            if (!success) {
                return ResponseHandler.notFound(res, 'Activity not found');
            }

            return ResponseHandler.success(res, { success }, 'Activity deleted successfully');
        } catch (error: any) {
            console.error('Error deleting activity:', error);
            return ResponseHandler.internalError(res, 'Failed to delete activity');
        }
    }

    async getUpcomingActivities(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { days } = req.query;

            const activities = await this.activityService.getUpcomingActivities(
                req.user.id,
                req.user.companyId,
                days ? Number(days) : 7
            );

            return ResponseHandler.success(res, { activities }, 'Upcoming activities fetched successfully');
        } catch (error: any) {
            console.error('Error fetching upcoming activities:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch upcoming activities');
        }
    }

    async getDealHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { dealId } = req.params;

            const dealHistory = await this.activityService.getDealHistory(Number(dealId), req.user.companyId);

            if (!dealHistory) {
                return ResponseHandler.notFound(res, 'Deal history not found');
            }

            return ResponseHandler.success(res, dealHistory, 'Deal history fetched successfully');
        } catch (error: any) {
            console.error('Error fetching deal history:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch deal history');
        }
    }


    async uploadActivityFiles(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { dealId } = req.params;
            const userId = req?.user?.id;
            const files = (req as any).processedFiles;

            if (!files || files.length === 0) {
                return ResponseHandler.validationError(res, 'No files were processed');
            }



            await this.activityService.createFileActivity(Number(dealId), req.user!.companyId, Number(userId), files);

            return ResponseHandler.success(res, { dealId, files }, 'Files uploaded and processed successfully');
        } catch (error: any) {
            console.error('Error in uploadDealFiles:', error);
            return ResponseHandler.internalError(res, 'Failed to handle file upload');
        }
    }



}
