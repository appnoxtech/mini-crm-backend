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
        const deal = await this.dealModel.findById(dealId);
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
        } as any);
    }

    async getAllActivitiesOfDeal(dealId: number, filters: {
        activityType?: string;
        isDone?: boolean;
        limit?: number;
    } = {}): Promise<{ deal: any; activities: DealActivity[]; count: number }> {
        // Verify deal exists
        const deal = await this.dealModel.findById(dealId);

        if (!deal) {
            throw new Error('Deal not found');
        }

        const activities = await this.activityModel.findByDealId(dealId, filters);

        return {
            deal,
            activities,
            count: activities.length
        };
    }

    async createNoteActivity(userId: number, dealId: number, note: string): Promise<DealActivity> {
        return this.activityModel.createNoteActivity(userId, dealId, note);
    }

    async getActivitiesForDeal(dealId: number, filters: {
        activityType?: string;
        isDone?: boolean;
        limit?: number;
    } = {}): Promise<{ activities: DealActivity[]; count: number }> {

        const activities = await this.activityModel.findByDealId(dealId, filters);

        return {
            activities,
            count: activities.length
        };
    }

    async getActivitiesForUser(userId: number, filters: {
        activityType?: string;
        isDone?: boolean;
        upcoming?: boolean;
        limit?: number;
    } = {}): Promise<DealActivity[]> {
        return this.activityModel.findByUserId(userId, filters);
    }

    async updateActivity(id: number, userId: number, data: Partial<DealActivity>): Promise<DealActivity | null> {
        const activity = await this.activityModel.findById(id);

        if (!activity || activity.userId !== userId) {
            throw new Error('Activity not found');
        }

        return this.activityModel.update(id, data);
    }

    async markActivityAsComplete(id: number, userId: number): Promise<DealActivity | null> {
        const activity = await this.activityModel.findById(id);

        if (!activity || activity.userId !== userId) {
            throw new Error('Activity not found');
        }

        return this.activityModel.markAsComplete(id);
    }


    async getDealHistory(dealId: number, limit?: number): Promise<{ activities: any[] }> {
        // Fetch both history (audit logs) and activities (user actions)
        const [history, activities] = await Promise.all([
            this.dealHistoryModel.findByDealId(dealId, limit),
            this.activityModel.findByDealId(dealId, { limit })
        ]);

        // Combine and map to common structure
        const combined = [
            ...history.map(h => ({
                ...h,
                type: 'history', // Mark as history/audit log
                at: h.createdAt
            })),
            ...activities.map(a => ({
                ...a,
                type: a.activityType || 'activity',
                at: a.createdAt,
                // Ensure note/subject is available as 'text' or similar if needed by frontend
                text: a.note || a.subject || a.label
            }))
        ];

        // Sort by date descending (newest first)
        const sorted = combined.sort((a, b) =>
            new Date(b.at).getTime() - new Date(a.at).getTime()
        );

        if (limit) {
            return { activities: sorted.slice(0, limit) };
        }

        return { activities: sorted };
    }

    async deleteActivity(id: number, userId: number): Promise<boolean> {
        const activity = await this.activityModel.findById(id);

        if (!activity || activity.userId !== userId) {
            throw new Error('Activity not found');
        }

        return this.activityModel.delete(id);
    }

    async getUpcomingActivities(userId: number, days: number = 7): Promise<DealActivity[]> {
        return this.activityModel.getUpcomingActivities(userId, days);
    }

    async searchActivities(userId: number, query: string, dealId?: number): Promise<DealActivity[]> {
        return this.activityModel.search(userId, query, dealId);
    }

    async createFileActivity(dealId: number, userId: number, files: any[]): Promise<DealActivity> {
        // Verify deal exists and user has access
        const deal = await this.dealModel.findById(dealId);
        if (!deal || deal.userId !== userId) {
            throw new Error('Deal not found or access denied');
        }

        if (!files || files.length === 0) {
            throw new Error('Files are required for file activity');
        }

        return this.activityModel.createFileActivity(userId, dealId, files);
    }

}
