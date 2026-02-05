import { Activity, ActivityModel } from '../models/Activity';
import { UserModel } from '../../auth/models/User';

export class ActivityService {
    private model: ActivityModel;
    private userModel: UserModel;

    constructor(model: ActivityModel, userModel: UserModel) {
        this.model = model;
        this.userModel = userModel;
    }

    private async enrichActivities(activities: Activity[]): Promise<any[]> {
        // Collect all unique assignedUserIds
        const allUserIds = new Set<number>();
        activities.forEach(a => {
            if (a.assignedUserIds) {
                (a.assignedUserIds as number[]).forEach(uid => allUserIds.add(uid));
            }
        });

        if (allUserIds.size === 0) {
            return activities.map(({ assignedUserIds, ...rest }) => ({ ...rest, assignedUsers: [] }));
        }

        // Fetch user details
        const users = await this.userModel.findByIds(Array.from(allUserIds));
        const userMap = new Map<number, { id: number; name: string; email: string }>();
        users.forEach(u => {
            userMap.set(u.id, { id: u.id, name: u.name, email: u.email });
        });

        // Enrich activities and remove assignedUserIds
        return activities.map(a => {
            const { assignedUserIds, ...activityWithoutIds } = a;
            return {
                ...activityWithoutIds,
                assignedUsers: (a.assignedUserIds as number[]).map(uid => userMap.get(uid)).filter(Boolean)
            };
        });
    }

    async createActivity(userId: number, data: {
        title: string;
        description?: string;
        type?: 'call' | 'meeting' | 'task' | 'deadline' | 'email' | 'lunch';
        startAt: string;
        endAt: string;
        priority?: 'low' | 'medium' | 'high';
        status?: 'busy' | 'free';
        location?: string;
        videoCallLink?: string;
        assignedUserIds?: number[];
    }) {
        // Validation
        const start = new Date(data.startAt);
        const end = new Date(data.endAt);

        if (end <= start) {
            throw new Error('End time must be after start time');
        }

        // Availability Check (only if status is busy)
        if (data.status === 'busy' || data.status === undefined) {
            const userIdsToCheck = [userId, ...(data.assignedUserIds || [])];
            const conflicts = await this.model.findOverlapping(data.startAt, data.endAt, userIdsToCheck);
            if (conflicts.length > 0) {
                const conflictingIds = conflicts.map(c => c.id).join(', ');
                throw new Error(`Time slot overlap with activities: ${conflictingIds}`);
            }
        }

        const activity = await this.model.create({
            ...data,
            type: data.type || 'meeting',
            createdBy: userId,
            isDone: false,
            assignedUserIds: data.assignedUserIds || [],
            priority: data.priority || 'medium',
            status: data.status || 'busy'
        });

        const enriched = await this.enrichActivities([activity]);
        return enriched[0];
    }

    async getActivities(userId: number, filters: {
        fromDate?: string;
        toDate?: string;
        status?: 'done' | 'pending' | 'all';
        limit?: number;
        offset?: number;
    }) {
        const result = await this.model.findAll({ ...filters, userId });
        return {
            ...result,
            activities: await this.enrichActivities(result.activities)
        };
    }

    async searchActivities(userId: number, query?: string, type?: string) {
        const activities = await this.model.search(userId, query, type);
        return await this.enrichActivities(activities);
    }

    async updateActivity(activityId: string, userId: number, updates: Partial<Activity>) {
        const activity = await this.model.findById(activityId);
        if (!activity) {
            throw new Error('Activity not found');
        }

        // Permissions check: Only creator or assigned users can update
        const isAuthorized = activity.createdBy === userId || (activity.assignedUserIds as number[]).includes(userId);
        if (!isAuthorized) {
            throw new Error('Unauthorized to update this activity');
        }

        // Validate time if changing
        if (updates.startAt || updates.endAt) {
            const newStart = updates.startAt || activity.startAt;
            const newEnd = updates.endAt || activity.endAt;
            if (new Date(newEnd) <= new Date(newStart)) {
                throw new Error('End time must be after start time');
            }

            if ((updates.status === 'busy' || activity.status === 'busy') &&
                (updates.startAt || updates.endAt)) {
                const userIdsToCheck = [activity.createdBy, ...(activity.assignedUserIds as number[])];
                // Exclude current activity from self-overlap
                const conflicts = await this.model.findOverlapping(newStart, newEnd, userIdsToCheck);
                const validConflicts = conflicts.filter(c => c.id !== activityId);

                if (validConflicts.length > 0) {
                    throw new Error(`Time slot overlap with existing activities`);
                }
            }
        }

        const updated = await this.model.update(activityId, updates);
        if (updated) {
            const enriched = await this.enrichActivities([updated]);
            return enriched[0];
        }
        return null;
    }

    async deleteActivity(activityId: string, userId: number) {
        const activity = await this.model.findById(activityId);
        if (!activity) {
            throw new Error('Activity not found');
        }

        if (activity.createdBy !== userId) {
            throw new Error('Only the creator can delete the activity');
        }

        return await this.model.delete(activityId);
    }

    async markAsDone(activityId: string, userId: number) {
        return await this.updateActivity(activityId, userId, { isDone: true });
    }

    async checkAvailability(startAt: string, endAt: string, userIds: number[]) {
        const conflicts = await this.model.findOverlapping(startAt, endAt, userIds);
        return {
            available: conflicts.length === 0,
            conflictingActivityIds: conflicts.map(c => c.id)
        };
    }

    async getCalendarView(userId: number, date: string) {
        // Get whole day (or generic range)
        const startOfDay = new Date(date);
        startOfDay.setUTCHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setUTCHours(23, 59, 59, 999);

        const { activities } = await this.model.findAll({
            userId,
            fromDate: startOfDay.toISOString(),
            toDate: endOfDay.toISOString()
        });

        // Group by hour
        const grouped: Record<number, Activity[]> = {};
        for (let i = 0; i < 24; i++) grouped[i] = [];

        const enrichedActivities = await this.enrichActivities(activities);

        enrichedActivities.forEach(activity => {
            const hour = new Date(activity.startAt).getUTCHours();
            if (grouped[hour]) {
                grouped[hour].push(activity);
            }
        });

        return grouped;
    }

    getMetadata() {
        return {
            priorities: ['low', 'medium', 'high'],
            statuses: ['busy', 'free'],
            activityTypes: ['call', 'meeting', 'task', 'deadline', 'email', 'lunch']
        };
    }
}
