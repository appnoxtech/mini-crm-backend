import Database from 'better-sqlite3';
import { BaseEntity } from '../../../shared/types';
export interface PipelineStage extends BaseEntity {
    pipelineId: number;
    name: string;
    orderIndex: number;
    rottenDays?: number;
    probability: number;
}
export type searchResult = {
    name: string;
    id: number;
    description?: string;
    isDefault: boolean;
    isActive: boolean;
};
export declare class PipelineStageModel {
    private db;
    constructor(db: Database.Database);
    initialize(): void;
    create(data: Omit<PipelineStage, 'id' | 'createdAt' | 'updatedAt'>): PipelineStage;
    searchByStageName(name: string): searchResult[];
    findById(id: number): PipelineStage | undefined;
    findByPipelineId(pipelineId: number): PipelineStage[];
    bulkUpdate(pipelineId: number, stagesData: Array<{
        stageId: number;
        name: string;
        orderIndex: number;
        probability?: number;
        rottenDays?: number;
    }>): void;
    update(id: number, data: Partial<Omit<PipelineStage, 'id' | 'pipelineId' | 'createdAt' | 'updatedAt'>>): PipelineStage | null;
    reorder(pipelineId: number, stageOrder: number[]): void;
    delete(id: number, moveDealsToStageId?: number): boolean;
    getStageWithDealCount(pipelineId: number): Array<PipelineStage & {
        dealCount: number;
        totalValue: number;
    }>;
}
//# sourceMappingURL=PipelineStage.d.ts.map