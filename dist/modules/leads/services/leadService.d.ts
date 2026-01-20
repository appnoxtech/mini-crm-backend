import { Lead, LeadHistory } from '../models/Lead';
export declare class LeadService {
    private leadModel;
    constructor(leadModel: any);
    createLead(userId: number, leadData: {
        name: string;
        company?: string;
        value?: number;
        notes?: string;
    }): Promise<Lead>;
    getLeads(userId: number, options?: {
        stage?: string;
        search?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        leads: Lead[];
        count: number;
    }>;
    getLeadById(id: number, userId: number): Promise<Lead | null>;
    updateLeadStage(id: number, userId: number, stage: 'OPEN' | 'WON' | 'LOST'): Promise<Lead | null>;
    addActivity(id: number, userId: number, type: string, text: string): Promise<void>;
    getLeadHistory(id: number, userId: number): Promise<LeadHistory[]>;
    deleteLead(id: number, userId: number): Promise<boolean>;
    getStats(userId: number): Promise<{
        total: number;
        openCount: number;
        wonCount: number;
        lostCount: number;
        totalValue: number;
        wonValue: number;
    }>;
}
//# sourceMappingURL=leadService.d.ts.map