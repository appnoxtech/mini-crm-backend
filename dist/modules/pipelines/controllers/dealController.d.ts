import { Request, Response } from 'express';
import { DealService } from '../services/dealService';
import { AuthenticatedRequest } from '../../../shared/types';
export declare class DealController {
    private dealService;
    constructor(dealService: DealService);
    createDeal(req: AuthenticatedRequest, res: Response): Promise<void>;
    searchDeals(req: AuthenticatedRequest, res: Response): Promise<void>;
    getDeals(req: AuthenticatedRequest, res: Response): Promise<void>;
    getDealById(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateDeal(req: AuthenticatedRequest, res: Response): Promise<void>;
    moveDeal(req: AuthenticatedRequest, res: Response): Promise<void>;
    closeDeal(req: AuthenticatedRequest, res: Response): Promise<void>;
    deleteDeal(req: AuthenticatedRequest, res: Response): Promise<void>;
    getRottenDeals(req: AuthenticatedRequest, res: Response): Promise<void>;
    makeDealAsWon(req: AuthenticatedRequest, res: Response): Promise<void>;
    makeDealAsLost(req: AuthenticatedRequest, res: Response): Promise<void>;
    resetDeal(req: AuthenticatedRequest, res: Response): Promise<void>;
    getDealHistory(req: AuthenticatedRequest, res: Response): Promise<void>;
    uploadDealFiles(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=dealController.d.ts.map