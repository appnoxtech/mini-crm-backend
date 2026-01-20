import Database from 'better-sqlite3';
import { BaseEntity } from '../../../shared/types';
export interface DealActivity extends BaseEntity {
    dealId: number;
    userId: number;
    activityType: string;
    subject?: string;
    label?: string;
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    priority?: 'low' | 'medium' | 'high' | "none";
    busyFree?: 'busy' | 'free' | 'notSet';
    note?: string;
    organization?: string;
    email?: {
        from: string;
        to: string[];
        subject: string;
        body: string;
    };
    files?: {
        url: string;
    }[];
    participants?: {
        id: number;
        name: string;
        email?: string;
        phone?: string;
    }[];
    deal?: {
        name?: string;
        value?: string;
    };
    persons?: {
        id?: number;
        name?: string;
        email?: string;
        phone?: string;
    }[];
    mataData?: {
        key?: string;
        value?: string;
        type?: string;
    }[];
    isDone: boolean;
    completedAt?: string;
}
export declare class DealActivityModel {
    private db;
    constructor(db: Database.Database);
    initialize(): void;
    create(data: Omit<DealActivity, 'id' | 'createdAt' | 'updatedAt'>): DealActivity;
    private formatActivity;
    findById(id: number): DealActivity | undefined;
    findByDealId(dealId: number, filters?: {
        activityType?: string;
        isDone?: boolean;
        limit?: number;
    }): DealActivity[];
    createNoteActivity(userId: number, dealId: number, note: string): DealActivity;
    createFileActivity(userId: number, dealId: number, files: any[]): DealActivity;
    findByUserId(userId: number, filters?: {
        activityType?: string;
        isDone?: boolean;
        upcoming?: boolean;
        limit?: number;
    }): DealActivity[];
    update(id: number, data: Partial<Omit<DealActivity, 'id' | 'dealId' | 'userId' | 'createdAt' | 'updatedAt'>>): DealActivity | null;
    markAsComplete(id: number): DealActivity | null;
    delete(id: number): boolean;
    addActivityNote(userId: number, activityId: number, note: string): DealActivity | null;
    getUpcomingActivities(userId: number, days?: number): DealActivity[];
}
//# sourceMappingURL=DealActivity.d.ts.map