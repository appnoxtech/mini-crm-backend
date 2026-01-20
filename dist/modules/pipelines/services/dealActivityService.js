"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealActivityService = void 0;
class DealActivityService {
    activityModel;
    dealModel;
    dealHistoryModel;
    constructor(activityModel, dealModel, dealHistoryModel) {
        this.activityModel = activityModel;
        this.dealModel = dealModel;
        this.dealHistoryModel = dealHistoryModel;
    }
    async createActivity(dealId, userId, data) {
        // Verify deal exists and user has access
        const deal = this.dealModel.findById(dealId);
        if (!deal || deal.userId !== userId) {
            throw new Error('Deal not found');
        }
        // Basic validation - minimum required fields for the record
        const activityType = data.activityType || 'SubActivity';
        return this.activityModel.create({
            ...data,
            dealId,
            userId,
            activityType: activityType,
            isDone: data.isDone || false
        });
    }
    async getAllActivitiesOfDeal(dealId, filters = {}) {
        // Verify deal exists
        const deal = this.dealModel.findById(dealId);
        if (!deal) {
            throw new Error('Deal not found');
        }
        const activities = this.activityModel.findByDealId(dealId, filters);
        return {
            deal,
            activities,
            count: activities.length
        };
    }
    async createNoteActivity(userId, dealId, note) {
        return this.activityModel.createNoteActivity(userId, dealId, note);
    }
    async getActivitiesForDeal(dealId, filters = {}) {
        const activities = this.activityModel.findByDealId(dealId, filters);
        return {
            activities,
            count: activities.length
        };
    }
    async getActivitiesForUser(userId, filters = {}) {
        return this.activityModel.findByUserId(userId, filters);
    }
    async updateActivity(id, userId, data) {
        const activity = this.activityModel.findById(id);
        if (!activity || activity.userId !== userId) {
            throw new Error('Activity not found');
        }
        return this.activityModel.update(id, data);
    }
    async markActivityAsComplete(id, userId) {
        const activity = this.activityModel.findById(id);
        if (!activity || activity.userId !== userId) {
            throw new Error('Activity not found');
        }
        return this.activityModel.markAsComplete(id);
    }
    async getDealHistory(dealId, limit) {
        return this.dealHistoryModel.findByDealId(dealId, limit);
    }
    async deleteActivity(id, userId) {
        const activity = this.activityModel.findById(id);
        if (!activity || activity.userId !== userId) {
            throw new Error('Activity not found');
        }
        return this.activityModel.delete(id);
    }
    async getUpcomingActivities(userId, days = 7) {
        return this.activityModel.getUpcomingActivities(userId, days);
    }
    async createFileActivity(dealId, userId, files) {
        // Verify deal exists and user has access
        const deal = this.dealModel.findById(dealId);
        if (!deal || deal.userId !== userId) {
            throw new Error('Deal not found or access denied');
        }
        if (!files || files.length === 0) {
            throw new Error('Files are required for file activity');
        }
        return this.activityModel.createFileActivity(userId, dealId, files);
    }
}
exports.DealActivityService = DealActivityService;
//# sourceMappingURL=dealActivityService.js.map