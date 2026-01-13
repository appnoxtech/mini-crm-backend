import { Router } from 'express';
import { ActivityController } from '../controllers/activityController';
import { authMiddleware } from '../../../shared/middleware/auth';

export function createActivityRoutes(controller: ActivityController): Router {
    const router = Router();

    // Apply auth middleware to all routes
    router.use(authMiddleware);

    // Activity routes for specific deal
    router.post('/create/activities/:dealId', (req, res) => controller.createActivity(req, res));
    router.get('/get/activities/:dealId', (req, res) => controller.getActivitiesForDeal(req, res));
    router.put('/update/activities/:dealId/:activityId', (req, res) => controller.updateActivity(req, res));
    router.patch('/complete/activities/:dealId/:activityId/complete', (req, res) => controller.completeActivity(req, res));
    router.delete('/delete/activities/:dealId/:activityId', (req, res) => controller.deleteActivity(req, res));

    // User-level activity routes
    router.get('/activities/my', (req, res) => controller.getActivitiesForUser(req, res));
    router.get('/activities/upcoming', (req, res) => controller.getUpcomingActivities(req, res));

    return router;
}
