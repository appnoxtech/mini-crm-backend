import Database from "better-sqlite3";
import { BaseEntity } from '../../../shared/types';
/**
 * needed field
 * Value
Color
orderIndex
pipelineId
userId
 *
 */
export interface Label extends BaseEntity {
    value: string;
    color: string;
    orderIndex: number;
    pipelineId?: number;
    userId?: number;
    organizationId?: number;
    personId?: number;
}
export declare class LabelModel {
    private db;
    constructor(db: Database.Database);
    initialize(): void;
    create(data: Omit<Label, 'id' | 'createdAt' | 'updatedAt'>): Label;
    findByPipelineId(pipelineId: number): Label[];
    findByOrganizationId(organizationId: number): Label[];
    findByPersonId(personId: number): Label[];
    findById(id: number): Label | undefined;
    findByUserId(userId: number, filters?: {
        pipelineId?: number;
        stageId?: number;
        status?: string;
        search?: string;
        limit?: number;
        offset?: number;
    }): {
        label: Label[];
        total: number;
    };
    update(id: number, data: Partial<Label>): Label | undefined;
    delete(id: number): boolean;
}
//# sourceMappingURL=Label.d.ts.map