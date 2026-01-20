import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../../shared/types';
import { EmailModel } from '../models/emailModel';
export declare class SummarizationController {
    private queueService;
    private schedulerService;
    private runpodService;
    private emailModel;
    constructor(emailModel: EmailModel, dbPath?: string);
    /**
     * Queue a thread for summarization (uses RunPod async - no Redis needed!)
     */
    queueThreadSummarization(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Synchronously summarize a thread (immediate result)
     */
    summarizeThreadSync(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get thread summary with enhanced data
     * Checks both Redis queue service and RunPod async service
     */
    getEnhancedThreadSummary(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Normalize status codes from different services
     */
    private normalizeStatus;
    /**
     * Bulk summarize user's threads
     */
    bulkSummarize(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get job status by job ID
     */
    getJobStatus(req: Request, res: Response): Promise<void>;
    /**
     * Get summarization queue and database statistics
     */
    getSummarizationStats(req: Request, res: Response): Promise<void>;
    /**
     * Manually trigger the scheduler
     */
    triggerScheduler(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get threads pending summarization
     */
    getPendingThreads(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=summarizationController.d.ts.map