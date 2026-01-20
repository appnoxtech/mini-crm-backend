"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SummarizationController = void 0;
const summarizationQueueService_1 = require("../services/summarizationQueueService");
const summarizationSchedulerService_1 = require("../services/summarizationSchedulerService");
const runpodAsyncService_1 = require("../services/runpodAsyncService");
const summarizer_1 = require("../../../shared/utils/summarizer");
const responses_1 = require("../../../shared/responses/responses");
class SummarizationController {
    queueService;
    schedulerService;
    runpodService;
    emailModel;
    constructor(emailModel, dbPath = './data.db') {
        this.emailModel = emailModel;
        this.queueService = (0, summarizationQueueService_1.getSummarizationQueueService)(dbPath);
        this.schedulerService = (0, summarizationSchedulerService_1.getSummarizationScheduler)(dbPath);
        this.runpodService = (0, runpodAsyncService_1.getRunPodAsyncService)(dbPath);
    }
    /**
     * Queue a thread for summarization (uses RunPod async - no Redis needed!)
     */
    async queueThreadSummarization(req, res) {
        try {
            const { threadId } = req.params;
            if (!threadId) {
                return responses_1.ResponseHandler.validationError(res, 'Thread ID is required');
            }
            // Check if thread already has a summary (from either service)
            let existingSummary = this.queueService.getThreadSummary(threadId);
            if (!existingSummary) {
                existingSummary = this.runpodService.getThreadSummary(threadId);
            }
            // If already processing or completed, return status
            if (existingSummary) {
                const normalizedStatus = this.normalizeStatus(existingSummary.status);
                if (normalizedStatus === 'processing' || normalizedStatus === 'pending') {
                    const data = {
                        jobId: existingSummary.runpodJobId || existingSummary.jobId,
                        threadId,
                        status: normalizedStatus
                    };
                    return responses_1.ResponseHandler.success(res, data, 'Summarization already in progress');
                }
                if (normalizedStatus === 'completed') {
                    const data = {
                        threadId,
                        status: 'completed'
                    };
                    return responses_1.ResponseHandler.success(res, data, 'Thread already summarized');
                }
            }
            // Submit to RunPod async (no Redis required!)
            const result = await this.runpodService.submitForSummarization(threadId);
            const data = {
                jobId: result.jobId,
                threadId,
                status: 'pending'
            };
            return responses_1.ResponseHandler.success(res, data, 'Summarization queued with RunPod');
        }
        catch (error) {
            console.error('Error queuing summarization:', error);
            return responses_1.ResponseHandler.success(res, 'Failed to queue summarization');
        }
    }
    /**
     * Synchronously summarize a thread (immediate result)
     */
    async summarizeThreadSync(req, res) {
        try {
            const { threadId } = req.params;
            if (!threadId) {
                return responses_1.ResponseHandler.validationError(res, [], 'Thread ID is required');
            }
            // Get all emails and filter by threadId
            const { emails } = await this.emailModel.getAllEmails({ limit: 1000 });
            const threadEmails = emails.filter(e => e.threadId === threadId);
            if (threadEmails.length === 0) {
                return responses_1.ResponseHandler.error(res, 'Thread not found');
            }
            // Format thread text for summarization
            const threadText = threadEmails
                .map(e => `${e.from}: ${e.body}`)
                .join('\n');
            // Call the summarization service
            const summary = await (0, summarizer_1.summarizeThreadWithVLLM)(threadText);
            // Save the summary
            await this.emailModel.saveThreadSummary(threadId, summary);
            const data = {
                threadId,
                summary
            };
            return responses_1.ResponseHandler.success(res, data);
        }
        catch (error) {
            console.error('Error in sync summarization:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to summarize thread');
        }
    }
    /**
     * Get thread summary with enhanced data
     * Checks both Redis queue service and RunPod async service
     */
    async getEnhancedThreadSummary(req, res) {
        try {
            const { threadId } = req.params;
            if (!threadId) {
                return responses_1.ResponseHandler.validationError(res, 'Thread ID is required');
            }
            // Try to get summary from Redis queue service first
            let summary = this.queueService.getThreadSummary(threadId);
            // If not found, try RunPod async service
            if (!summary) {
                summary = this.runpodService.getThreadSummary(threadId);
            }
            // If still not found, return 404
            if (!summary) {
                return responses_1.ResponseHandler.error(res, 'No summary available', 404);
            }
            // Normalize status codes (RunPod uses 'IN_QUEUE', 'COMPLETED' vs Redis uses 'pending', 'completed')
            const normalizedStatus = this.normalizeStatus(summary.status);
            const isCompleted = normalizedStatus === 'completed';
            // If summary is in progress, try to get job status
            let jobStatus = null;
            if (!isCompleted) {
                if (summary.jobId) {
                    // Try Redis queue first
                    jobStatus = await this.queueService.getJobStatus(summary.jobId);
                }
                else if (summary.runpodJobId) {
                    // Try RunPod async
                    try {
                        const runpodStatus = await this.runpodService.checkJobStatus(summary.runpodJobId);
                        jobStatus = {
                            state: runpodStatus.status,
                            progress: runpodStatus.status === 'COMPLETED' ? 100 : 50,
                            data: { threadId }
                        };
                    }
                    catch (error) {
                        console.warn('Could not fetch RunPod job status:', error);
                    }
                }
            }
            const data = {
                thread: {
                    id: threadId,
                    summarized: isCompleted
                },
                summary: {
                    text: summary.summary,
                    keyPoints: summary.keyPoints || [],
                    actionItems: summary.actionItems || [],
                    sentiment: summary.sentiment,
                    participants: summary.participants || [],
                    processingTime: summary.processingTime,
                    modelVersion: summary.modelVersion,
                    lastSummarizedAt: summary.lastSummarizedAt
                },
                status: normalizedStatus,
                jobStatus,
                runpodJobId: summary.runpodJobId
            };
            return responses_1.ResponseHandler.success(res, data);
        }
        catch (error) {
            console.error('Error fetching summary:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch summary');
        }
    }
    /**
     * Normalize status codes from different services
     */
    normalizeStatus(status) {
        const statusMap = {
            'IN_QUEUE': 'pending',
            'IN_PROGRESS': 'processing',
            'COMPLETED': 'completed',
            'FAILED': 'failed',
            'queued': 'pending',
            'processing': 'processing',
            'completed': 'completed',
            'failed': 'failed',
            'pending': 'pending'
        };
        return statusMap[status] || status;
    }
    /**
     * Bulk summarize user's threads
     */
    async bulkSummarize(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { limit = 50 } = req.body;
            const userId = req.user.id.toString();
            // Get threads needing summarization
            const threads = this.queueService.getThreadsNeedingSummary(limit);
            if (threads.length === 0) {
                const queued = 0;
                return responses_1.ResponseHandler.success(res, queued, 'No threads need summarization');
            }
            // Queue all threads
            const jobs = [];
            for (const threadId of threads) {
                try {
                    const job = await this.queueService.addToQueue({
                        threadId,
                        userId,
                        subject: `Thread ${threadId}`
                    });
                    jobs.push(job.id?.toString() || '');
                }
                catch (error) {
                    // Skip if already in queue
                    console.log(`Skipping thread ${threadId}: ${error.message}`);
                }
            }
            const data = {
                queued: jobs.length,
                jobIds: jobs.filter(id => id)
            };
            return responses_1.ResponseHandler.success(res, data, `Queued ${jobs.length} threads for summarization`);
        }
        catch (error) {
            console.error('Error in bulk summarization:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to queue bulk summarization');
        }
    }
    /**
     * Get job status by job ID
     */
    async getJobStatus(req, res) {
        try {
            const { jobId } = req.params;
            if (!jobId) {
                return responses_1.ResponseHandler.validationError(res, 'Job ID is required');
            }
            const status = await this.queueService.getJobStatus(jobId);
            if (!status) {
                return responses_1.ResponseHandler.notFound(res, 'Job not found');
            }
            const data = {
                jobId,
                ...status
            };
            return responses_1.ResponseHandler.success(res, data);
        }
        catch (error) {
            console.error('Error fetching job status:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch job status');
        }
    }
    /**
     * Get summarization queue and database statistics
     */
    async getSummarizationStats(req, res) {
        try {
            const queueStats = await this.queueService.getQueueStats();
            const dbStats = this.queueService.getDatabaseStats();
            const schedulerStatus = this.schedulerService.getStatus();
            const data = {
                queue: queueStats,
                database: dbStats,
                scheduler: schedulerStatus
            };
            return responses_1.ResponseHandler.success(res, data);
        }
        catch (error) {
            console.error('Error fetching stats:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch stats');
        }
    }
    /**
     * Manually trigger the scheduler
     */
    async triggerScheduler(req, res) {
        try {
            const result = await this.schedulerService.triggerNow();
            return responses_1.ResponseHandler.success(res, result);
        }
        catch (error) {
            console.error('Error triggering scheduler:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to trigger scheduler');
        }
    }
    /**
     * Get threads pending summarization
     */
    async getPendingThreads(req, res) {
        try {
            const { limit = 50 } = req.query;
            const threads = this.queueService.getThreadsNeedingSummary(parseInt(limit));
            const data = {
                count: threads.length,
                threads
            };
            return responses_1.ResponseHandler.success(res, data);
        }
        catch (error) {
            console.error('Error fetching pending threads:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch pending threads');
        }
    }
}
exports.SummarizationController = SummarizationController;
//# sourceMappingURL=summarizationController.js.map