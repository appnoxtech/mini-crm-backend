import { Response } from 'express';
import { DealActivityService } from '../services/dealActivityService';
import { AuthenticatedRequest } from '../../../shared/types';
export declare class ActivityController {
    private activityService;
    constructor(activityService: DealActivityService);
    createActivity(req: AuthenticatedRequest, res: Response): Promise<void>;
    getAllActivitiesOfDeal(req: AuthenticatedRequest, res: Response): Promise<void>;
    createNoteActivity(req: AuthenticatedRequest, res: Response): Promise<void>;
    getActivitiesForDeal(req: AuthenticatedRequest, res: Response): Promise<void>;
    getActivitiesForUser(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateActivity(req: AuthenticatedRequest, res: Response): Promise<void>;
    completeActivity(req: AuthenticatedRequest, res: Response): Promise<void>;
    deleteActivity(req: AuthenticatedRequest, res: Response): Promise<void>;
    getUpcomingActivities(req: AuthenticatedRequest, res: Response): Promise<void>;
    getDealHistory(req: AuthenticatedRequest, res: Response): Promise<void>;
    uploadActivityFiles(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=activityController.d.ts.map