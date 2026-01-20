"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkEmailService = void 0;
class BulkEmailService {
    composerService;
    gmailService;
    trackingService;
    quotaService;
    errorService;
    activeCampaigns = new Map();
    connectionPool = new Map();
    constructor(composerService, gmailService, trackingService, quotaService, errorService) {
        this.composerService = composerService;
        this.gmailService = gmailService;
        this.trackingService = trackingService;
        this.quotaService = quotaService;
        this.errorService = errorService;
    }
    async processBulkEmail(request, accessToken, userEmail) {
        console.log(`Starting bulk email processing for campaign: ${request.campaign_id}`);
        console.log(`Total recipients: ${request.recipients.length}`);
        const startTime = Date.now();
        const status = {
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
            const batchResults = await this.processBatchesWithOptimization(batches, request, accessToken, userEmail);
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
        }
        catch (error) {
            console.error(`Bulk email campaign failed: ${error.message}`);
            status.completion_percentage = Math.round((status.sent_successfully / status.total_emails) * 100);
            throw new Error(`Bulk email campaign failed: ${error.message}`);
        }
        finally {
            this.activeCampaigns.set(request.campaign_id, status);
        }
    }
    async validateBulkQuota(request, userEmail) {
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
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
    async processBatchesWithOptimization(batches, request, accessToken, userEmail) {
        const batchResults = [];
        const maxConcurrent = request.send_options.max_concurrent_batches;
        const delayBetweenBatches = request.send_options.delay_between_batches;
        // Process batches with controlled concurrency
        for (let i = 0; i < batches.length; i += maxConcurrent) {
            const currentBatches = batches.slice(i, i + maxConcurrent);
            // Process current batch group in parallel
            const batchPromises = currentBatches.map((batch, index) => this.processBatch(batch, `${request.campaign_id}_batch_${i + index}`, request.template, request.campaign_id, accessToken, userEmail));
            const batchGroupResults = await Promise.allSettled(batchPromises);
            // Collect results and handle errors
            batchGroupResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    batchResults.push(result.value);
                    this.updateCampaignStatus(request.campaign_id, result.value);
                }
                else {
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
    async processBatch(recipients, batchId, template, campaignId, accessToken, userEmail) {
        const startTime = Date.now();
        console.log(`Processing batch ${batchId} with ${recipients.length} recipients`);
        const failures = [];
        let successCount = 0;
        // Process each email in the batch
        for (const recipient of recipients) {
            try {
                // Check rate limits before each send
                await this.checkRateLimit();
                // Compose personalized email
                const emailRequest = {
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
                const sendResult = await this.sendWithRetry({
                    method: 'gmail_api',
                    message: compositionResult.gmail_message,
                    user_email: userEmail,
                    access_token: accessToken
                }, 3 // max retries per email
                );
                // Record quota usage
                this.quotaService.recordQuotaUsage(userEmail, 1);
                // Update tracking
                await this.trackingService.updateDeliveryStatus(compositionResult.message_metadata.message_id, 'delivered', recipient.email);
                successCount++;
                console.log(`Email sent successfully to ${recipient.email} (${successCount}/${recipients.length})`);
            }
            catch (error) {
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
        const result = {
            batch_id: batchId,
            success_count: successCount,
            failure_count: failures.length,
            failures,
            processing_time: processingTime
        };
        console.log(`Batch ${batchId} completed: ${successCount} success, ${failures.length} failures in ${processingTime}ms`);
        return result;
    }
    async sendWithRetry(sendRequest, maxRetries) {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await this.gmailService.sendEmail(sendRequest);
            }
            catch (error) {
                lastError = error;
                if (attempt === maxRetries)
                    break;
                const classification = this.errorService.classifyError(error);
                if (!classification.is_retryable)
                    break;
                const delay = this.calculateRetryDelay(attempt);
                await this.sleep(delay);
            }
        }
        throw lastError;
    }
    calculateRetryDelay(attempt) {
        const baseDelay = 1000; // 1 second
        const multiplier = 2;
        const maxDelay = 30000; // 30 seconds
        let delay = baseDelay * Math.pow(multiplier, attempt);
        delay = Math.min(delay, maxDelay);
        // Add jitter
        delay *= (0.5 + Math.random() * 0.5);
        return Math.round(delay);
    }
    shouldScheduleRetry(error) {
        const classification = this.errorService.classifyError(error);
        return classification.is_temporary || classification.category === 'rate_limit';
    }
    async checkRateLimit() {
        const stats = this.quotaService.getSystemQuotaStats();
        if (stats.rps_usage_percentage > 80) {
            const delay = Math.round((100 - stats.rps_usage_percentage) * 10);
            await this.sleep(delay);
        }
    }
    updateCampaignStatus(campaignId, batchResult) {
        const status = this.activeCampaigns.get(campaignId);
        if (status) {
            status.sent_successfully += batchResult.success_count;
            status.failed += batchResult.failure_count;
            status.pending -= (batchResult.success_count + batchResult.failure_count);
            status.completion_percentage = Math.round(((status.sent_successfully + status.failed) / status.total_emails) * 100);
            this.activeCampaigns.set(campaignId, status);
        }
    }
    collectFailedEmails(batchResults) {
        const failedEmails = [];
        batchResults.forEach(batch => {
            failedEmails.push(...batch.failures);
        });
        return failedEmails;
    }
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // Public methods for monitoring and management
    getCampaignStatus(campaignId) {
        return this.activeCampaigns.get(campaignId);
    }
    getActiveCampaigns() {
        return Array.from(this.activeCampaigns.values());
    }
    async cancelCampaign(campaignId) {
        const status = this.activeCampaigns.get(campaignId);
        if (status && !status.completed_at) {
            status.completion_percentage = Math.round(((status.sent_successfully + status.failed) / status.total_emails) * 100);
            status.completed_at = new Date();
            this.activeCampaigns.set(campaignId, status);
            return true;
        }
        return false;
    }
    // Performance optimization methods
    optimizeConnectionPooling(userEmail) {
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
    smartQueuing(priority) {
        // Return delay based on priority
        switch (priority) {
            case 'high': return 0;
            case 'normal': return 100;
            case 'low': return 500;
            default: return 100;
        }
    }
    // Cleanup method
    cleanupCompletedCampaigns(maxAge = 24 * 60 * 60 * 1000) {
        const cutoff = new Date(Date.now() - maxAge);
        for (const [campaignId, status] of this.activeCampaigns.entries()) {
            if (status.completed_at && status.completed_at < cutoff) {
                this.activeCampaigns.delete(campaignId);
            }
        }
    }
}
exports.BulkEmailService = BulkEmailService;
//# sourceMappingURL=bulkEmailService.js.map