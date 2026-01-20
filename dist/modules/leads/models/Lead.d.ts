import Database from 'better-sqlite3';
import { BaseEntity } from '../../../shared/types';
export interface Lead extends BaseEntity {
    name: string;
    company?: string;
    value?: number;
    stage: 'OPEN' | 'WON' | 'LOST';
    notes?: string;
    userId: number;
    closedAt?: string;
}
export interface LeadHistory {
    id: number;
    leadId: number;
    type: string;
    text: string;
    at: string;
}
export declare class LeadModel {
    private db;
    constructor(db: Database.Database);
    initialize(): void;
    createLead(leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Lead;
    findById(id: number): Lead | undefined;
    findByUserId(userId: number, options?: {
        stage?: string;
        search?: string;
        limit?: number;
        offset?: number;
    }): {
        leads: Lead[];
        count: number;
    };
    updateStage(id: number, userId: number, stage: 'OPEN' | 'WON' | 'LOST'): Lead | null;
    addHistory(leadId: number, type: string, text: string): void;
    getHistory(leadId: number): LeadHistory[];
    deleteLead(id: number, userId: number): boolean;
    getStats(userId: number): {
        total: number;
        openCount: number;
        wonCount: number;
        lostCount: number;
        totalValue: number;
        wonValue: number;
    };
}
//# sourceMappingURL=Lead.d.ts.map