import { Request, Response } from 'express';
import { ReminderService } from '../services/reminderService';
import { AuthenticatedRequest } from '../../../shared/types';
import { ResponseHandler } from '../../../shared/responses/responses';

export class ReminderController {
    constructor(private reminderService: ReminderService) { }

    async getReminders(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const eventId = Number(req.params.eventId);
            if (isNaN(eventId)) {
                return ResponseHandler.badRequest(res, 'Invalid event ID');
            }

            const reminders = await this.reminderService.getReminders(eventId, req.user.companyId);
            return ResponseHandler.success(res, { reminders }, 'Reminders fetched successfully');
        } catch (error: any) {
            console.error('Error fetching reminders:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch reminders');
        }
    }

    async addReminder(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const eventId = Number(req.params.eventId);
            const { minutesBefore } = req.body;

            if (isNaN(eventId) || minutesBefore === undefined) {
                return ResponseHandler.badRequest(res, 'Event ID and minutesBefore are required');
            }

            const reminder = await this.reminderService.addReminder(eventId, req.user.id, req.user.companyId, Number(minutesBefore));
            if (!reminder) {
                return ResponseHandler.notFound(res, 'Event not found or not authorized');
            }

            return ResponseHandler.created(res, reminder, 'Reminder added successfully');
        } catch (error: any) {
            console.error('Error adding reminder:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to add reminder');
        }
    }

    async updateReminder(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const reminderId = Number(req.params.id);
            const { minutesBefore } = req.body;

            if (isNaN(reminderId) || minutesBefore === undefined) {
                return ResponseHandler.badRequest(res, 'Reminder ID and minutesBefore are required');
            }

            const reminder = await this.reminderService.updateReminder(reminderId, req.user.id, req.user.companyId, Number(minutesBefore));
            if (!reminder) {
                return ResponseHandler.notFound(res, 'Reminder not found or not authorized');
            }

            return ResponseHandler.success(res, reminder, 'Reminder updated successfully');
        } catch (error: any) {
            console.error('Error updating reminder:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to update reminder');
        }
    }

    async deleteReminder(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const reminderId = Number(req.params.id);
            if (isNaN(reminderId)) {
                return ResponseHandler.badRequest(res, 'Invalid reminder ID');
            }

            const deleted = await this.reminderService.deleteReminder(reminderId, req.user.id, req.user.companyId);
            if (!deleted) {
                return ResponseHandler.notFound(res, 'Reminder not found or not authorized');
            }

            return ResponseHandler.success(res, { deleted: true }, 'Reminder deleted successfully');
        } catch (error: any) {
            console.error('Error deleting reminder:', error);
            return ResponseHandler.internalError(res, 'Failed to delete reminder');
        }
    }
}
