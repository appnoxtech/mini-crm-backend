import { CalendarEventModel, CalendarEvent } from '../models/CalendarEvent';
import { EventReminderModel, EventReminder } from '../models/EventReminder';
import { EventShareModel, EventShare } from '../models/EventShare';
import { NotificationSchedulerService } from './notificationSchedulerService';

export interface CreateEventInput {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    location?: string;
    isAllDay?: boolean;
    reminders?: { minutesBefore: number }[];
    sharedWith?: number[];
}

export interface UpdateEventInput {
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    isAllDay?: boolean;
    sharedWith?: number[];
}

export class CalendarService {
    constructor(
        private eventModel: CalendarEventModel,
        private reminderModel: EventReminderModel,
        private shareModel: EventShareModel,
        private notificationScheduler: NotificationSchedulerService
    ) { }

    async createEvent(userId: number, data: CreateEventInput): Promise<{
        event: CalendarEvent;
        reminders: EventReminder[];
        shares: EventShare[];
    }> {
        // Create the event
        const event = await this.eventModel.create({
            userId,
            title: data.title,
            description: data.description,
            startTime: data.startTime,
            endTime: data.endTime,
            location: data.location,
            isAllDay: data.isAllDay || false
        });

        // Create custom reminders if provided
        const reminders: EventReminder[] = [];
        if (data.reminders && data.reminders.length > 0) {
            for (const r of data.reminders) {
                const reminder = await this.reminderModel.create({
                    eventId: event.id,
                    reminderMinutesBefore: r.minutesBefore,
                    isDefault: false
                });
                reminders.push(reminder);
            }
        } else {
            // Add default 30-minute reminder if no custom reminders
            const defaultReminder = await this.reminderModel.ensureDefaultReminder(event.id, 30);
            if (defaultReminder) {
                reminders.push(defaultReminder);
            }
        }

        // Share with specified users
        const shares: EventShare[] = [];
        if (data.sharedWith && data.sharedWith.length > 0) {
            for (const sharedUserId of data.sharedWith) {
                const share = await this.shareModel.share(event.id, sharedUserId);
                if (share) {
                    shares.push(share);
                }
            }
        }

        // Schedule notifications for owner and shared users
        await this.notificationScheduler.scheduleForEvent(event, reminders);

        return { event, reminders, shares };
    }

    async getEvents(userId: number, filters: {
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
    } = {}): Promise<{ events: CalendarEvent[]; total: number; page: number; limit: number }> {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        const result = await this.eventModel.findAccessible(userId, {
            startDate: filters.startDate,
            endDate: filters.endDate,
            limit,
            offset
        });

        return {
            events: result.events,
            total: result.total,
            page,
            limit
        };
    }

    async getEventById(eventId: number, userId: number): Promise<{
        event: CalendarEvent;
        reminders: EventReminder[];
        sharedWith: { id: number; name: string; email: string; type: string }[];
        isOwner: boolean;
    } | null> {
        // Try to find as owner first
        let event = await this.eventModel.findById(eventId, userId);
        let isOwner = true;

        if (!event) {
            // Check if shared with user
            if (await this.shareModel.isSharedWith(eventId, userId)) {
                event = await this.eventModel.findById(eventId);
                isOwner = false;
            }
        }

        if (!event) return null;

        const reminders = await this.reminderModel.findByEventId(eventId);
        const sharedWith = await this.shareModel.getSharedUsersDetails(eventId);

        return { event, reminders, sharedWith, isOwner };
    }

    async updateEvent(eventId: number, userId: number, data: UpdateEventInput): Promise<{
        event: CalendarEvent;
        reminders: EventReminder[];
        sharedWith: { id: number; name: string; email: string; type: string }[];
        timesChanged: boolean;
    } | null> {
        const existing = await this.eventModel.findById(eventId, userId);
        if (!existing) return null;

        const timesChanged = Boolean((data.startTime && data.startTime !== existing.startTime) ||
            (data.endTime && data.endTime !== existing.endTime));

        const updatedEvent = await this.eventModel.update(eventId, userId, data);
        if (!updatedEvent) return null;

        // Handle Sharing Updates
        if (data.sharedWith) {
            const currentSharedIds = await this.shareModel.getSharedUserIds(eventId);
            const newSharedIds = data.sharedWith;

            // Find users to add
            const toAdd = newSharedIds.filter(id => !currentSharedIds.includes(id));
            for (const id of toAdd) {
                await this.shareModel.share(eventId, id);
            }

            // Find users to remove
            const toRemove = currentSharedIds.filter(id => !newSharedIds.includes(id));
            for (const id of toRemove) {
                await this.shareModel.unshare(eventId, id);
                await this.notificationScheduler.removeForUser(eventId, id);
            }

            // If shares changed, we might need to schedule new notifications for added users
            if (toAdd.length > 0 && !timesChanged) {
                const reminders = await this.reminderModel.findByEventId(eventId);
                for (const id of toAdd) {
                    await this.notificationScheduler.scheduleForUser(updatedEvent, reminders, id);
                }
            }
        }

        const reminders = await this.reminderModel.findByEventId(eventId);

        // If times changed, reschedule all notifications (for owner + all currently shared)
        if (timesChanged) {
            await this.notificationScheduler.rescheduleForEvent(updatedEvent, reminders);
        }

        const sharedWith = await this.shareModel.getSharedUsersDetails(eventId);

        return { event: updatedEvent, reminders, sharedWith, timesChanged };
    }

    async deleteEvent(eventId: number, userId: number): Promise<boolean> {
        // Cascade delete will handle reminders, shares, and notifications
        return await this.eventModel.delete(eventId, userId);
    }

    async shareEvent(eventId: number, ownerId: number, shareWithUserId: number): Promise<EventShare | null> {
        // Verify ownership
        const event = await this.eventModel.findById(eventId, ownerId);
        if (!event) return null;

        const share = await this.shareModel.share(eventId, shareWithUserId);
        if (!share) return null;

        // Schedule notifications for the new shared user
        const reminders = await this.reminderModel.findByEventId(eventId);
        await this.notificationScheduler.scheduleForUser(event, reminders, shareWithUserId);

        return share;
    }

    async unshareEvent(eventId: number, ownerId: number, unshareUserId: number): Promise<boolean> {
        // Verify ownership
        const event = await this.eventModel.findById(eventId, ownerId);
        if (!event) return false;

        // Remove notifications for this user
        await this.notificationScheduler.removeForUser(eventId, unshareUserId);

        return await this.shareModel.unshare(eventId, unshareUserId);
    }

    async getSharedUsers(eventId: number, userId: number): Promise<{ id: number; name: string; email: string; type: string }[] | null> {
        // Verify access
        const access = await this.getEventById(eventId, userId);
        if (!access) return null;

        return await this.shareModel.getSharedUsersDetails(eventId);
    }
}
