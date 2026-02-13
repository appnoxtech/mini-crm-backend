import { prisma } from '../../../shared/prisma';

export interface EventReminder {
    id: number;
    eventId: number;
    companyId: number;
    reminderMinutesBefore: number;
    isDefault: boolean;
    createdAt: string;
}

export class EventReminderModel {
    constructor() { }

    initialize(): void { }

    private mapPrismaToReminder(reminder: any): EventReminder {
        return {
            id: reminder.id,
            eventId: reminder.eventId,
            companyId: reminder.companyId,
            reminderMinutesBefore: reminder.reminderMinutesBefore,
            isDefault: reminder.isDefault,
            createdAt: reminder.createdAt.toISOString()
        };
    }

    async create(data: { eventId: number; companyId: number; reminderMinutesBefore: number; isDefault?: boolean }): Promise<EventReminder> {
        const reminder = await prisma.eventReminder.create({
            data: {
                eventId: data.eventId,
                companyId: data.companyId,
                reminderMinutesBefore: data.reminderMinutesBefore,
                isDefault: data.isDefault || false
            }
        });

        return this.mapPrismaToReminder(reminder);
    }

    async findById(id: number, companyId: number): Promise<EventReminder | null> {
        const reminder = await prisma.eventReminder.findFirst({
            where: { id, companyId }
        });
        return reminder ? this.mapPrismaToReminder(reminder) : null;
    }

    async findByEventId(eventId: number, companyId: number): Promise<EventReminder[]> {
        const reminders = await prisma.eventReminder.findMany({
            where: { eventId, companyId },
            orderBy: { reminderMinutesBefore: 'asc' }
        });

        return reminders.map((r: any) => this.mapPrismaToReminder(r));
    }

    async update(id: number, companyId: number, data: { reminderMinutesBefore?: number }): Promise<EventReminder | null> {
        if (data.reminderMinutesBefore === undefined) {
            return this.findById(id, companyId);
        }

        const updated = await prisma.eventReminder.updateMany({
            where: { id, companyId },
            data: { reminderMinutesBefore: data.reminderMinutesBefore }
        });

        if (updated.count === 0) return null;
        return this.findById(id, companyId);
    }

    async delete(id: number, companyId: number): Promise<boolean> {
        try {
            await prisma.eventReminder.deleteMany({
                where: { id, companyId }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async deleteByEventId(eventId: number, companyId: number): Promise<boolean> {
        try {
            await prisma.eventReminder.deleteMany({
                where: { eventId, companyId }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async deleteDefaultByEventId(eventId: number, companyId: number): Promise<boolean> {
        try {
            await prisma.eventReminder.deleteMany({
                where: { eventId, companyId, isDefault: true }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async hasCustomReminders(eventId: number, companyId: number): Promise<boolean> {
        const count = await prisma.eventReminder.count({
            where: { eventId, companyId, isDefault: false }
        });
        return count > 0;
    }

    async ensureDefaultReminder(eventId: number, companyId: number, defaultMinutes: number = 30): Promise<EventReminder | null> {
        // Only add default if no custom reminders exist
        if (await this.hasCustomReminders(eventId, companyId)) {
            return null;
        }

        // Check if default already exists
        const existing = await prisma.eventReminder.findFirst({
            where: { eventId, companyId, isDefault: true }
        });

        if (existing) {
            return this.mapPrismaToReminder(existing);
        }

        return this.create({
            eventId,
            companyId,
            reminderMinutesBefore: defaultMinutes,
            isDefault: true
        });
    }
}
