import { DealActivity, DealActivityModel } from '../models/DealActivity';
import { DealHistory, DealHistoryModel } from '../models/DealHistory';
import { DealModel } from '../models/Deal';

export class DealActivityService {
    constructor(
        private activityModel: DealActivityModel,
        private dealModel: DealModel,
        private dealHistoryModel: DealHistoryModel
    ) { }

    async createActivity(dealId: number, companyId: number, userId: number, data: Partial<DealActivity>): Promise<DealActivity> {
        // Verify deal exists and user has access
        const deal = await this.dealModel.findById(dealId, companyId, userId);
        if (!deal) {
            throw new Error('Deal not found');
        }

        // Basic validation - minimum required fields for the record
        const activityType = data.activityType || 'SubActivity';

        return this.activityModel.create({
            ...data,
            dealId,
            userId,
            companyId,
            activityType: activityType,
            isDone: data.isDone || false
        } as any);
    }

    async getAllActivitiesOfDeal(dealId: number, companyId: number, filters: {
        activityType?: string;
        isDone?: boolean;
        limit?: number;
    } = {}): Promise<{ deal: any; activities: DealActivity[]; count: number }> {
        // Verify deal exists
        const deal = await this.dealModel.findById(dealId, companyId);

        if (!deal) {
            throw new Error('Deal not found');
        }

        const activities = await this.activityModel.findByDealId(dealId, companyId, filters);

        return {
            deal,
            activities,
            count: activities.length
        };
    }

    async createNoteActivity(userId: number, dealId: number, companyId: number, note: string): Promise<DealActivity> {
        return this.activityModel.createNoteActivity(userId, dealId, companyId, note);
    }

    async getActivitiesForDeal(dealId: number, companyId: number, filters: {
        activityType?: string;
        isDone?: boolean;
        limit?: number;
    } = {}): Promise<{ activities: DealActivity[]; count: number }> {

        const activities = await this.activityModel.findByDealId(dealId, companyId, filters);

        return {
            activities,
            count: activities.length
        };
    }

    async getActivitiesForUser(userId: number, companyId: number, filters: {
        activityType?: string;
        isDone?: boolean;
        upcoming?: boolean;
        limit?: number;
    } = {}): Promise<DealActivity[]> {
        return this.activityModel.findByUserId(userId, companyId, filters);
    }

    async updateActivity(id: number, companyId: number, userId: number, data: Partial<DealActivity>): Promise<DealActivity | null> {
        const activity = await this.activityModel.findById(id, companyId);

        if (!activity || activity.userId !== userId) {
            throw new Error('Activity not found');
        }

        return this.activityModel.update(id, companyId, data);
    }

    async markActivityAsComplete(id: number, companyId: number, userId: number): Promise<DealActivity | null> {
        const activity = await this.activityModel.findById(id, companyId);

        if (!activity || activity.userId !== userId) {
            throw new Error('Activity not found');
        }

        return this.activityModel.markAsComplete(id, companyId);
    }


    async getDealHistory(dealId: number, companyId: number, limit?: number): Promise<DealHistory[]> {
        return this.dealHistoryModel.findByDealId(dealId, companyId, limit);
    }

    async deleteActivity(id: number, companyId: number, userId: number): Promise<boolean> {
        const activity = await this.activityModel.findById(id, companyId);

        if (!activity || activity.userId !== userId) {
            throw new Error('Activity not found');
        }

        return this.activityModel.delete(id, companyId);
    }

    async getUpcomingActivities(userId: number, companyId: number, days: number = 7): Promise<DealActivity[]> {
        return this.activityModel.getUpcomingActivities(userId, companyId, days);
    }

    async createFileActivity(dealId: number, companyId: number, userId: number, files: any[]): Promise<DealActivity> {
        // Verify deal exists and user has access
        const deal = await this.dealModel.findById(dealId, companyId, userId);
        if (!deal) {
            throw new Error('Deal not found or access denied');
        }

        if (!files || files.length === 0) {
            throw new Error('Files are required for file activity');
        }

        return this.activityModel.createFileActivity(userId, dealId, companyId, files);
    }

}
