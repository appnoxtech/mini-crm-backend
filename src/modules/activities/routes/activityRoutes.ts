import { Router } from 'express';
import { ActivityController } from '../controllers/ActivityController';
import { authMiddleware } from '../../../shared/middleware/auth';

export function createActivityRoutes(controller: ActivityController): Router {
    const router = Router();

    // Secure all routes
    router.use(authMiddleware);

    // List & Create
    router.get('/', controller.getActivities);
    router.get('/search', controller.searchActivities);
    router.post('/', controller.createActivity);

    // Specific Item Operations
    router.put('/:activityId', controller.updateActivity);
    router.delete('/delete/:activityId', controller.deleteActivity);
    router.patch('/:activityId/mark-done', controller.markAsDone);

    // Utilities
    router.get('/meta', controller.getMetadata);
    router.post('/check-availability', controller.checkAvailability);
    router.get('/calendar', controller.getCalendarView);

    return router;
}
