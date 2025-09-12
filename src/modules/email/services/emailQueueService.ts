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
      // Process sync queue
      await this.processSyncQueue();
      
      // Process send queue
      await this.processSendQueue();
    } catch (error) {
      console.error('Error processing email queues:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) {
      // Auto-schedule email sync for all active accounts
      await this.scheduleEmailSyncForAllAccounts();
      return;
    }

    const job = this.syncQueue.shift();
    if (!job) return;

    try {
      console.log(`Processing email sync for account: ${job.accountId}`);
      
      const account = await this.emailModel.getEmailAccountById(job.accountId);
      if (!account || !account.isActive) {
        console.log(`Account ${job.accountId} not found or inactive, skipping sync`);
        return;
      }

      const result = await this.emailService.processIncomingEmails(account);
      console.log(`Email sync completed for ${job.accountId}:`, result);
    } catch (error: any) {
      console.error(`Failed to sync emails for account ${job.accountId}:`, error);
      
      // Re-queue with lower priority if it's a temporary failure
      if (job.priority !== 'low') {
        this.queueEmailSync(job.accountId, job.userId, 'low');
      }
    }
  }

  private async processSendQueue(): Promise<void> {
    const job = this.sendQueue.shift();
    if (!job) return;

    try {
      console.log(`Processing email send for account: ${job.accountId}`);
      
      const messageId = await this.emailService.sendEmail(job.accountId, job.emailData);
      console.log(`Email sent successfully: ${messageId}`);
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

    console.log(`Queued email sync for account ${accountId} with priority ${priority}`);
  }

  public queueEmailSend(accountId: string, emailData: EmailSendJob['emailData']): void {
    this.sendQueue.push({ accountId, emailData });
    console.log(`Queued email send for account ${accountId}`);
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
    // This is a simplified implementation
    // In a real system, you'd query the database for accounts that need syncing
    try {
      // Get accounts that haven't been synced in the last 10 minutes
      const cutoffTime = new Date(Date.now() - 10 * 60 * 1000);
      // For now, return empty array as we don't have a proper query method
      // In the future, this would query the database for accounts
      return [];
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
