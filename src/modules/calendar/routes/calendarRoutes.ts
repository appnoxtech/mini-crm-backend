import { Router } from 'express';
import { CalendarController } from '../controllers/calendarController';
import { ReminderController } from '../controllers/reminderController';
import { NotificationController } from '../controllers/notificationController';
import { authMiddleware } from '../../../shared/middleware/auth';

export function createCalendarRoutes(
    calendarController: CalendarController,
    reminderController: ReminderController,
    notificationController: NotificationController
): Router {
    const router = Router();

    // Apply auth middleware to all routes
    router.use(authMiddleware);

    // Event routes
    router.post('/events', (req, res) => calendarController.createEvent(req, res));
    router.get('/events', (req, res) => calendarController.getEvents(req, res));
    router.get('/events/:id', (req, res) => calendarController.getEventById(req, res));
    router.put('/events/:id', (req, res) => calendarController.updateEvent(req, res));
    router.delete('/events/:id', (req, res) => calendarController.deleteEvent(req, res));

    // Event sharing routes
    router.post('/events/:id/share', (req, res) => calendarController.shareEvent(req, res));
    router.delete('/events/:id/share/:userId', (req, res) => calendarController.unshareEvent(req, res));
    router.get('/events/:id/shared-users', (req, res) => calendarController.getSharedUsers(req, res));

    // Reminder routes
    router.get('/events/:eventId/reminders', (req, res) => reminderController.getReminders(req, res));
    router.post('/events/:eventId/reminders', (req, res) => reminderController.addReminder(req, res));
    router.put('/reminders/:id', (req, res) => reminderController.updateReminder(req, res));
    router.delete('/reminders/:id', (req, res) => reminderController.deleteReminder(req, res));

    // Notification routes
    router.get('/my-notifications', (req, res) => notificationController.getMyNotifications(req, res));
    router.get('/notifications', (req, res) => notificationController.getNotificationLogs(req, res)); // Admin only

    return router;
}
