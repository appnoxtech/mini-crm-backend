"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityController = void 0;
const responses_1 = require("../../../shared/responses/responses");
class ActivityController {
    activityService;
    constructor(activityService) {
        this.activityService = activityService;
    }
    async createActivity(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { dealId } = req.params;
            const activity = await this.activityService.createActivity(Number(dealId), req.user.id, req.body);
            return responses_1.ResponseHandler.created(res, activity, 'Activity created successfully');
        }
        catch (error) {
            console.error('Error creating activity:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to create activity');
        }
    }
    async getAllActivitiesOfDeal(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { dealId } = req.params;
            const { activityType, isDone, limit } = req.query;
            console.log("dealId", dealId);
            const result = await this.activityService.getAllActivitiesOfDeal(Number(dealId), {
                activityType: activityType,
                isDone: isDone === 'true' ? true : isDone === 'false' ? false : undefined,
                limit: limit ? Number(limit) : undefined
            });
            return responses_1.ResponseHandler.success(res, result, 'Activities fetched successfully');
        }
        catch (error) {
            console.error('Error fetching activities:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to fetch activities');
        }
    }
    async createNoteActivity(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { dealId } = req.params;
            const { note } = req.body;
            const activity = await this.activityService.createNoteActivity(req.user.id, Number(dealId), note);
            return responses_1.ResponseHandler.created(res, activity, 'Activity created successfully');
        }
        catch (error) {
            console.error('Error creating activity:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to create activity');
        }
    }
    async getActivitiesForDeal(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { dealId } = req.params;
            const { activityType, isDone, limit } = req.query;
            console.log("dealId", dealId);
            const result = await this.activityService.getActivitiesForDeal(Number(dealId), {
                activityType: activityType,
                isDone: isDone === 'true' ? true : isDone === 'false' ? false : undefined,
                limit: limit ? Number(limit) : undefined
            });
            return responses_1.ResponseHandler.success(res, result, 'Activities fetched successfully');
        }
        catch (error) {
            console.error('Error fetching activities:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to fetch activities');
        }
    }
    async getActivitiesForUser(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { activityType, isDone, upcoming, limit } = req.query;
            const activities = await this.activityService.getActivitiesForUser(req.user.id, {
                activityType: activityType,
                isDone: isDone === 'true' ? true : isDone === 'false' ? false : undefined,
                upcoming: upcoming === 'true',
                limit: limit ? Number(limit) : undefined
            });
            return responses_1.ResponseHandler.success(res, { activities }, 'Activities fetched successfully');
        }
        catch (error) {
            console.error('Error fetching activities:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch activities');
        }
    }
    async updateActivity(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { dealId, activityId } = req.params;
            const activity = await this.activityService.updateActivity(Number(activityId), req.user.id, req.body);
            if (!activity) {
                return responses_1.ResponseHandler.notFound(res, 'Activity not found');
            }
            return responses_1.ResponseHandler.success(res, activity, 'Activity updated successfully');
        }
        catch (error) {
            console.error('Error updating activity:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to update activity');
        }
    }
    async completeActivity(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { dealId, activityId } = req.params;
            const activity = await this.activityService.markActivityAsComplete(Number(activityId), req.user.id);
            if (!activity) {
                return responses_1.ResponseHandler.notFound(res, 'Activity not found');
            }
            return responses_1.ResponseHandler.success(res, activity, 'Activity marked as complete');
        }
        catch (error) {
            console.error('Error completing activity:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to complete activity');
        }
    }
    async deleteActivity(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { dealId, activityId } = req.params;
            const success = await this.activityService.deleteActivity(Number(activityId), req.user.id);
            if (!success) {
                return responses_1.ResponseHandler.notFound(res, 'Activity not found');
            }
            return responses_1.ResponseHandler.success(res, { success }, 'Activity deleted successfully');
        }
        catch (error) {
            console.error('Error deleting activity:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to delete activity');
        }
    }
    async getUpcomingActivities(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { days } = req.query;
            const activities = await this.activityService.getUpcomingActivities(req.user.id, days ? Number(days) : 7);
            return responses_1.ResponseHandler.success(res, { activities }, 'Upcoming activities fetched successfully');
        }
        catch (error) {
            console.error('Error fetching upcoming activities:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch upcoming activities');
        }
    }
    async getDealHistory(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { dealId } = req.params;
            const dealHistory = await this.activityService.getDealHistory(Number(dealId));
            if (!dealHistory) {
                return responses_1.ResponseHandler.notFound(res, 'Deal history not found');
            }
            return responses_1.ResponseHandler.success(res, dealHistory, 'Deal history fetched successfully');
        }
        catch (error) {
            console.error('Error fetching deal history:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch deal history');
        }
    }
    async uploadActivityFiles(req, res) {
        try {
            const { dealId } = req.params;
            const userId = req?.user?.id;
            const files = req.processedFiles;
            if (!files || files.length === 0) {
                return responses_1.ResponseHandler.validationError(res, 'No files were processed');
            }
            console.log("log from controller", files);
            await this.activityService.createFileActivity(Number(dealId), Number(userId), files);
            return responses_1.ResponseHandler.success(res, { dealId, files }, 'Files uploaded and processed successfully');
        }
        catch (error) {
            console.error('Error in uploadDealFiles:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to handle file upload');
        }
    }
}
exports.ActivityController = ActivityController;
//# sourceMappingURL=activityController.js.map