import { Response } from 'express';
import { LeadService } from '../services/leadService';
import { AuthenticatedRequest } from '../../../shared/types';
export declare class LeadController {
    private leadService;
    constructor(leadService: LeadService);
    getLeads(req: AuthenticatedRequest, res: Response): Promise<void>;
    createLead(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateLeadStage(req: AuthenticatedRequest, res: Response): Promise<void>;
    addActivity(req: AuthenticatedRequest, res: Response): Promise<void>;
    getLeadHistory(req: AuthenticatedRequest, res: Response): Promise<void>;
    deleteLead(req: AuthenticatedRequest, res: Response): Promise<void>;
    getStats(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=leadController.d.ts.map