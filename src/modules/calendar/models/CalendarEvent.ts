import { prisma } from '../../../shared/prisma';
import { BaseEntity } from '../../../shared/types';

export interface CalendarEvent extends BaseEntity {
    userId: number;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    location?: string;
    isAllDay: boolean;
    deletedAt?: string;
}

export class CalendarEventModel {
    constructor(_db?: any) { }

    initialize(): void {
        // No-op with Prisma
    }

    private mapPrismaToCalendarEvent(event: any): CalendarEvent {
        return {
            id: event.id,
            userId: event.userId,
            title: event.title,
            description: event.description || undefined,
            startTime: event.startTime.toISOString(),
            endTime: event.endTime.toISOString(),
            location: event.location || undefined,
            isAllDay: event.isAllDay,
            createdAt: event.createdAt.toISOString(),
            updatedAt: event.updatedAt.toISOString(),
            deletedAt: event.deletedAt?.toISOString() || undefined
        };
    }

    async create(data: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<CalendarEvent> {
        const event = await prisma.calendarEvent.create({
            data: {
                userId: data.userId,
                title: data.title,
                description: data.description || null,
                startTime: new Date(data.startTime),
                endTime: new Date(data.endTime),
                location: data.location || null,
                isAllDay: data.isAllDay
            }
        });

        return this.mapPrismaToCalendarEvent(event);
    }

    async findById(id: number, userId?: number): Promise<CalendarEvent | null> {
        const where: any = { id, deletedAt: null };
        if (userId !== undefined) {
            where.userId = userId;
        }

        const event = await prisma.calendarEvent.findFirst({
            where
        });

        return event ? this.mapPrismaToCalendarEvent(event) : null;
    }

    async findByUserId(userId: number, filters: {
        startDate?: string;
        endDate?: string;
        limit?: number;
        offset?: number;
    } = {}): Promise<{ events: CalendarEvent[]; total: number }> {
        const where: any = {
            userId,
            deletedAt: null
        };

        if (filters.startDate) {
            where.startTime = { gte: new Date(filters.startDate) };
        }

        if (filters.endDate) {
            where.startTime = { ...where.startTime, lte: new Date(filters.endDate) };
        }

        const [events, total] = await Promise.all([
            prisma.calendarEvent.findMany({
                where,
                orderBy: { startTime: 'asc' },
                take: filters.limit,
                skip: filters.offset
            }),
            prisma.calendarEvent.count({ where })
        ]);

        return {
            events: events.map((e: any) => this.mapPrismaToCalendarEvent(e)),
            total
        };
    }

    async findAccessible(userId: number, filters: {
        startDate?: string;
        endDate?: string;
        limit?: number;
        offset?: number;
    } = {}): Promise<{ events: CalendarEvent[]; total: number }> {
        const where: any = {
            deletedAt: null,
            OR: [
                { userId },
                { shares: { some: { sharedWithUserId: userId, participantType: 'user' } } }
            ]
        };

        if (filters.startDate) {
            where.startTime = { gte: new Date(filters.startDate) };
        }

        if (filters.endDate) {
            where.startTime = { ...where.startTime, lte: new Date(filters.endDate) };
        }

        const [events, total] = await Promise.all([
            prisma.calendarEvent.findMany({
                where,
                orderBy: { startTime: 'asc' },
                take: filters.limit,
                skip: filters.offset,
                distinct: ['id']
            }),
            prisma.calendarEvent.count({ where })
        ]);

        return {
            events: events.map((e: any) => this.mapPrismaToCalendarEvent(e)),
            total
        };
    }

    async findUpcoming(withinMinutes: number): Promise<CalendarEvent[]> {
        const now = new Date();
        const future = new Date(now.getTime() + withinMinutes * 60 * 1000);

        const events = await prisma.calendarEvent.findMany({
            where: {
                deletedAt: null,
                startTime: {
                    gte: now,
                    lte: future
                }
            },
            orderBy: { startTime: 'asc' }
        });

        return events.map((e: any) => this.mapPrismaToCalendarEvent(e));
    }

    async update(id: number, userId: number, data: Partial<Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<CalendarEvent | null> {
        const existing = await this.findById(id, userId);
        if (!existing) return null;

        const updateData: any = {};
        if (data.title !== undefined) updateData.title = data.title;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.startTime !== undefined) updateData.startTime = new Date(data.startTime);
        if (data.endTime !== undefined) updateData.endTime = new Date(data.endTime);
        if (data.location !== undefined) updateData.location = data.location;
        if (data.isAllDay !== undefined) updateData.isAllDay = data.isAllDay;

        if (Object.keys(updateData).length === 0) return existing;

        const updated = await prisma.calendarEvent.update({
            where: { id },
            data: updateData
        });

        return this.mapPrismaToCalendarEvent(updated);
    }

    async delete(id: number, userId: number): Promise<boolean> {
        try {
            await prisma.calendarEvent.update({
                where: { id, userId },
                data: { deletedAt: new Date() }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async hardDelete(id: number, userId: number): Promise<boolean> {
        try {
            await prisma.calendarEvent.delete({
                where: { id, userId }
            });
            return true;
        } catch (error) {
            return false;
        }
    }
}
