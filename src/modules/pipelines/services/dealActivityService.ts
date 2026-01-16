import { DealActivity, DealActivityModel } from '../models/DealActivity';
import { DealHistory, DealHistoryModel } from '../models/DealHistory';
import { DealModel } from '../models/Deal';

export class DealActivityService {
    constructor(
        private activityModel: DealActivityModel,
        private dealModel: DealModel,
        private dealHistoryModel: DealHistoryModel
    ) { }

    async createActivity(dealId: number, userId: number, data: Partial<DealActivity>): Promise<DealActivity> {
        // Verify deal exists and user has access
        const deal = this.dealModel.findById(dealId);
        if (!deal || deal.userId !== userId) {
            throw new Error('Deal not found');
        }

        // Basic validation - minimum required fields for the record
        if (!data.type) {
            throw new Error('Activity type is required');
        }

        return this.activityModel.create({
            ...data,
            dealId,
            userId,
            type: data.type,
            isDone: data.isDone || false
        } as any);
    }

    async getActivitiesForDeal(dealId: number, userId: number, filters: {
        type?: string;
        isDone?: boolean;
        limit?: number;
    } = {}): Promise<{ activities: DealActivity[]; count: number }> {
        // Verify deal exists and user has access
        const deal = this.dealModel.findById(dealId);
        if (!deal || deal.userId !== userId) {
            throw new Error('Deal not found');
        }

        const activities = this.activityModel.findByDealId(dealId, filters);

        return {
            activities,
            count: activities.length
        };
    }

    async getActivitiesForUser(userId: number, filters: {
        type?: string;
        isDone?: boolean;
        upcoming?: boolean;
        limit?: number;
    } = {}): Promise<DealActivity[]> {
        return this.activityModel.findByUserId(userId, filters);
    }

    async updateActivity(id: number, userId: number, data: Partial<DealActivity>): Promise<DealActivity | null> {
        const activity = this.activityModel.findById(id);

        if (!activity || activity.userId !== userId) {
            throw new Error('Activity not found');
        }

        return this.activityModel.update(id, data);
    }

    async markActivityAsComplete(id: number, userId: number): Promise<DealActivity | null> {
        const activity = this.activityModel.findById(id);

        if (!activity || activity.userId !== userId) {
            throw new Error('Activity not found');
        }

        return this.activityModel.markAsComplete(id);
    }


    async getDealHistory(dealId: number, limit?: number): Promise<DealHistory[]> {
        return this.dealHistoryModel.findByDealId(dealId, limit);
    }

    async deleteActivity(id: number, userId: number): Promise<boolean> {
        const activity = this.activityModel.findById(id);

        if (!activity || activity.userId !== userId) {
            throw new Error('Activity not found');
        }

        return this.activityModel.delete(id);
    }

    async getUpcomingActivities(userId: number, days: number = 7): Promise<DealActivity[]> {
        return this.activityModel.getUpcomingActivities(userId, days);
    }
}
