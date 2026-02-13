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

    constructor(emailModel: EmailModel) {
        this.emailModel = emailModel;
        this.queueService = getSummarizationQueueService();
        this.schedulerService = getSummarizationScheduler();
        this.runpodService = getRunPodAsyncService();
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
            let existingSummary = await this.queueService.getThreadSummary(threadId);
            if (!existingSummary) {
                existingSummary = await this.runpodService.getThreadSummary(threadId);
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
                    return ResponseHandler.success(res, data, 'Summarization already in progress');
                }

                if (normalizedStatus === 'completed') {
                    const data = {
                        threadId,
                        status: 'completed'
                    };
                    return ResponseHandler.success(res, data, 'Thread already summarized');
                }
            }

            // Submit to RunPod async (no Redis required!)
            const result = await this.runpodService.submitForSummarization(threadId);

            const data = {
                jobId: result.jobId,
                threadId,
                status: 'pending'
            };

            return ResponseHandler.success(res, data, 'Summarization queued with RunPod');
        } catch (error: any) {
            console.error('Error queuing summarization:', error);
            return ResponseHandler.error(res, 'Failed to queue summarization');
        }
    }

    /**
     * Synchronously summarize a thread (immediate result)
     */
    async summarizeThreadSync(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { threadId } = req.params;

            if (!threadId) {
                return ResponseHandler.validationError(res, 'Thread ID is required');
            }

            const emails = await this.emailModel.getEmailsForThread(threadId);

            if (emails.length === 0) {
                return ResponseHandler.notFound(res, 'Thread not found');
            }

            // Format thread text for summarization
            const threadText = emails
                .map(e => `${e.from}: ${e.body}`)
                .join('\n');

            // Call the summarization service
            const summary = await summarizeThreadWithVLLM(threadText);

            // Save the summary
            await this.emailModel.saveThreadSummary(threadId, summary);

            const data = {
                threadId,
                summary
            };

            return ResponseHandler.success(res, data);
        } catch (error: any) {
            console.error('Error in sync summarization:', error);
            return ResponseHandler.internalError(res, 'Failed to summarize thread');
        }
    }

    /**
     * Get thread summary with enhanced data
     * Checks both Redis queue service and RunPod async service
     * If no summary exists, fetches on-demand from RunPod
     */
    async getEnhancedThreadSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { threadId } = req.params;
            const { forceRefresh } = req.query;

            if (!threadId) {
                return ResponseHandler.validationError(res, 'Thread ID is required');
            }

            // Try to get summary from Redis queue service first
            let summary = await this.queueService.getThreadSummary(threadId);

            // If not found, try RunPod async service
            if (!summary) {
                summary = await this.runpodService.getThreadSummary(threadId);
            }

            // Check if we need to fetch on-demand:
            // 1. No summary exists
            // 2. Summary text is empty (job was submitted but never completed)
            // 3. User wants force refresh
            const hasSummaryText = summary?.summary?.trim();
            const needsOnDemandFetch = !summary ||
                !hasSummaryText ||
                forceRefresh === 'true';

            if (needsOnDemandFetch) {
                console.log(`[OnDemand] Fetching summary for thread ${threadId} (reason: ${!summary ? 'no summary' : !summary.summary?.trim() ? 'empty text' : summary.status === 'pending' ? 'pending status' : 'force refresh'})`);

                const emails = await this.emailModel.getEmailsForThread(threadId);

                if (emails.length === 0) {
                    return ResponseHandler.notFound(res, 'Thread not found or has no emails');
                }

                const threadText = emails
                    .map(e => `${e.from}: ${e.body}`)
                    .join('\n');

                try {
                    const summaryText = await summarizeThreadWithVLLM(threadText);
                    console.log(`[OnDemand] ✅ Got summary for thread ${threadId}`);

                    // Save to DB for future requests
                    await this.emailModel.saveThreadSummary(threadId, summaryText);

                    // Return the on-demand summary
                    const data = {
                        thread: {
                            id: threadId,
                            summarized: true
                        },
                        summary: {
                            text: summaryText,
                            keyPoints: [],
                            actionItems: [],
                            sentiment: null,
                            participants: emails.map(e => e.from).filter((v, i, a) => a.indexOf(v) === i),
                            processingTime: null,
                            modelVersion: 'runpod-ondemand',
                            lastSummarizedAt: new Date()
                        },
                        status: 'completed',
                        jobStatus: null,
                        runpodJobId: null,
                        onDemand: true
                    };

                    return ResponseHandler.success(res, data, 'Summary fetched on-demand');
                } catch (error: any) {
                    console.error(`[OnDemand] ❌ Failed to fetch summary for thread ${threadId}:`, error.message);
                    return ResponseHandler.internalError(res, `Failed to fetch summary: ${error.message}`);
                }
            }

            // Normalize status codes
            // If summary text exists, treat as completed regardless of stored status
            const summaryTextExists = !!summary.summary?.trim();
            const normalizedStatus = summaryTextExists ? 'completed' : this.normalizeStatus(summary.status);
            const isCompleted = summaryTextExists || normalizedStatus === 'completed';

            // If summary is in progress, try to get job status
            let jobStatus = null;
            if (!isCompleted) {
                if (summary.jobId) {
                    jobStatus = await this.queueService.getJobStatus(summary.jobId);
                } else if (summary.runpodJobId) {
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
            };

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
            const threads = await this.queueService.getThreadsNeedingSummary(limit);

            if (threads.length === 0) {
                return ResponseHandler.success(res, 0, 'No threads need summarization');
            }

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
                    // Skip
                }
            }

            const data = {
                queued: jobs.length,
                jobIds: jobs.filter(id => id)
            };

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
            };

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
            const dbStats = await this.queueService.getDatabaseStats();
            const schedulerStatus = this.schedulerService.getStatus();

            const data = {
                queue: queueStats,
                database: dbStats,
                scheduler: schedulerStatus
            };

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
            const threads = await this.queueService.getThreadsNeedingSummary(
                parseInt(limit as string)
            );

            const data = {
                count: threads.length,
                threads
            };

            return ResponseHandler.success(res, data);
        } catch (error: any) {
            console.error('Error fetching pending threads:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch pending threads');
        }
    }
}
