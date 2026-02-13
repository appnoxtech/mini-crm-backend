import { Request, Response } from 'express';
import { CalendarService } from '../services/calendarService';
import { AuthenticatedRequest } from '../../../shared/types';
import { ResponseHandler } from '../../../shared/responses/responses';

export class CalendarController {
    constructor(private calendarService: CalendarService) { }

    async createEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user || !req.user.companyId) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { title, description, startTime, endTime, location, isAllDay, reminders, sharedWith } = req.body;

            if (!title || !startTime || !endTime) {
                return ResponseHandler.badRequest(res, 'Title, startTime, and endTime are required');
            }

            const result = await this.calendarService.createEvent(req.user.id, req.user.companyId, {
                title,
                description,
                startTime,
                endTime,
                location,
                isAllDay,
                reminders,
                sharedWith
            });

            return ResponseHandler.created(res, result, 'Event created successfully');
        } catch (error: any) {
            console.error('Error creating event:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to create event');
        }
    }

    async getEvents(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user || !req.user.companyId) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { startDate, endDate, page, limit } = req.query;

            const result = await this.calendarService.getEvents(req.user.id, req.user.companyId, {
                startDate: startDate as string,
                endDate: endDate as string,
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined
            });

            return ResponseHandler.success(res, result, 'Events fetched successfully');
        } catch (error: any) {
            console.error('Error fetching events:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch events');
        }
    }

    async getEventById(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user || !req.user.companyId) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const eventId = Number(req.params.id);
            if (isNaN(eventId)) {
                return ResponseHandler.badRequest(res, 'Invalid event ID');
            }

            const result = await this.calendarService.getEventById(eventId, req.user.id, req.user.companyId);
            if (!result) {
                return ResponseHandler.notFound(res, 'Event not found');
            }

            return ResponseHandler.success(res, result, 'Event fetched successfully');
        } catch (error: any) {
            console.error('Error fetching event:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch event');
        }
    }

    async updateEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user || !req.user.companyId) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const eventId = Number(req.params.id);
            if (isNaN(eventId)) {
                return ResponseHandler.badRequest(res, 'Invalid event ID');
            }

            const { title, description, startTime, endTime, location, isAllDay, sharedWith } = req.body;

            const result = await this.calendarService.updateEvent(eventId, req.user.id, req.user.companyId, {
                title,
                description,
                startTime,
                endTime,
                location,
                isAllDay,
                sharedWith
            });

            if (!result) {
                return ResponseHandler.notFound(res, 'Event not found or not authorized');
            }

            return ResponseHandler.success(res, result, 'Event updated successfully');
        } catch (error: any) {
            console.error('Error updating event:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to update event');
        }
    }

    async deleteEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user || !req.user.companyId) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const eventId = Number(req.params.id);
            if (isNaN(eventId)) {
                return ResponseHandler.badRequest(res, 'Invalid event ID');
            }

            const deleted = await this.calendarService.deleteEvent(eventId, req.user.id, req.user.companyId);
            if (!deleted) {
                return ResponseHandler.notFound(res, 'Event not found or not authorized');
            }

            return ResponseHandler.success(res, { deleted: true }, 'Event deleted successfully');
        } catch (error: any) {
            console.error('Error deleting event:', error);
            return ResponseHandler.internalError(res, 'Failed to delete event');
        }
    }

    async shareEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user || !req.user.companyId) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const eventId = Number(req.params.id);
            const { userId } = req.body;

            if (isNaN(eventId) || !userId) {
                return ResponseHandler.badRequest(res, 'Event ID and userId are required');
            }

            const share = await this.calendarService.shareEvent(eventId, req.user.id, req.user.companyId, Number(userId));
            if (!share) {
                return ResponseHandler.notFound(res, 'Event not found or not authorized');
            }

            return ResponseHandler.success(res, share, 'Event shared successfully');
        } catch (error: any) {
            console.error('Error sharing event:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to share event');
        }
    }

    async unshareEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user || !req.user.companyId) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const eventId = Number(req.params.id);
            const userId = Number(req.params.userId);

            if (isNaN(eventId) || isNaN(userId)) {
                return ResponseHandler.badRequest(res, 'Valid event ID and user ID are required');
            }

            const unshared = await this.calendarService.unshareEvent(eventId, req.user.id, req.user.companyId, userId);
            if (!unshared) {
                return ResponseHandler.notFound(res, 'Event not found or not shared with this user');
            }

            return ResponseHandler.success(res, { unshared: true }, 'Event unshared successfully');
        } catch (error: any) {
            console.error('Error unsharing event:', error);
            return ResponseHandler.internalError(res, 'Failed to unshare event');
        }
    }

    async getSharedUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user || !req.user.companyId) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const eventId = Number(req.params.id);
            if (isNaN(eventId)) {
                return ResponseHandler.badRequest(res, 'Invalid event ID');
            }

            const sharedWith = await this.calendarService.getSharedUsers(eventId, req.user.id, req.user.companyId);
            if (sharedWith === null) {
                return ResponseHandler.notFound(res, 'Event not found');
            }

            return ResponseHandler.success(res, { sharedWith }, 'Shared users fetched successfully');
        } catch (error: any) {
            console.error('Error fetching shared users:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch shared users');
        }
    }
}
