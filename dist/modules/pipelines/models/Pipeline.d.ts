import Database from 'better-sqlite3';
import { BaseEntity } from '../../../shared/types';
export interface Pipeline extends BaseEntity {
    name: string;
    description?: string;
    userId: number;
    isDefault: boolean;
    isActive: boolean;
    dealRotting: boolean;
    rottenDays: number;
}
type searchResult = {
    name: string;
    id: number;
    description?: string;
    isDefault: boolean;
    isActive: boolean;
};
export declare class PipelineModel {
    private db;
    constructor(db: Database.Database);
    initialize(): void;
    create(data: Omit<Pipeline, 'id' | 'createdAt' | 'updatedAt'>): Pipeline;
    findById(id: number): Pipeline | undefined;
    searchByPipelineName(name: string): searchResult[];
    findByUserId(userId: number, includeInactive?: boolean): Pipeline[];
    update(id: number, userId: number, data: Partial<Omit<Pipeline, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Pipeline | null;
    delete(id: number, userId: number): boolean;
    getStats(pipelineId: number): {
        totalDeals: number;
        totalValue: number;
        wonDeals: number;
        wonValue: number;
        lostDeals: number;
        lostValue: number;
    };
}
export {};
//# sourceMappingURL=Pipeline.d.ts.map