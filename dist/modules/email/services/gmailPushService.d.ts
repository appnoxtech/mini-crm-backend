import { EmailAccount } from '../models/types';
import { EmailService } from './emailService';
import { RealTimeNotificationService } from './realTimeNotificationService';
/**
 * Gmail Push Notification Service
 * Uses Google Cloud Pub/Sub to receive instant notifications when new emails arrive.
 *
 * Prerequisites:
 * 1. Create a Pub/Sub topic in Google Cloud Console
 * 2. Grant gmail-api-push@system.gserviceaccount.com Pub/Sub Publisher role
 * 3. Create a push subscription pointing to your webhook URL
 * 4. Set GMAIL_PUBSUB_TOPIC in environment variables
 */
export declare class GmailPushService {
    private emailService;
    private notificationService;
    private watchedAccounts;
    private renewalInterval;
    private readonly WATCH_RENEWAL_INTERVAL_MS;
    constructor();
    /**
     * Initialize the service with required dependencies
     */
    initialize(emailService: EmailService, notificationService: RealTimeNotificationService): void;
    /**
     * Start watching a Gmail account for new emails
     */
    startWatching(account: EmailAccount): Promise<boolean>;
    /**
     * Stop watching a Gmail account
     */
    stopWatching(accountId: string): Promise<void>;
    /**
     * Handle incoming Pub/Sub push notification
     * This is called from the webhook controller
     */
    handlePushNotification(message: {
        data: string;
        messageId: string;
        publishTime: string;
    }): Promise<void>;
    /**
     * Process Gmail changes since last historyId
     */
    private processGmailChanges;
    /**
     * Renew watches for all accounts (watches expire after 7 days)
     */
    private startWatchRenewal;
    /**
     * Start watching all active Gmail accounts
     */
    startWatchingAllAccounts(getActiveAccounts: () => Promise<EmailAccount[]>): Promise<void>;
    /**
     * Stop all watches and cleanup
     */
    stopAll(): Promise<void>;
    /**
     * Get status of all watched accounts
     */
    getStatus(): Array<{
        accountId: string;
        email: string;
        historyId: string;
        expiration: Date;
    }>;
    /**
     * Check if an account is being watched
     */
    isWatching(accountId: string): boolean;
    private decryptTokenIfNeeded;
    private delay;
}
export declare const gmailPushService: GmailPushService;
//# sourceMappingURL=gmailPushService.d.ts.map