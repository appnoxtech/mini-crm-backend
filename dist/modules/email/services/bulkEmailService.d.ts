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
    delay_between_batches: number;
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
export declare class BulkEmailService {
    private composerService;
    private gmailService;
    private trackingService;
    private quotaService;
    private errorService;
    private activeCampaigns;
    private connectionPool;
    constructor(composerService: EnhancedEmailComposer, gmailService: EnhancedGmailService, trackingService: EmailTrackingService, quotaService: QuotaValidationService, errorService: ErrorHandlingService);
    processBulkEmail(request: BulkEmailRequest, accessToken: string, userEmail: string): Promise<BulkSendResult>;
    private validateBulkQuota;
    private createBatches;
    private processBatchesWithOptimization;
    private processBatch;
    private sendWithRetry;
    private calculateRetryDelay;
    private shouldScheduleRetry;
    private checkRateLimit;
    private updateCampaignStatus;
    private collectFailedEmails;
    private formatDuration;
    private sleep;
    getCampaignStatus(campaignId: string): BulkSendStatus | undefined;
    getActiveCampaigns(): BulkSendStatus[];
    cancelCampaign(campaignId: string): Promise<boolean>;
    private optimizeConnectionPooling;
    private smartQueuing;
    cleanupCompletedCampaigns(maxAge?: number): void;
}
//# sourceMappingURL=bulkEmailService.d.ts.map