import { prisma } from '../../../shared/prisma';

export type NotificationType = 'in-app' | 'email' | 'push';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

export interface EventNotification {
    id: number;
    eventId: number;
    companyId: number;
    userId: number;
    reminderId: number;
    userType: string;
    type?: NotificationType; // Kept for compatibility if needed, though schema doesn't have it
    status: string;
    scheduledAt: string;
    inAppSentAt?: string;
    emailSentAt?: string;
    failureReason?: string;
    createdAt: string;
    updatedAt: string;
}

export class EventNotificationModel {
    constructor() { }

    initialize(): void { }

    private mapPrismaToNotification(n: any): EventNotification {
        return {
            id: n.id,
            eventId: n.eventId,
            companyId: n.companyId,
            userId: n.userId,
            reminderId: n.reminderId,
            userType: n.userType,
            status: n.status,
            scheduledAt: n.scheduledAt.toISOString(),
            inAppSentAt: n.inAppSentAt?.toISOString() || undefined,
            emailSentAt: n.emailSentAt?.toISOString() || undefined,
            failureReason: n.failureReason || undefined,
            createdAt: n.createdAt.toISOString(),
            updatedAt: n.updatedAt.toISOString()
        };
    }

    async create(data: {
        eventId: number;
        companyId: number;
        userId: number;
        reminderId: number;
        scheduledAt: string;
        userType?: string;
    }): Promise<EventNotification> {
        const n = await prisma.eventNotification.create({
            data: {
                eventId: data.eventId,
                companyId: data.companyId,
                userId: data.userId,
                reminderId: data.reminderId,
                scheduledAt: new Date(data.scheduledAt),
                userType: data.userType || 'user',
                status: 'pending'
            }
        });

        return this.mapPrismaToNotification(n);
    }

    async findById(id: number, companyId: number): Promise<EventNotification | null> {
        const n = await prisma.eventNotification.findFirst({
            where: { id, companyId }
        });
        return n ? this.mapPrismaToNotification(n) : null;
    }

    async findByEventId(eventId: number, companyId: number): Promise<EventNotification[]> {
        const notifications = await prisma.eventNotification.findMany({
            where: { eventId, companyId },
            orderBy: { scheduledAt: 'asc' }
        });

        return notifications.map((n: any) => this.mapPrismaToNotification(n));
    }

    async findByUserId(userId: number, companyId: number, filters: {
        status?: string;
        limit?: number;
        offset?: number;
    } = {}): Promise<{ notifications: EventNotification[]; total: number }> {
        const where: any = { userId, companyId };
        if (filters.status) {
            where.status = filters.status;
        }

        const [notifications, total] = await Promise.all([
            prisma.eventNotification.findMany({
                where,
                orderBy: { scheduledAt: 'desc' },
                take: filters.limit,
                skip: filters.offset
            }),
            prisma.eventNotification.count({ where })
        ]);

        return {
            notifications: notifications.map((n: any) => this.mapPrismaToNotification(n)),
            total
        };
    }

    async findAll(filters: {
        status?: string;
        userId?: number;
        companyId?: number;
        limit?: number;
        offset?: number;
    } = {}): Promise<{ notifications: EventNotification[]; total: number }> {
        const where: any = {};
        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.userId) {
            where.userId = filters.userId;
        }
        if (filters.companyId) {
            where.companyId = filters.companyId;
        }

        const [notifications, total] = await Promise.all([
            prisma.eventNotification.findMany({
                where,
                orderBy: { scheduledAt: 'desc' },
                take: filters.limit,
                skip: filters.offset
            }),
            prisma.eventNotification.count({ where })
        ]);

        return {
            notifications: notifications.map((n: any) => this.mapPrismaToNotification(n)),
            total
        };
    }

    async findPending(limit: number = 100): Promise<EventNotification[]> {
        const now = new Date();
        const notifications = await prisma.eventNotification.findMany({
            where: {
                status: 'pending',
                scheduledAt: { lte: now }
            },
            take: limit,
            orderBy: { scheduledAt: 'asc' }
        });

        return notifications.map((n: any) => this.mapPrismaToNotification(n));
    }

    async updateStatus(id: number, companyId: number, status: string, failureReason?: string): Promise<boolean> {
        const updateData: any = { status };
        if (failureReason) {
            updateData.failureReason = failureReason;
        }

        try {
            const updated = await prisma.eventNotification.updateMany({
                where: { id, companyId },
                data: updateData
            });
            return updated.count > 0;
        } catch (error) {
            return false;
        }
    }

    async markSent(id: number, companyId: number, channel: 'inApp' | 'email'): Promise<boolean> {
        const updateData: any = {};
        if (channel === 'inApp') {
            updateData.inAppSentAt = new Date();
        } else {
            updateData.emailSentAt = new Date();
        }

        try {
            const current = await prisma.eventNotification.findFirst({
                where: { id, companyId }
            });
            if (current) {
                const isEmailSent = channel === 'email' || !!current.emailSentAt;
                const isInAppSent = channel === 'inApp' || !!current.inAppSentAt;
                if (isEmailSent && isInAppSent) {
                    updateData.status = 'sent';
                }
            } else {
                return false;
            }

            await prisma.eventNotification.updateMany({
                where: { id, companyId },
                data: updateData
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async markFailed(id: number, companyId: number, reason: string): Promise<boolean> {
        try {
            const updated = await prisma.eventNotification.updateMany({
                where: { id, companyId },
                data: {
                    status: 'failed',
                    failureReason: reason
                }
            });
            return updated.count > 0;
        } catch (error) {
            return false;
        }
    }

    async cancelByReminderId(reminderId: number, companyId: number): Promise<boolean> {
        try {
            await prisma.eventNotification.updateMany({
                where: { reminderId, companyId, status: 'pending' },
                data: { status: 'cancelled' }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async deleteByReminderId(reminderId: number, companyId: number): Promise<boolean> {
        try {
            await prisma.eventNotification.deleteMany({
                where: { reminderId, companyId }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async cancelByEventId(eventId: number, companyId: number): Promise<boolean> {
        try {
            await prisma.eventNotification.updateMany({
                where: { eventId, companyId, status: 'pending' },
                data: { status: 'cancelled' }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async deleteByEventId(eventId: number, companyId: number): Promise<boolean> {
        try {
            await prisma.eventNotification.deleteMany({
                where: { eventId, companyId }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async deleteExpired(daysOld: number = 30): Promise<number> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysOld);

        const result = await prisma.eventNotification.deleteMany({
            where: {
                status: { in: ['sent', 'cancelled', 'failed'] },
                createdAt: { lte: cutoff }
            }
        });

        return result.count;
    }
}
