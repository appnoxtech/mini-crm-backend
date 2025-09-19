// @ts-nocheck
import { EmailRequest } from './enhancedEmailComposer';
import { EnhancedEmailComposer } from './enhancedEmailComposer';
import { EnhancedGmailService } from './enhancedGmailService';
import { EmailTrackingService } from './emailTrackingService';
import { QuotaValidationService } from './quotaValidationService';
import { ErrorHandlingService } from './errorHandlingService';

export interface BulkEmailRequest {
  campaign_id: string;
  template: EmailTemplate;
  recipients: BulkRecipient[];
  send_options: BulkSendOptions;
}

export interface EmailTemplate {
  subject: string;
  body_text: string;
  body_html?: string;
  from: string;
  tracking?: {
    open_tracking: boolean;
    click_tracking: boolean;
  };
}

export interface BulkRecipient {
  email: string;
  template_vars?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface BulkSendOptions {
  batch_size: number;
  delay_between_batches: number; // milliseconds
  priority: 'low' | 'normal' | 'high';
  max_concurrent_batches: number;
  retry_failed: boolean;
}

export interface BulkSendStatus {
  campaign_id: string;
  total_emails: number;
  sent_successfully: number;
  failed: number;
  pending: number;
  completion_percentage: number;
  total_time?: string;
  average_send_time?: string;
  started_at: Date;
  completed_at?: Date;
}

export interface FailedEmail {
  email: string;
  error: string;
  retry_scheduled: boolean;
  retry_count: number;
}

export interface BatchResult {
  batch_id: string;
  success_count: number;
  failure_count: number;
  failures: FailedEmail[];
  processing_time: number;
}

export interface BulkSendResult {
  campaign_id: string;
  status: BulkSendStatus;
  failed_emails: FailedEmail[];
  batch_results: BatchResult[];
}

export class BulkEmailService {
  private composerService: EnhancedEmailComposer;
  private gmailService: EnhancedGmailService;
  private trackingService: EmailTrackingService;
  private quotaService: QuotaValidationService;
  private errorService: ErrorHandlingService;
  private activeCampaigns: Map<string, BulkSendStatus> = new Map();
  private connectionPool: Map<string, any> = new Map();

  constructor(
    composerService: EnhancedEmailComposer,
    gmailService: EnhancedGmailService,
    trackingService: EmailTrackingService,
    quotaService: QuotaValidationService,
    errorService: ErrorHandlingService
  ) {
    this.composerService = composerService;
    this.gmailService = gmailService;
    this.trackingService = trackingService;
    this.quotaService = quotaService;
    this.errorService = errorService;
  }

  async processBulkEmail(
    request: BulkEmailRequest,
    accessToken: string,
    userEmail: string
  ): Promise<BulkSendResult> {
    console.log(`Starting bulk email processing for campaign: ${request.campaign_id}`);
    console.log(`Total recipients: ${request.recipients.length}`);

    const startTime = Date.now();
    const status: BulkSendStatus = {
      campaign_id: request.campaign_id,
      total_emails: request.recipients.length,
      sent_successfully: 0,
      failed: 0,
      pending: request.recipients.length,
      completion_percentage: 0,
      started_at: new Date()
    };

    this.activeCampaigns.set(request.campaign_id, status);

    try {
      // Step 1: Validate quota availability
      await this.validateBulkQuota(request, userEmail);

      // Step 2: Create batches
      const batches = this.createBatches(request.recipients, request.send_options.batch_size);
      console.log(`Created ${batches.length} batches of size ${request.send_options.batch_size}`);

      // Step 3: Process batches with optimization strategies
      const batchResults = await this.processBatchesWithOptimization(
        batches,
        request,
        accessToken,
        userEmail
      );

      // Step 4: Calculate final statistics
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      status.completed_at = new Date();
      status.total_time = this.formatDuration(totalTime);
      status.average_send_time = this.formatDuration(totalTime / Math.max(1, status.sent_successfully));
      status.completion_percentage = 100;

      // Step 5: Collect failed emails
      const failedEmails = this.collectFailedEmails(batchResults);

      console.log(`Bulk email campaign completed: ${status.sent_successfully}/${status.total_emails} sent successfully`);

      return {
        campaign_id: request.campaign_id,
        status,
        failed_emails: failedEmails,
        batch_results: batchResults
      };

    } catch (error: any) {
      console.error(`Bulk email campaign failed: ${error.message}`);
      status.completion_percentage = Math.round((status.sent_successfully / status.total_emails) * 100);
      
      throw new Error(`Bulk email campaign failed: ${error.message}`);
    } finally {
      this.activeCampaigns.set(request.campaign_id, status);
    }
  }

