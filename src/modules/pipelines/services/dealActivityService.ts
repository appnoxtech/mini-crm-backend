import { DealActivity, DealActivityModel } from '../models/DealActivity';
import { DealModel } from '../models/Deal';

export class DealActivityService {
    constructor(
        private activityModel: DealActivityModel,
        private dealModel: DealModel
    ) { }

    async createActivity(dealId: number, userId: number, data: {
        type: string;
        subject?: string;
        description?: string;
        dueDate?: string;
        dueTime?: string;
        duration?: number;
        emailId?: number;
    }): Promise<DealActivity> {
        // Verify deal exists and user has access
        const deal = this.dealModel.findById(dealId);
        if (!deal || deal.userId !== userId) {
            throw new Error('Deal not found');
        }

        // Validation
        if (!data.type || !data.type.trim()) {
            throw new Error('Activity type is required');
        }

        const validTypes = ['call', 'email', 'meeting', 'note', 'task', 'deadline'];
        if (!validTypes.includes(data.type)) {
            throw new Error(`Invalid activity type. Must be one of: ${validTypes.join(', ')}`);
        }

        return this.activityModel.create({
            dealId,
            userId,
            type: data.type,
            subject: data.subject?.trim(),
            description: data.description?.trim(),
            dueDate: data.dueDate,
            dueTime: data.dueTime,
            duration: data.duration,
            isDone: false,
            emailId: data.emailId
        });
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

    async updateActivity(id: number, userId: number, data: Partial<{
        type: string;
        subject: string;
        description: string;
        dueDate: string;
        dueTime: string;
        duration: number;
        isDone: boolean;
    }>): Promise<DealActivity | null> {
        const activity = this.activityModel.findById(id);

        if (!activity || activity.userId !== userId) {
            throw new Error('Activity not found');
        }

        // Validation
        if (data.type) {
            const validTypes = ['call', 'email', 'meeting', 'note', 'task', 'deadline'];
            if (!validTypes.includes(data.type)) {
                throw new Error(`Invalid activity type. Must be one of: ${validTypes.join(', ')}`);
            }
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
