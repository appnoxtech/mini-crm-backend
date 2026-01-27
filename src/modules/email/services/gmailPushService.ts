import { google } from 'googleapis';
import { EmailAccount } from '../models/types';
import { EmailService } from './emailService';
import { RealTimeNotificationService } from './realTimeNotificationService';

interface GmailWatchInfo {
    accountId: string;
    userId: string;
    email: string;
    historyId: string;
    expiration: Date;
}

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
export class GmailPushService {
    private emailService: EmailService | null = null;
    private notificationService: RealTimeNotificationService | null = null;
    private watchedAccounts: Map<string, GmailWatchInfo> = new Map();
    private renewalInterval: NodeJS.Timeout | null = null;
    private readonly WATCH_RENEWAL_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours (watch expires in 7 days)

    constructor() {
        // Services will be injected via initialize()
    }

    /**
     * Initialize the service with required dependencies
     */
    initialize(
        emailService: EmailService,
        notificationService: RealTimeNotificationService
    ): void {
        this.emailService = emailService;
        this.notificationService = notificationService;

        // Start watch renewal interval
        this.startWatchRenewal();


    }

    /**
     * Start watching a Gmail account for new emails
     */
    async startWatching(account: EmailAccount): Promise<boolean> {
        if (account.provider !== 'gmail' || !account.accessToken) {
            console.warn(`Account ${account.id} is not a Gmail account or missing tokens`);
            return false;
        }

        const topicName = process.env.GMAIL_PUBSUB_TOPIC;
        if (!topicName) {
            console.warn('GMAIL_PUBSUB_TOPIC not set, Gmail push notifications disabled');
            console.warn('Set GMAIL_PUBSUB_TOPIC=projects/YOUR_PROJECT/topics/YOUR_TOPIC');
            return false;
        }

        try {


            const auth = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET,
                process.env.GOOGLE_REDIRECT_URI
            );

            // Decrypt token if needed
            const accessToken = this.decryptTokenIfNeeded(account.accessToken);
            const refreshToken = account.refreshToken ? this.decryptTokenIfNeeded(account.refreshToken) : undefined;

            auth.setCredentials({
                access_token: accessToken,
                refresh_token: refreshToken
            });

            const gmail = google.gmail({ version: 'v1', auth });

            // Call watch API
            const response = await gmail.users.watch({
                userId: 'me',
                requestBody: {
                    topicName: topicName,
                    labelIds: ['INBOX'], // Only watch INBOX for new emails
                    labelFilterAction: 'include'
                }
            });

            const watchInfo: GmailWatchInfo = {
                accountId: account.id,
                userId: account.userId,
                email: account.email,
                historyId: response.data.historyId!,
                expiration: new Date(parseInt(response.data.expiration!))
            };

            this.watchedAccounts.set(account.id, watchInfo);


            return true;
        } catch (error: any) {
            console.error(`❌ Failed to start Gmail watch for ${account.email}:`, error.message);

            // Check for specific errors
            if (error.message?.includes('Pub/Sub')) {
                console.error('Pub/Sub configuration error. Ensure the topic exists and Gmail has publish permissions.');
            }

            return false;
        }
    }

    /**
     * Stop watching a Gmail account
     */
    async stopWatching(accountId: string): Promise<void> {
        const watchInfo = this.watchedAccounts.get(accountId);
        if (!watchInfo) return;

        try {
            // Note: Gmail watch automatically expires, but we can stop early
            // There's no explicit "stop" API, we just remove from our tracking

        } catch (error: any) {
            console.error(`Error stopping Gmail watch for ${accountId}:`, error.message);
        }

        this.watchedAccounts.delete(accountId);
    }

    /**
     * Handle incoming Pub/Sub push notification
     * This is called from the webhook controller
     */
    async handlePushNotification(message: {
        data: string; // Base64 encoded
        messageId: string;
        publishTime: string;
    }): Promise<void> {
        try {
            // Decode the Pub/Sub message
            const decodedData = Buffer.from(message.data, 'base64').toString('utf-8');
            const notification = JSON.parse(decodedData);



            const { emailAddress, historyId } = notification;

            if (!emailAddress || !historyId) {
                console.warn('Invalid Gmail push notification format');
                return;
            }

            // Find the account by email
            const watchInfo = Array.from(this.watchedAccounts.values())
                .find(w => w.email.toLowerCase() === emailAddress.toLowerCase());

            if (!watchInfo) {
                console.warn(`Received notification for unknown email: ${emailAddress}`);
                return;
            }

            // Process the new emails
            await this.processGmailChanges(watchInfo, historyId);
        } catch (error: any) {
            console.error('Failed to handle Gmail push notification:', error.message);
        }
    }

    /**
     * Process Gmail changes since last historyId
     */
    private async processGmailChanges(watchInfo: GmailWatchInfo, newHistoryId: string): Promise<void> {
        if (!this.emailService) {
            console.warn('EmailService not initialized');
            return;
        }

        try {


            // Get the email account from database
            const account = await this.emailService.getEmailAccountById(watchInfo.accountId);
            if (!account) {
                console.warn(`Account ${watchInfo.accountId} not found`);
                return;
            }

            // Process incoming emails (this will fetch and notify)
            const result = await this.emailService.processIncomingEmails(account);



            // Update the history ID
            watchInfo.historyId = newHistoryId;
        } catch (error: any) {
            console.error(`Failed to process Gmail changes for ${watchInfo.email}:`, error.message);

            // Notify user of error
            if (this.notificationService) {
                this.notificationService.notifyError(
                    watchInfo.userId,
                    `Failed to sync Gmail: ${error.message}`,
                    { accountId: watchInfo.accountId, accountEmail: watchInfo.email }
                );
            }
        }
    }

    /**
     * Renew watches for all accounts (watches expire after 7 days)
     */
    private startWatchRenewal(): void {
        this.renewalInterval = setInterval(async () => {


            for (const [accountId, watchInfo] of this.watchedAccounts.entries()) {
                // Renew if expiring within 24 hours
                const hoursUntilExpiry = (watchInfo.expiration.getTime() - Date.now()) / (1000 * 60 * 60);

                if (hoursUntilExpiry < 24) {
                    try {
                        const account = await this.emailService?.getEmailAccountById(accountId);
                        if (account) {
                            await this.startWatching(account);
                        }
                    } catch (error: any) {
                        console.error(`Failed to renew Gmail watch for ${watchInfo.email}:`, error.message);
                    }
                }
            }
        }, this.WATCH_RENEWAL_INTERVAL_MS);
    }

    /**
     * Start watching all active Gmail accounts
     */
    async startWatchingAllAccounts(getActiveAccounts: () => Promise<EmailAccount[]>): Promise<void> {
        try {
            const accounts = await getActiveAccounts();
            const gmailAccounts = accounts.filter(a => a.provider === 'gmail' && a.accessToken && a.isActive);



            for (const account of gmailAccounts) {
                await this.startWatching(account);
                // Small delay between API calls
                await this.delay(500);
            }
        } catch (error: any) {
            console.error('Failed to start watching all Gmail accounts:', error.message);
        }
    }

    /**
     * Stop all watches and cleanup
     */
    async stopAll(): Promise<void> {


        if (this.renewalInterval) {
            clearInterval(this.renewalInterval);
            this.renewalInterval = null;
        }

        this.watchedAccounts.clear();

    }

    /**
     * Get status of all watched accounts
     */
    getStatus(): Array<{
        accountId: string;
        email: string;
        historyId: string;
        expiration: Date;
    }> {
        return Array.from(this.watchedAccounts.values()).map(w => ({
            accountId: w.accountId,
            email: w.email,
            historyId: w.historyId,
            expiration: w.expiration
        }));
    }

    /**
     * Check if an account is being watched
     */
    isWatching(accountId: string): boolean {
        return this.watchedAccounts.has(accountId);
    }

    private decryptTokenIfNeeded(token: string): string {
        // Check if token is encrypted (contains :)
        if (!token.includes(':')) {
            return token;
        }

        try {
            const crypto = require('crypto');
            const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || 'default-key-change-in-production';
            const parts = token.split(':');
            if (parts.length !== 2 || !parts[0] || !parts[1]) return token;

            const iv = Buffer.from(parts[0] as string, 'hex');
            const encrypted = Buffer.from(parts[1] as string, 'hex');
            const key = crypto.scryptSync(encryptionKey, 'salt', 32);
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
            return decrypted.toString('utf8');
        } catch {
            return token;
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance
export const gmailPushService = new GmailPushService();
