import { Request, Response } from 'express';
import { EventNotificationModel } from '../models/EventNotification';
import { AuthenticatedRequest } from '../../../shared/types';
import { ResponseHandler } from '../../../shared/responses/responses';

export class NotificationController {
    constructor(private notificationModel: EventNotificationModel) { }

    async getMyNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { status, page, limit } = req.query;

            const result = this.notificationModel.findByUserId(req.user.id, {
                status: status as any,
                limit: limit ? Number(limit) : 20,
                offset: page ? (Number(page) - 1) * (Number(limit) || 20) : 0
            });

            return ResponseHandler.success(res, {
                notifications: result.notifications,
                pagination: {
                    total: result.total,
                    page: Number(page) || 1,
                    limit: Number(limit) || 20,
                    totalPages: Math.ceil(result.total / (Number(limit) || 20))
                }
            }, 'Notifications fetched successfully');
        } catch (error: any) {
            console.error('Error fetching notifications:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch notifications');
        }
    }

    async getNotificationLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            // Check admin role
            if (req.user.role !== 'admin') {
                return ResponseHandler.forbidden(res, 'Admin access required');
            }

            const { status, userId, page, limit } = req.query;

            const result = this.notificationModel.findAll({
                status: status as any,
                userId: userId ? Number(userId) : undefined,
                limit: limit ? Number(limit) : 50,
                offset: page ? (Number(page) - 1) * (Number(limit) || 50) : 0
            });

            return ResponseHandler.success(res, {
                notifications: result.notifications,
                pagination: {
                    total: result.total,
                    page: Number(page) || 1,
                    limit: Number(limit) || 50,
                    totalPages: Math.ceil(result.total / (Number(limit) || 50))
                }
            }, 'Notification logs fetched successfully');
        } catch (error: any) {
            console.error('Error fetching notification logs:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch notification logs');
        }
    }
}
