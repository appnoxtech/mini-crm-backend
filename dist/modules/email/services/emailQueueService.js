"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailQueueService = void 0;
class EmailQueueService {
    emailService;
    emailModel;
    syncQueue = [];
    sendQueue = [];
    isProcessing = false;
    processingInterval = null;
    constructor(emailService, emailModel) {
        this.emailService = emailService;
        this.emailModel = emailModel;
        this.startQueueProcessor();
    }
    startQueueProcessor() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
        }
        // Process queue every 30 seconds
        this.processingInterval = setInterval(async () => {
            if (!this.isProcessing) {
                await this.processQueues();
            }
        }, 30000);
        // Also process immediately on startup
        setTimeout(() => this.processQueues(), 5000);
    }
    async processQueues() {
        if (this.isProcessing) {
            return;
        }
        this.isProcessing = true;
        try {
            // Process sync queue
            await this.processSyncQueue();
            // Process send queue
            await this.processSendQueue();
        }
        catch (error) {
            console.error('Error processing email queues:', error);
        }
        finally {
            this.isProcessing = false;
        }
    }
    async processSyncQueue() {
        if (this.syncQueue.length === 0) {
            // Auto-schedule email sync for all active accounts
            await this.scheduleEmailSyncForAllAccounts();
            if (this.syncQueue.length === 0)
                return;
        }
        const job = this.syncQueue.shift();
        if (!job)
            return;
        try {
            console.log(`Processing email sync for account: ${job.accountId}`);
            const account = await this.emailModel.getEmailAccountById(job.accountId);
            if (!account || !account.isActive) {
                console.log(`Account ${job.accountId} not found or inactive, skipping sync`);
                return;
            }
            // Pre-flight check: if provider needs IMAP but it's missing, log and skip instead of failing and re-queuing
            if ((account.provider === 'imap' || account.provider === 'custom') && !account.imapConfig) {
                console.error(`Skipping sync for ${account.email}: IMAP configuration is missing for ${account.provider} account.`);
                return;
            }
            const result = await this.emailService.processIncomingEmails(account);
            console.log(`Email sync completed for ${job.accountId}:`, result);
        }
        catch (error) {
            console.error(`Failed to sync emails for account ${job.accountId}:`, error);
            // Re-queue with lower priority if it's a temporary failure
            // Permanent failures (like missing config which we now handle above, or authentication errors) shouldn't be re-queued indefinitely
            const errorMessage = error.message || '';
            const isPermanentFailure = errorMessage.includes('configuration is missing') ||
                errorMessage.includes('invalid_grant') ||
                errorMessage.includes('re-authenticate');
            if (!isPermanentFailure && job.priority !== 'low') {
                this.queueEmailSync(job.accountId, job.userId, 'low');
            }
        }
    }
    async processSendQueue() {
        const job = this.sendQueue.shift();
        if (!job)
            return;
        try {
            console.log(`Processing email send for account: ${job.accountId}`);
            // For sending, we can use the accountId directly as the service handles fetching
            const messageId = await this.emailService.sendEmail(job.accountId, job.emailData);
            console.log(`Email sent successfully: ${messageId}`);
        }
        catch (error) {
            console.error(`Failed to send email for account ${job.accountId}:`, error);
            // TODO: Implement retry logic for failed sends
        }
    }
    queueEmailSync(accountId, userId, priority = 'normal') {
        // Check if already queued to avoid duplicates
        const existingJob = this.syncQueue.find(job => job.accountId === accountId);
        if (existingJob) {
            // Update priority if higher
            if (priority === 'high' && existingJob.priority !== 'high') {
                existingJob.priority = priority;
            }
            return;
        }
        this.syncQueue.push({ accountId, userId, priority });
        // Sort queue by priority (high first)
        this.syncQueue.sort((a, b) => {
            const priorityOrder = { high: 0, normal: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
        console.log(`Queued email sync for account ${accountId} with priority ${priority}`);
    }
    queueEmailSend(accountId, emailData) {
        this.sendQueue.push({ accountId, emailData });
        console.log(`Queued email send for account ${accountId}`);
    }
    async scheduleEmailSyncForAllAccounts() {
        try {
            // Get all active accounts that haven't been synced recently
            const accounts = await this.getAllActiveAccountsForSync();
            for (const account of accounts) {
                this.queueEmailSync(account.id, account.userId, 'normal');
            }
        }
        catch (error) {
            console.error('Failed to schedule email sync for all accounts:', error);
        }
    }
    async getAllActiveAccountsForSync() {
        try {
            // Get all active accounts from model
            const allAccounts = await this.emailModel.getAllActiveAccounts();
            // Filter for accounts that haven't been synced in the last 15 minutes
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
            return allAccounts.filter(account => {
                // If never synced or last sync was > 15 mins ago
                return !account.lastSyncAt || account.lastSyncAt < fifteenMinutesAgo;
            });
        }
        catch (error) {
            console.error('Failed to get active accounts for sync:', error);
            return [];
        }
    }
    getQueueStatus() {
        return {
            syncQueue: this.syncQueue.length,
            sendQueue: this.sendQueue.length,
            isProcessing: this.isProcessing
        };
    }
    stop() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
    }
}
exports.EmailQueueService = EmailQueueService;
//# sourceMappingURL=emailQueueService.js.map