import { NotificationDispatcherService } from '../modules/calendar/services/notificationDispatcherService';

let dispatcherService: NotificationDispatcherService | null = null;
let intervalId: NodeJS.Timeout | null = null;

/**
 * Start the reminder processor cron job
 * Runs every minute to check for pending notifications
 */
export function startReminderProcessor(dispatcher: NotificationDispatcherService): void {
    dispatcherService = dispatcher;

    console.log('🔔 Starting calendar reminder processor (every 60 seconds)');

    // Run immediately on startup
    processReminders();

    // Then run every 60 seconds
    intervalId = setInterval(processReminders, 60 * 1000);
}

async function processReminders(): Promise<void> {
    if (!dispatcherService) return;

    try {
        const result = await dispatcherService.processPendingNotifications();

        if (result.processed > 0) {
            console.log(`📬 Reminder processor: ${result.processed} processed, ${result.succeeded} succeeded, ${result.failed} failed`);
        }
    } catch (error) {
        console.error('❌ Reminder processor error:', error);
    }
}

/**
 * Stop the reminder processor
 */
export function stopReminderProcessor(): void {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('🔔 Stopped calendar reminder processor');
    }
}
