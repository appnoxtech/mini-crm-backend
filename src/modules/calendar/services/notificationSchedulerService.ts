import { CalendarEvent } from '../models/CalendarEvent';
import { EventReminder } from '../models/EventReminder';
import { EventNotificationModel } from '../models/EventNotification';
import { EventShareModel } from '../models/EventShare';

export class NotificationSchedulerService {
    constructor(
        private notificationModel: EventNotificationModel,
        private shareModel: EventShareModel
    ) { }

    /**
     * Schedule notifications for an event for the owner and all shared users
     */
    async scheduleForEvent(event: CalendarEvent, reminders: EventReminder[]): Promise<void> {
        // Get all users who should receive notifications
        const userIds = [event.userId, ...(await this.shareModel.getSharedUserIds(event.id, event.companyId))];

        for (const userId of userIds) {
            await this.scheduleForUser(event, reminders, userId);
        }
    }

    /**
     * Schedule notifications for a specific user
     */
    async scheduleForUser(event: CalendarEvent, reminders: EventReminder[], userId: number): Promise<void> {
        const eventStart = new Date(event.startTime);

        for (const reminder of reminders) {
            const scheduledAt = new Date(eventStart.getTime() - reminder.reminderMinutesBefore * 60 * 1000);

            // Only schedule if in the future
            if (scheduledAt > new Date()) {
                // Idempotent - will not create duplicate due to UNIQUE constraint
                await this.notificationModel.create({
                    eventId: event.id,
                    companyId: event.companyId,
                    reminderId: reminder.id,
                    userId,
                    scheduledAt: scheduledAt.toISOString()
                });
            }
        }
    }

    /**
     * Reschedule all notifications for an event (after time change)
     */
    async rescheduleForEvent(event: CalendarEvent, reminders: EventReminder[]): Promise<void> {
        // Delete all pending notifications for this event
        await this.notificationModel.deleteByEventId(event.id, event.companyId);

        // Reschedule
        await this.scheduleForEvent(event, reminders);
    }

    /**
     * Remove notifications for a specific user (when unsharing)
     */
    async removeForUser(eventId: number, userId: number): Promise<void> {
        // This requires a custom query - add to model if needed
        // For now, the notifications will be orphaned but won't cause issues
        // The cron job can skip notifications for unshared users
    }

    /**
     * Remove notifications for a specific reminder (when deleting reminder)
     */
    async removeForReminder(reminderId: number, companyId: number): Promise<void> {
        await this.notificationModel.deleteByReminderId(reminderId, companyId);
    }

    /**
     * Calculate remaining time until event
     */
    static calculateTimeRemaining(eventStartTime: string): string {
        const now = new Date();
        const start = new Date(eventStartTime);
        const diffMs = start.getTime() - now.getTime();

        if (diffMs <= 0) {
            return 'now';
        }

        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) {
            return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
        } else if (diffHours > 0) {
            const remainingMinutes = diffMinutes % 60;
            if (remainingMinutes > 0) {
                return `in ${diffHours}h ${remainingMinutes}m`;
            }
            return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
        } else {
            return `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
        }
    }
}
