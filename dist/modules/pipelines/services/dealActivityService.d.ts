import { DealActivity, DealActivityModel } from '../models/DealActivity';
import { DealHistory, DealHistoryModel } from '../models/DealHistory';
import { DealModel } from '../models/Deal';
export declare class DealActivityService {
    private activityModel;
    private dealModel;
    private dealHistoryModel;
    constructor(activityModel: DealActivityModel, dealModel: DealModel, dealHistoryModel: DealHistoryModel);
    createActivity(dealId: number, userId: number, data: Partial<DealActivity>): Promise<DealActivity>;
    getAllActivitiesOfDeal(dealId: number, filters?: {
        activityType?: string;
        isDone?: boolean;
        limit?: number;
    }): Promise<{
        deal: any;
        activities: DealActivity[];
        count: number;
    }>;
    createNoteActivity(userId: number, dealId: number, note: string): Promise<DealActivity>;
    getActivitiesForDeal(dealId: number, filters?: {
        activityType?: string;
        isDone?: boolean;
        limit?: number;
    }): Promise<{
        activities: DealActivity[];
        count: number;
    }>;
    getActivitiesForUser(userId: number, filters?: {
        activityType?: string;
        isDone?: boolean;
        upcoming?: boolean;
        limit?: number;
    }): Promise<DealActivity[]>;
    updateActivity(id: number, userId: number, data: Partial<DealActivity>): Promise<DealActivity | null>;
    markActivityAsComplete(id: number, userId: number): Promise<DealActivity | null>;
    getDealHistory(dealId: number, limit?: number): Promise<DealHistory[]>;
    deleteActivity(id: number, userId: number): Promise<boolean>;
    getUpcomingActivities(userId: number, days?: number): Promise<DealActivity[]>;
    createFileActivity(dealId: number, userId: number, files: any[]): Promise<DealActivity>;
}
//# sourceMappingURL=dealActivityService.d.ts.map