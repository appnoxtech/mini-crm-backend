import { prisma } from '../../../shared/prisma';

export interface EventReminder {
    id: number;
    eventId: number;
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
            reminderMinutesBefore: reminder.reminderMinutesBefore,
            isDefault: reminder.isDefault,
            createdAt: reminder.createdAt.toISOString()
        };
    }

    async create(data: { eventId: number; reminderMinutesBefore: number; isDefault?: boolean }): Promise<EventReminder> {
        const reminder = await prisma.eventReminder.create({
            data: {
                eventId: data.eventId,
                reminderMinutesBefore: data.reminderMinutesBefore,
                isDefault: data.isDefault || false
            }
        });

        return this.mapPrismaToReminder(reminder);
    }

    async findById(id: number): Promise<EventReminder | null> {
        const reminder = await prisma.eventReminder.findUnique({
            where: { id }
        });
        return reminder ? this.mapPrismaToReminder(reminder) : null;
    }

    async findByEventId(eventId: number): Promise<EventReminder[]> {
        const reminders = await prisma.eventReminder.findMany({
            where: { eventId },
            orderBy: { reminderMinutesBefore: 'asc' }
        });

        return reminders.map((r: any) => this.mapPrismaToReminder(r));
    }

    async update(id: number, data: { reminderMinutesBefore?: number }): Promise<EventReminder | null> {
        if (data.reminderMinutesBefore === undefined) {
            return this.findById(id);
        }

        const updated = await prisma.eventReminder.update({
            where: { id },
            data: { reminderMinutesBefore: data.reminderMinutesBefore }
        });

        return this.mapPrismaToReminder(updated);
    }

    async delete(id: number): Promise<boolean> {
        try {
            await prisma.eventReminder.delete({
                where: { id }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async deleteByEventId(eventId: number): Promise<boolean> {
        try {
            await prisma.eventReminder.deleteMany({
                where: { eventId }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async deleteDefaultByEventId(eventId: number): Promise<boolean> {
        try {
            await prisma.eventReminder.deleteMany({
                where: { eventId, isDefault: true }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async hasCustomReminders(eventId: number): Promise<boolean> {
        const count = await prisma.eventReminder.count({
            where: { eventId, isDefault: false }
        });
        return count > 0;
    }

    async ensureDefaultReminder(eventId: number, defaultMinutes: number = 30): Promise<EventReminder | null> {
        // Only add default if no custom reminders exist
        if (await this.hasCustomReminders(eventId)) {
            return null;
        }

        // Check if default already exists
        const existing = await prisma.eventReminder.findFirst({
            where: { eventId, isDefault: true }
        });

        if (existing) {
            return this.mapPrismaToReminder(existing);
        }

        return this.create({
            eventId,
            reminderMinutesBefore: defaultMinutes,
            isDefault: true
        });
    }
}
