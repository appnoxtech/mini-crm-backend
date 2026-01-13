import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../../shared/types';
import {
    SummarizationQueueService,
    getSummarizationQueueService
} from '../services/summarizationQueueService';
import {
    SummarizationSchedulerService,
    getSummarizationScheduler
} from '../services/summarizationSchedulerService';
import { RunPodAsyncService, getRunPodAsyncService } from '../services/runpodAsyncService';
import { EmailModel } from '../models/emailModel';
import { summarizeThreadWithVLLM } from '../../../shared/utils/summarizer';
import { ResponseHandler } from '../../../shared/responses/responses';

export class SummarizationController {
    private queueService: SummarizationQueueService;
    private schedulerService: SummarizationSchedulerService;
    private runpodService: RunPodAsyncService;
    private emailModel: EmailModel;

    constructor(emailModel: EmailModel, dbPath: string = './data.db') {
        this.emailModel = emailModel;
        this.queueService = getSummarizationQueueService(dbPath);
        this.schedulerService = getSummarizationScheduler(dbPath);
        this.runpodService = getRunPodAsyncService(dbPath);
    }

    /**
     * Queue a thread for summarization (uses RunPod async - no Redis needed!)
     */
    async queueThreadSummarization(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { threadId } = req.params;

            if (!threadId) {
                return ResponseHandler.validationError(res, 'Thread ID is required');
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
                    }

                    return ResponseHandler.success(res, data, 'Summarization already in progress');
                }

                if (normalizedStatus === 'completed') {
                    const data = {
                        threadId,
                        status: 'completed'
                    }

                    return ResponseHandler.success(res, data, 'Thread already summarized');

                }
            }

            // Submit to RunPod async (no Redis required!)
            const result = await this.runpodService.submitForSummarization(threadId);

            const data = {
                jobId: result.jobId,
                threadId,
                status: 'pending'
            }

            return ResponseHandler.success(res, data, 'Summarization queued with RunPod');

        } catch (error: any) {
            console.error('Error queuing summarization:', error);
            return ResponseHandler.success(res, 'Failed to queue summarization');
        }
    }

    /**
     * Synchronously summarize a thread (immediate result)
     */
    async summarizeThreadSync(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { threadId } = req.params;

            if (!threadId) {
                return ResponseHandler.validationError(res, [], 'Thread ID is required');
            }

            // Get all emails and filter by threadId
            const { emails } = await this.emailModel.getAllEmails({ limit: 1000 });
            const threadEmails = emails.filter(e => e.threadId === threadId);

            if (threadEmails.length === 0) {
                return ResponseHandler.error(res, 'Thread not found');
            }

            // Format thread text for summarization
            const threadText = threadEmails
                .map(e => `${e.from}: ${e.body}`)
                .join('\n');

            // Call the summarization service
            const summary = await summarizeThreadWithVLLM(threadText);

            // Save the summary
            await this.emailModel.saveThreadSummary(threadId, summary);

            const data = {
                threadId,
                summary
            }

            return ResponseHandler.success(res, data);

        } catch (error: any) {
            console.error('Error in sync summarization:', error);
            return ResponseHandler.internalError(res, 'Failed to summarize thread');
        }
    }

    /**
     * Get thread summary with enhanced data
     * Checks both Redis queue service and RunPod async service
     */
    async getEnhancedThreadSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { threadId } = req.params;

            if (!threadId) {
                return ResponseHandler.validationError(res, 'Thread ID is required');

            }

            // Try to get summary from Redis queue service first
            let summary = this.queueService.getThreadSummary(threadId);

            // If not found, try RunPod async service
            if (!summary) {
                summary = this.runpodService.getThreadSummary(threadId);
            }

            // If still not found, return 404

            if (!summary) {
                return ResponseHandler.error(res, 'No summary available', 404);
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
                } else if (summary.runpodJobId) {
                    // Try RunPod async
                    try {
                        const runpodStatus = await this.runpodService.checkJobStatus(summary.runpodJobId);
                        jobStatus = {
                            state: runpodStatus.status,
                            progress: runpodStatus.status === 'COMPLETED' ? 100 : 50,
                            data: { threadId }
                        };
                    } catch (error) {
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
            }

            return ResponseHandler.success(res, data);

        } catch (error: any) {
            console.error('Error fetching summary:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch summary');
        }
    }

    /**
     * Normalize status codes from different services
     */
    private normalizeStatus(status: string): string {
        const statusMap: { [key: string]: string } = {
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
    async bulkSummarize(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { limit = 50 } = req.body;
            const userId = req.user.id.toString();

            // Get threads needing summarization
            const threads = this.queueService.getThreadsNeedingSummary(limit);

            if (threads.length === 0) {
                const queued = 0;
                return ResponseHandler.success(res, queued, 'No threads need summarization');
            }

            // Queue all threads
            const jobs: string[] = [];
            for (const threadId of threads) {
                try {
                    const job = await this.queueService.addToQueue({
                        threadId,
                        userId,
                        subject: `Thread ${threadId}`
                    });
                    jobs.push(job.id?.toString() || '');
                } catch (error: any) {
                    // Skip if already in queue
                    console.log(`Skipping thread ${threadId}: ${error.message}`);
                }
            }

            const data = {
                queued: jobs.length,
                jobIds: jobs.filter(id => id)
            }


            return ResponseHandler.success(res, data, `Queued ${jobs.length} threads for summarization`);

        } catch (error: any) {
            console.error('Error in bulk summarization:', error);
            return ResponseHandler.internalError(res, 'Failed to queue bulk summarization');
        }
    }

    /**
     * Get job status by job ID
     */
    async getJobStatus(req: Request, res: Response): Promise<void> {
        try {
            const { jobId } = req.params;

            if (!jobId) {
                return ResponseHandler.validationError(res, 'Job ID is required');

            }

            const status = await this.queueService.getJobStatus(jobId);

            if (!status) {
                return ResponseHandler.notFound(res, 'Job not found');

            }

            const data = {
                jobId,
                ...status
            }

            return ResponseHandler.success(res, data);

        } catch (error: any) {
            console.error('Error fetching job status:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch job status');
        }
    }

    /**
     * Get summarization queue and database statistics
     */
    async getSummarizationStats(req: Request, res: Response): Promise<void> {
        try {
            const queueStats = await this.queueService.getQueueStats();
            const dbStats = this.queueService.getDatabaseStats();
            const schedulerStatus = this.schedulerService.getStatus();

            const data = {
                queue: queueStats,
                database: dbStats,
                scheduler: schedulerStatus
            }

            return ResponseHandler.success(res, data);

        } catch (error: any) {
            console.error('Error fetching stats:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch stats');
        }
    }

    /**
     * Manually trigger the scheduler
     */
    async triggerScheduler(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const result = await this.schedulerService.triggerNow();

            return ResponseHandler.success(res, result);
        } catch (error: any) {
            console.error('Error triggering scheduler:', error);
            return ResponseHandler.internalError(res, 'Failed to trigger scheduler');
        }
    }

    /**
     * Get threads pending summarization
     */
    async getPendingThreads(req: Request, res: Response): Promise<void> {
        try {
            const { limit = 50 } = req.query;
            const threads = this.queueService.getThreadsNeedingSummary(
                parseInt(limit as string)
            );

            const data = {
                count: threads.length,
                threads
            }

            return ResponseHandler.success(res, data);

        } catch (error: any) {
            console.error('Error fetching pending threads:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch pending threads');
        }
    }
}
