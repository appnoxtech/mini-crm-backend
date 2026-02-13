import { EventReminderModel, EventReminder } from '../models/EventReminder';
import { CalendarEventModel } from '../models/CalendarEvent';
import { NotificationSchedulerService } from './notificationSchedulerService';

export class ReminderService {
    constructor(
        private reminderModel: EventReminderModel,
        private eventModel: CalendarEventModel,
        private notificationScheduler: NotificationSchedulerService
    ) { }

    async addReminder(eventId: number, userId: number, companyId: number, minutesBefore: number): Promise<EventReminder | null> {
        // Verify user owns the event
        const event = await this.eventModel.findById(eventId, companyId, userId);
        if (!event) return null;

        // Remove default reminder when adding custom
        await this.reminderModel.deleteDefaultByEventId(eventId, companyId);

        // Create the new reminder
        const reminder = await this.reminderModel.create({
            eventId,
            companyId,
            reminderMinutesBefore: minutesBefore,
            isDefault: false
        });

        // Schedule notification for this reminder
        const reminders = await this.reminderModel.findByEventId(eventId, companyId);
        await this.notificationScheduler.rescheduleForEvent(event, reminders);

        return reminder;
    }

    async updateReminder(reminderId: number, userId: number, companyId: number, minutesBefore: number): Promise<EventReminder | null> {
        const reminder = await this.reminderModel.findById(reminderId, companyId);
        if (!reminder) return null;

        // Verify user owns the event
        const event = await this.eventModel.findById(reminder.eventId, companyId, userId);
        if (!event) return null;

        const updatedReminder = await this.reminderModel.update(reminderId, companyId, { reminderMinutesBefore: minutesBefore });
        if (!updatedReminder) return null;

        // Reschedule notifications
        const reminders = await this.reminderModel.findByEventId(reminder.eventId, companyId);
        await this.notificationScheduler.rescheduleForEvent(event, reminders);

        return updatedReminder;
    }

    async deleteReminder(reminderId: number, userId: number, companyId: number): Promise<boolean> {
        const reminder = await this.reminderModel.findById(reminderId, companyId);
        if (!reminder) return false;

        // Verify user owns the event
        const event = await this.eventModel.findById(reminder.eventId, companyId, userId);
        if (!event) return false;

        // Delete the reminder and its notifications
        await this.notificationScheduler.removeForReminder(reminderId, companyId);
        const deleted = await this.reminderModel.delete(reminderId, companyId);

        if (deleted) {
            // If no custom reminders left, add default back
            await this.reminderModel.ensureDefaultReminder(reminder.eventId, companyId, 30);

            // Reschedule with updated reminders
            const reminders = await this.reminderModel.findByEventId(reminder.eventId, companyId);
            await this.notificationScheduler.rescheduleForEvent(event, reminders);
        }

        return deleted;
    }

    async getReminders(eventId: number, companyId: number): Promise<EventReminder[]> {
        return await this.reminderModel.findByEventId(eventId, companyId);
    }
}
