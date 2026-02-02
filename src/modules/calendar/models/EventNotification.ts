import { prisma } from '../../../shared/prisma';

export type NotificationType = 'in-app' | 'email' | 'push';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

export interface EventNotification {
    id: number;
    eventId: number;
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
    constructor(_db?: any) { }

    initialize(): void {
        // No-op with Prisma
    }

    private mapPrismaToNotification(n: any): EventNotification {
        return {
            id: n.id,
            eventId: n.eventId,
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
        userId: number;
        reminderId: number;
        scheduledAt: string;
        userType?: string;
    }): Promise<EventNotification> {
        const n = await prisma.eventNotification.create({
            data: {
                eventId: data.eventId,
                userId: data.userId,
                reminderId: data.reminderId,
                scheduledAt: new Date(data.scheduledAt),
                userType: data.userType || 'user',
                status: 'pending'
            }
        });

        return this.mapPrismaToNotification(n);
    }

    async findById(id: number): Promise<EventNotification | null> {
        const n = await prisma.eventNotification.findUnique({
            where: { id }
        });
        return n ? this.mapPrismaToNotification(n) : null;
    }

    async findByEventId(eventId: number): Promise<EventNotification[]> {
        const notifications = await prisma.eventNotification.findMany({
            where: { eventId },
            orderBy: { scheduledAt: 'asc' }
        });

        return notifications.map((n: any) => this.mapPrismaToNotification(n));
    }

    async findByUserId(userId: number, filters: {
        status?: string;
        limit?: number;
        offset?: number;
    } = {}): Promise<{ notifications: EventNotification[]; total: number }> {
        const where: any = { userId };
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

    async updateStatus(id: number, status: string, failureReason?: string): Promise<boolean> {
        const updateData: any = { status };
        if (failureReason) {
            updateData.failureReason = failureReason;
        }

        try {
            await prisma.eventNotification.update({
                where: { id },
                data: updateData
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async markSent(id: number, channel: 'inApp' | 'email'): Promise<boolean> {
        const updateData: any = {};
        if (channel === 'inApp') {
            updateData.inAppSentAt = new Date();
        } else {
            updateData.emailSentAt = new Date();
        }

        // If both are sent, or if it's just the one we care about, we might mark as completed
        // For now, let's just update the timestamp. If all requested channels are sent, we can mark as 'sent'
        // Actually, let's check if it's fully sent
        try {
            const current = await prisma.eventNotification.findUnique({ where: { id } });
            if (current) {
                const isEmailSent = channel === 'email' || !!current.emailSentAt;
                const isInAppSent = channel === 'inApp' || !!current.inAppSentAt;
                if (isEmailSent && isInAppSent) {
                    updateData.status = 'sent';
                }
            }

            await prisma.eventNotification.update({
                where: { id },
                data: updateData
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async markFailed(id: number, reason: string): Promise<boolean> {
        try {
            await prisma.eventNotification.update({
                where: { id },
                data: {
                    status: 'failed',
                    failureReason: reason
                }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async cancelByReminderId(reminderId: number): Promise<boolean> {
        try {
            await prisma.eventNotification.updateMany({
                where: { reminderId, status: 'pending' },
                data: { status: 'cancelled' }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async deleteByReminderId(reminderId: number): Promise<boolean> {
        try {
            await prisma.eventNotification.deleteMany({
                where: { reminderId }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async cancelByEventId(eventId: number): Promise<boolean> {
        try {
            await prisma.eventNotification.updateMany({
                where: { eventId, status: 'pending' },
                data: { status: 'cancelled' }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async deleteByEventId(eventId: number): Promise<boolean> {
        try {
            await prisma.eventNotification.deleteMany({
                where: { eventId }
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