  private async validateBulkQuota(request: BulkEmailRequest, userEmail: string): Promise<void> {
    const totalQuotaUnits = request.recipients.length * 2; // Estimate 2 units per email
    const quotaCheck = await this.quotaService.validateQuota({
      user_email: userEmail,
      message_size: 10000, // Estimate 10KB per email
      recipients_count: request.recipients.length,
      estimated_quota_units: totalQuotaUnits
    });

    if (!quotaCheck.quota_status.can_send) {
      throw new Error(`Insufficient quota for bulk send. Required: ${totalQuotaUnits}, Available: ${quotaCheck.quota_status.quota_remaining}`);
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async processBatchesWithOptimization(
    batches: BulkRecipient[][],
    request: BulkEmailRequest,
    accessToken: string,
    userEmail: string
  ): Promise<BatchResult[]> {
    const batchResults: BatchResult[] = [];
    const maxConcurrent = request.send_options.max_concurrent_batches;
    const delayBetweenBatches = request.send_options.delay_between_batches;

    // Process batches with controlled concurrency
    for (let i = 0; i < batches.length; i += maxConcurrent) {
      const currentBatches = batches.slice(i, i + maxConcurrent);
      
      // Process current batch group in parallel
      const batchPromises = currentBatches.map((batch, index) => 
        this.processBatch(
          batch,
          `${request.campaign_id}_batch_${i + index}`,
          request.template,
          request.campaign_id,
          accessToken,
          userEmail
        )
      );

      const batchGroupResults = await Promise.allSettled(batchPromises);
      
      // Collect results and handle errors
      batchGroupResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          batchResults.push(result.value);
          this.updateCampaignStatus(request.campaign_id, result.value);
        } else {
          console.error(`Batch ${i + index} failed:`, result.reason);
          batchResults.push({
            batch_id: `${request.campaign_id}_batch_${i + index}`,
            success_count: 0,
            //@ts-ignore
            failure_count: currentBatches[index].length,
            //@ts-ignore
            failures: currentBatches[index].map(recipient => ({
              email: recipient.email,
              error: result.reason.message,
              retry_scheduled: false,
              retry_count: 0
            })),
            processing_time: 0
          });
        }
      });

      // Delay between batch groups (except for the last group)
      if (i + maxConcurrent < batches.length && delayBetweenBatches > 0) {
        console.log(`Waiting ${delayBetweenBatches}ms before next batch group...`);
        await this.sleep(delayBetweenBatches);
      }
    }

    return batchResults;
  }

  private async processBatch(
    recipients: BulkRecipient[],
    batchId: string,
    template: EmailTemplate,
    campaignId: string,
    accessToken: string,
    userEmail: string
  ): Promise<BatchResult> {
    const startTime = Date.now();
    console.log(`Processing batch ${batchId} with ${recipients.length} recipients`);

    const failures: FailedEmail[] = [];
    let successCount = 0;

    // Process each email in the batch
    for (const recipient of recipients) {
      try {
        // Check rate limits before each send
        await this.checkRateLimit();

        // Compose personalized email
        const emailRequest: EmailRequest = {
          from: template.from,
          to: [recipient.email],
          subject: template.subject,
          body_text: template.body_text,
          body_html: template.body_html,
          template_variables: recipient.template_vars,
          tracking: {
            open_tracking: template.tracking?.open_tracking || false,
            click_tracking: template.tracking?.click_tracking || false,
            campaign_id: campaignId
          }
        };

        const compositionResult = await this.composerService.composeEmail(emailRequest);
        
        if (compositionResult.validation_errors?.length) {
          throw new Error(`Validation failed: ${compositionResult.validation_errors.join(', ')}`);
        }

        // Initialize tracking
        await this.trackingService.initializeTracking({
          message_id: compositionResult.message_metadata.message_id,
          tracking_enabled: compositionResult.message_metadata.tracking_enabled,
          campaign_id: campaignId
        }, [recipient.email]);

        // Send email with retry logic
        const sendResult = await this.sendWithRetry(
          {
            method: 'gmail_api' as const,
            message: compositionResult.gmail_message,
            user_email: userEmail,
            access_token: accessToken
          },
          3 // max retries per email
        );

        // Record quota usage
        this.quotaService.recordQuotaUsage(userEmail, 1);

        // Update tracking
        await this.trackingService.updateDeliveryStatus(
          compositionResult.message_metadata.message_id,
          'delivered',
          recipient.email
        );

        successCount++;
        console.log(`Email sent successfully to ${recipient.email} (${successCount}/${recipients.length})`);

      } catch (error: any) {
        console.error(`Failed to send email to ${recipient.email}:`, error.message);
        failures.push({
          email: recipient.email,
          error: error.message,
          retry_scheduled: this.shouldScheduleRetry(error),
          retry_count: 0
        });
      }
    }

    const processingTime = Date.now() - startTime;
    
    const result: BatchResult = {
      batch_id: batchId,
      success_count: successCount,
      failure_count: failures.length,
      failures,
      processing_time: processingTime
    };

    console.log(`Batch ${batchId} completed: ${successCount} success, ${failures.length} failures in ${processingTime}ms`);
    return result;
  }

