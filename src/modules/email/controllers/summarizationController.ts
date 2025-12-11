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
                res.status(400).json({ error: 'Thread ID is required' });
                return;
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
                    res.json({
                        success: true,
                        message: 'Summarization already in progress',
                        jobId: existingSummary.runpodJobId || existingSummary.jobId,
                        threadId,
                        status: normalizedStatus
                    });
                    return;
                }

                if (normalizedStatus === 'completed') {
                    res.json({
                        success: true,
                        message: 'Thread already summarized',
                        threadId,
                        status: 'completed'
                    });
                    return;
                }
            }

            // Submit to RunPod async (no Redis required!)
            const result = await this.runpodService.submitForSummarization(threadId);

            res.json({
                success: true,
                message: 'Summarization queued with RunPod',
                jobId: result.jobId,
                threadId,
                status: 'pending'
            });

        } catch (error: any) {
            console.error('Error queuing summarization:', error);
            res.status(500).json({
                error: 'Failed to queue summarization',
                details: error.message
            });
        }
    }

    /**
     * Synchronously summarize a thread (immediate result)
     */
    async summarizeThreadSync(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { threadId } = req.params;

            if (!threadId) {
                res.status(400).json({ error: 'Thread ID is required' });
                return;
            }

            // Get all emails and filter by threadId
            const { emails } = await this.emailModel.getAllEmails({ limit: 1000 });
            const threadEmails = emails.filter(e => e.threadId === threadId);

            if (threadEmails.length === 0) {
                res.status(404).json({ error: 'Thread not found' });
                return;
            }

            // Format thread text for summarization
            const threadText = threadEmails
                .map(e => `${e.from}: ${e.body}`)
                .join('\n');

            // Call the summarization service
            const summary = await summarizeThreadWithVLLM(threadText);

            // Save the summary
            await this.emailModel.saveThreadSummary(threadId, summary);

            res.json({
                success: true,
                threadId,
                summary
            });

        } catch (error: any) {
            console.error('Error in sync summarization:', error);
            res.status(500).json({
                error: 'Failed to summarize thread',
                details: error.message
            });
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
                res.status(400).json({ error: 'Thread ID is required' });
                return;
            }

            // Try to get summary from Redis queue service first
            let summary = this.queueService.getThreadSummary(threadId);

            // If not found, try RunPod async service
            if (!summary) {
                summary = this.runpodService.getThreadSummary(threadId);
            }

            // If still not found, return 404
            if (!summary) {
                res.status(404).json({
                    error: 'No summary available',
                    threadId,
                    suggestion: 'Use POST /api/summarization/threads/:threadId/queue to generate a summary'
                });
                return;
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

            res.json({
                success: true,
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
            });

        } catch (error: any) {
            console.error('Error fetching summary:', error);
            res.status(500).json({
                error: 'Failed to fetch summary',
                details: error.message
            });
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
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const { limit = 50 } = req.body;
            const userId = req.user.id.toString();

            // Get threads needing summarization
            const threads = this.queueService.getThreadsNeedingSummary(limit);

            if (threads.length === 0) {
                res.json({
                    success: true,
                    message: 'No threads need summarization',
                    queued: 0
                });
                return;
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

            res.json({
                success: true,
                message: `Queued ${jobs.length} threads for summarization`,
                queued: jobs.length,
                jobIds: jobs.filter(id => id)
            });

        } catch (error: any) {
            console.error('Error in bulk summarization:', error);
            res.status(500).json({
                error: 'Failed to queue bulk summarization',
                details: error.message
            });
        }
    }

    /**
     * Get job status by job ID
     */
    async getJobStatus(req: Request, res: Response): Promise<void> {
        try {
            const { jobId } = req.params;

            if (!jobId) {
                res.status(400).json({ error: 'Job ID is required' });
                return;
            }

            const status = await this.queueService.getJobStatus(jobId);

            if (!status) {
                res.status(404).json({ error: 'Job not found' });
                return;
            }

            res.json({
                success: true,
                jobId,
                ...status
            });

        } catch (error: any) {
            console.error('Error fetching job status:', error);
            res.status(500).json({
                error: 'Failed to fetch job status',
                details: error.message
            });
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

            res.json({
                success: true,
                queue: queueStats,
                database: dbStats,
                scheduler: schedulerStatus
            });

        } catch (error: any) {
            console.error('Error fetching stats:', error);
            res.status(500).json({
                error: 'Failed to fetch stats',
                details: error.message
            });
        }
    }

    /**
     * Manually trigger the scheduler
     */
    async triggerScheduler(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const result = await this.schedulerService.triggerNow();

            res.json({
                success: true,
                message: 'Scheduler triggered',
                ...result
            });

        } catch (error: any) {
            console.error('Error triggering scheduler:', error);
            res.status(500).json({
                error: 'Failed to trigger scheduler',
                details: error.message
            });
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

            res.json({
                success: true,
                count: threads.length,
                threads
            });

        } catch (error: any) {
            console.error('Error fetching pending threads:', error);
            res.status(500).json({
                error: 'Failed to fetch pending threads',
                details: error.message
            });
        }
    }
}
