import Queue, { Job, JobOptions } from 'bull';
interface SummarizationJobData {
    threadId: string;
    userId?: string;
    subject?: string;
    priority?: number;
}
export declare class SummarizationQueueService {
    private queue;
    private db;
    private isInitialized;
    constructor(dbPath?: string);
    /**
     * Initialize database schema for enhanced summaries
     */
    initializeSchema(): void;
    /**
     * Setup the queue processor
     */
    private setupQueueProcessor;
    /**
     * Setup event listeners for the queue
     */
    private setupEventListeners;
    /**
     * Add a thread to the summarization queue
     */
    addToQueue(data: SummarizationJobData, options?: JobOptions): Promise<Job<SummarizationJobData>>;
    /**
     * Add a thread with high priority
     */
    addPriorityJob(data: SummarizationJobData): Promise<Job<SummarizationJobData>>;
    /**
     * Get job status by job ID
     */
    getJobStatus(jobId: string): Promise<{
        state: string;
        progress: number;
        data: SummarizationJobData | undefined;
        failedReason?: string;
        finishedOn?: number;
        processedOn?: number;
    } | null>;
    /**
     * Get queue statistics
     */
    getQueueStats(): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
    }>;
    /**
     * Get database statistics
     */
    getDatabaseStats(): {
        status: string;
        count: number;
    }[];
    /**
     * Get threads needing summarization
     */
    getThreadsNeedingSummary(limit?: number): string[];
    /**
     * Get emails by thread ID
     */
    private getEmailsByThreadId;
    /**
     * Get thread summary
     */
    getThreadSummary(threadId: string): any | null;
    /**
     * Update summary status
     */
    private updateSummaryStatus;
    /**
     * Save enhanced summary to database
     */
    private saveEnhancedSummary;
    /**
     * Format emails for summarization
     */
    private formatEmailsForSummarization;
    /**
     * Extract participants from emails
     */
    private extractParticipants;
    /**
     * Call RunPod API for summarization
     * Note: The RunPod handler has its own prompt logic, so we just send the email content
     */
    private callRunPodSummarization;
    /**
     * Parse text response as fallback
     */
    private parseTextResponse;
    private extractKeyPoints;
    private extractActionItems;
    private extractSentiment;
    /**
     * Clean up resources
     */
    close(): Promise<void>;
    /**
     * Get the queue instance for external access
     */
    getQueue(): Queue.Queue<SummarizationJobData>;
}
export declare function getSummarizationQueueService(dbPath?: string): SummarizationQueueService;
export {};
//# sourceMappingURL=summarizationQueueService.d.ts.map