  private async sendWithRetry(sendRequest: any, maxRetries: number): Promise<any> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.gmailService.sendEmail(sendRequest);
      } catch (error: any) {
        lastError = error;
        
        if (attempt === maxRetries) break;
        
        const classification = this.errorService.classifyError(error);
        if (!classification.is_retryable) break;
        
        const delay = this.calculateRetryDelay(attempt);
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  private calculateRetryDelay(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const multiplier = 2;
    const maxDelay = 30000; // 30 seconds
    
    let delay = baseDelay * Math.pow(multiplier, attempt);
    delay = Math.min(delay, maxDelay);
    
    // Add jitter
    delay *= (0.5 + Math.random() * 0.5);
    
    return Math.round(delay);
  }

  private shouldScheduleRetry(error: any): boolean {
    const classification = this.errorService.classifyError(error);
    return classification.is_temporary || classification.category === 'rate_limit';
  }

  private async checkRateLimit(): Promise<void> {
    const stats = this.quotaService.getSystemQuotaStats();
    if (stats.rps_usage_percentage > 80) {
      const delay = Math.round((100 - stats.rps_usage_percentage) * 10);
      await this.sleep(delay);
    }
  }

  private updateCampaignStatus(campaignId: string, batchResult: BatchResult): void {
    const status = this.activeCampaigns.get(campaignId);
    if (status) {
      status.sent_successfully += batchResult.success_count;
      status.failed += batchResult.failure_count;
      status.pending -= (batchResult.success_count + batchResult.failure_count);
      status.completion_percentage = Math.round(
        ((status.sent_successfully + status.failed) / status.total_emails) * 100
      );
      
      this.activeCampaigns.set(campaignId, status);
    }
  }

  private collectFailedEmails(batchResults: BatchResult[]): FailedEmail[] {
    const failedEmails: FailedEmail[] = [];
    batchResults.forEach(batch => {
      failedEmails.push(...batch.failures);
    });
    return failedEmails;
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for monitoring and management
  getCampaignStatus(campaignId: string): BulkSendStatus | undefined {
    return this.activeCampaigns.get(campaignId);
  }

  getActiveCampaigns(): BulkSendStatus[] {
    return Array.from(this.activeCampaigns.values());
  }

  async cancelCampaign(campaignId: string): Promise<boolean> {
    const status = this.activeCampaigns.get(campaignId);
    if (status && !status.completed_at) {
      status.completion_percentage = Math.round(
        ((status.sent_successfully + status.failed) / status.total_emails) * 100
      );
      status.completed_at = new Date();
      this.activeCampaigns.set(campaignId, status);
      return true;
    }
    return false;
  }

  // Performance optimization methods
  private optimizeConnectionPooling(userEmail: string): void {
    // Reuse connections for the same user
    if (!this.connectionPool.has(userEmail)) {
      // Initialize connection pool for user
      this.connectionPool.set(userEmail, {
        created: new Date(),
        lastUsed: new Date(),
        requestCount: 0
      });
    }
  }

  private smartQueuing(priority: 'low' | 'normal' | 'high'): number {
    // Return delay based on priority
    switch (priority) {
      case 'high': return 0;
      case 'normal': return 100;
      case 'low': return 500;
      default: return 100;
    }
  }

  // Cleanup method
  cleanupCompletedCampaigns(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = new Date(Date.now() - maxAge);
    
    for (const [campaignId, status] of this.activeCampaigns.entries()) {
      if (status.completed_at && status.completed_at < cutoff) {
        this.activeCampaigns.delete(campaignId);
      }
    }
  }
}
