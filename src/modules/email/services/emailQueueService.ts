import { EmailService } from './emailService';
import { EmailModel } from '../models/emailModel';

export interface EmailSyncJob {
  accountId: string;
  userId: string;
  priority: 'high' | 'normal' | 'low';
}

export interface EmailSendJob {
  accountId: string;
  emailData: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    htmlBody?: string;
    attachments?: any[];
  };
}

export class EmailQueueService {
  private emailService: EmailService;
  private emailModel: EmailModel;
  private syncQueue: EmailSyncJob[] = [];
  private sendQueue: EmailSendJob[] = [];
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(emailService: EmailService, emailModel: EmailModel) {
    this.emailService = emailService;
    this.emailModel = emailModel;
    this.startQueueProcessor();
  }

  private startQueueProcessor(): void {
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

  private async processQueues(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Process up to MAX_CONCURRENT_SYNCS jobs
      const MAX_CONCURRENT_SYNCS = 5;
      const activeJobs = []; // Track active promises if needed, but here we just loop

      while (this.syncQueue.length > 0 && this.activeSyncs < MAX_CONCURRENT_SYNCS) {
        const job = this.syncQueue.shift();
        if (!job) break;

        this.activeSyncs++;

        // Process in background (don't await here, just track promise)
        this.processSingleSyncJob(job).finally(() => {
          this.activeSyncs--;
          // Trigger next if queue has items
          this.processQueues(); // Check if we can pick up more
        });
      }
    } catch (error) {
      console.error('Error processing email queues:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private activeSyncs = 0;

  private async processSingleSyncJob(job: EmailSyncJob): Promise<void> {
    try {
      const account = await this.emailModel.getEmailAccountById(job.accountId);
      if (!account || !account.isActive) {
        return;
      }

      // Pre-flight check: if provider needs IMAP but it's missing
      if ((account.provider === 'imap' || account.provider === 'custom') && !account.imapConfig) {
        console.error(`Skipping sync for ${account.email}: IMAP configuration is missing.`);
        return;
      }

      await this.emailService.processIncomingEmails(account);
    } catch (error: any) {
      console.error(`Failed to sync emails for account ${job.accountId}:`, error);

      const errorMessage = error.message || '';
      const isPermanentFailure =
        errorMessage.includes('configuration is missing') ||
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('re-authenticate');

      if (!isPermanentFailure && job.priority !== 'low') {
        this.queueEmailSync(job.accountId, job.userId, 'low');
      }
    }
  }

  // kept for compatibility but logic moved to processSingleSyncJob
  private async processSyncQueue(): Promise<void> {
    // This is now handled inside processQueues concurrently
    return;
  }

  private async processSendQueue(): Promise<void> {
    const job = this.sendQueue.shift();
    if (!job) return;

    try {


      // For sending, we can use the accountId directly as the service handles fetching
      const messageId = await this.emailService.sendEmail(job.accountId, job.emailData);

    } catch (error: any) {
      console.error(`Failed to send email for account ${job.accountId}:`, error);
      // TODO: Implement retry logic for failed sends
    }
  }

  public queueEmailSync(accountId: string, userId: string, priority: 'high' | 'normal' | 'low' = 'normal'): void {
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


  }

  public queueEmailSend(accountId: string, emailData: EmailSendJob['emailData']): void {
    this.sendQueue.push({ accountId, emailData });

  }

  private async scheduleEmailSyncForAllAccounts(): Promise<void> {
    try {
      // Get all active accounts that haven't been synced recently
      const accounts = await this.getAllActiveAccountsForSync();

      for (const account of accounts) {
        this.queueEmailSync(account.id, account.userId, 'normal');
      }
    } catch (error) {
      console.error('Failed to schedule email sync for all accounts:', error);
    }
  }

  private async getAllActiveAccountsForSync(): Promise<any[]> {
    try {
      // Get all active accounts from model
      const allAccounts = await this.emailModel.getAllActiveAccounts();

      // Filter for accounts that haven't been synced in the last 15 minutes
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      return allAccounts.filter(account => {
        // If never synced or last sync was > 15 mins ago
        return !account.lastSyncAt || account.lastSyncAt < fifteenMinutesAgo;
      });
    } catch (error) {
      console.error('Failed to get active accounts for sync:', error);
      return [];
    }
  }

  public getQueueStatus(): { syncQueue: number; sendQueue: number; isProcessing: boolean } {
    return {
      syncQueue: this.syncQueue.length,
      sendQueue: this.sendQueue.length,
      isProcessing: this.isProcessing
    };
  }

  public stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }
}
