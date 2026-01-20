import Database from 'better-sqlite3';
export interface DealHistory {
    id: number;
    dealId: number;
    userId: number;
    eventType: string;
    fromValue?: string;
    toValue?: string;
    fromStageId?: number;
    toStageId?: number;
    stageDuration?: number;
    description?: string;
    metadata?: any;
    createdAt: string;
}
export declare class DealHistoryModel {
    private db;
    constructor(db: Database.Database);
    initialize(): void;
    create(data: Omit<DealHistory, 'id'>): DealHistory;
    private formatHistory;
    findById(id: number): DealHistory | undefined;
    getDealHistory(dealId: number): DealHistory[];
    findByDealId(dealId: number, limit?: number): DealHistory[];
    findLastStageChange(dealId: number): DealHistory | undefined;
    findByEventType(dealId: number, eventType: string): DealHistory[];
    getTimeInStages(dealId: number): Array<{
        stageId: number;
        stageName: string;
        duration: number;
    }>;
    delete(id: number): boolean;
}
//# sourceMappingURL=DealHistory.d.ts.map