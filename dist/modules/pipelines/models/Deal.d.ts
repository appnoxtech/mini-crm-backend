import Database from 'better-sqlite3';
import { BaseEntity } from '../../../shared/types';
export interface Deal extends BaseEntity {
    title: string;
    value: number;
    currency: string;
    pipelineId: number;
    stageId: number;
    personId?: number;
    organizationId?: number;
    email?: {
        value: string;
        type: string;
    }[];
    phone?: {
        value: string;
        type: string;
    }[];
    description?: string;
    expectedCloseDate?: string;
    actualCloseDate?: string;
    probability: number;
    userId: number;
    assignedTo?: number;
    status: 'OPEN' | 'WON' | 'LOST' | 'DELETED';
    lostReason?: string;
    lastActivityAt?: string;
    isRotten: boolean;
    labelIds?: number[];
    source?: string;
    labels?: string;
    customFields?: string;
}
export declare class DealModel {
    private db;
    constructor(db: Database.Database);
    initialize(): void;
    create(data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Deal;
    findById(id: number): Deal | null;
    findByUserId(userId: number, filters?: {
        pipelineId?: number;
        stageId?: number;
        status?: string;
        search?: string;
        limit?: number;
        offset?: number;
    }): {
        deals: Deal[];
        total: number;
    };
    update(id: number, userId: number, data: Partial<Omit<Deal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Deal | null;
    delete(id: number, userId: number): boolean;
    updateRottenStatus(dealId: number, isRotten: boolean): void;
    getRottenDeals(userId: number, pipelineId?: number): Deal[];
    searchDeals(search: string): Deal[];
    makeDealAsWon(dealId: number): Deal | null;
    makeDealAsLost(dealId: number, info: {
        reason?: string;
        comment?: string;
    }): Deal | null;
    resetDeal(dealId: number): Deal | null;
}
//# sourceMappingURL=Deal.d.ts.map