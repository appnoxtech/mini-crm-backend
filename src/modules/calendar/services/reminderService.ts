import { EventReminderModel, EventReminder } from '../models/EventReminder';
import { CalendarEventModel } from '../models/CalendarEvent';
import { NotificationSchedulerService } from './notificationSchedulerService';

export class ReminderService {
    constructor(
        private reminderModel: EventReminderModel,
        private eventModel: CalendarEventModel,
        private notificationScheduler: NotificationSchedulerService
    ) { }

    async addReminder(eventId: number, userId: number, minutesBefore: number): Promise<EventReminder | null> {
        // Verify user owns the event
        const event = this.eventModel.findById(eventId, userId);
        if (!event) return null;

        // Remove default reminder when adding custom
        this.reminderModel.deleteDefaultByEventId(eventId);

        // Create the new reminder
        const reminder = this.reminderModel.create({
            eventId,
            reminderMinutesBefore: minutesBefore,
            isDefault: false
        });

        // Schedule notification for this reminder
        const reminders = this.reminderModel.findByEventId(eventId);
        await this.notificationScheduler.rescheduleForEvent(event, reminders);

        return reminder;
    }

    async updateReminder(reminderId: number, userId: number, minutesBefore: number): Promise<EventReminder | null> {
        const reminder = this.reminderModel.findById(reminderId);
        if (!reminder) return null;

        // Verify user owns the event
        const event = this.eventModel.findById(reminder.eventId, userId);
        if (!event) return null;

        const updatedReminder = this.reminderModel.update(reminderId, { reminderMinutesBefore: minutesBefore });
        if (!updatedReminder) return null;

        // Reschedule notifications
        const reminders = this.reminderModel.findByEventId(reminder.eventId);
        await this.notificationScheduler.rescheduleForEvent(event, reminders);

        return updatedReminder;
    }

    async deleteReminder(reminderId: number, userId: number): Promise<boolean> {
        const reminder = this.reminderModel.findById(reminderId);
        if (!reminder) return false;

        // Verify user owns the event
        const event = this.eventModel.findById(reminder.eventId, userId);
        if (!event) return false;

        // Delete the reminder and its notifications
        this.notificationScheduler.removeForReminder(reminderId);
        const deleted = this.reminderModel.delete(reminderId);

        if (deleted) {
            // If no custom reminders left, add default back
            this.reminderModel.ensureDefaultReminder(reminder.eventId, 30);

            // Reschedule with updated reminders
            const reminders = this.reminderModel.findByEventId(reminder.eventId);
            await this.notificationScheduler.rescheduleForEvent(event, reminders);
        }

        return deleted;
    }

    getReminders(eventId: number): EventReminder[] {
        return this.reminderModel.findByEventId(eventId);
    }
}
