import { Router, Request, Response } from 'express';
import { ActivityController } from '../controllers/activityController';
import { authMiddleware } from '../../../shared/middleware/auth';
import { fileUploadMiddleware } from '../../../shared/middleware/fileUpload';

export function createActivityRoutes(controller: ActivityController): Router {
    const router = Router();

    // Apply auth middleware to all routes
    router.use(authMiddleware);

    // Activity routes for specific deal
    router.post('/create/:dealId', (req, res) => controller.createActivity(req, res));
    router.get('/get/:dealId', (req, res) => controller.getAllActivitiesOfDeal(req, res));
    router.put('/update/:dealId/:activityId', (req, res) => controller.updateActivity(req, res));
    router.patch('/complete/:dealId/:activityId/complete', (req, res) => controller.completeActivity(req, res));
    router.delete('/delete/:dealId/:activityId', (req, res) => controller.deleteActivity(req, res));
    router.post('/create-note/:dealId', (req, res) => controller.createNoteActivity(req, res));

    // Get deal history + all activities
    router.get('/deal-history/:dealId', (req, res) => controller.getDealHistory(req, res));

    // User-level activity routes
    router.get('/my-activities', (req, res) => controller.getActivitiesForUser(req, res));
    router.get('/upcoming-activities', (req, res) => controller.getUpcomingActivities(req, res));
    router.get('/search', (req: Request, res: Response) => controller.searchActivities(req as any, res));

    router.post('/upload/:dealId', fileUploadMiddleware, (req: Request, res: Response) => controller.uploadActivityFiles(req, res));

    return router;
}
