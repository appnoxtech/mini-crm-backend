interface SummaryData {
    summary: string;
    keyPoints: string[];
    actionItems: string[];
    sentiment: 'positive' | 'negative' | 'neutral';
}
interface RunPodJob {
    id: string;
    status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    output?: any;
    error?: string;
}
export declare class RunPodAsyncService {
    private db;
    constructor(dbPath?: string);
    /**
     * Initialize database schema
     */
    initializeSchema(): void;
    /**
     * Submit a thread for async summarization
     * Returns immediately with a job ID
     */
    submitForSummarization(threadId: string): Promise<{
        jobId: string;
        status: string;
    }>;
    /**
     * Check the status of a RunPod job
     */
    checkJobStatus(jobId: string): Promise<RunPodJob>;
    /**
     * Submit and wait for result (with polling)
     * Use this for real-time requests
     */
    summarizeAndWait(threadId: string): Promise<SummaryData>;
    /**
     * Check all pending jobs and update their status
     * Call this from a cron job for batch processing
     */
    processPendingJobs(): Promise<{
        completed: number;
        failed: number;
        pending: number;
    }>;
    /**
     * Get threads that need summarization and submit them
     */
    submitPendingThreads(limit?: number): Promise<{
        submitted: number;
        jobIds: string[];
    }>;
    private getEmailsByThreadId;
    getThreadsNeedingSummary(limit?: number): string[];
    private getPendingJobs;
    private updateJobStatus;
    private saveCompletedSummary;
    getThreadSummary(threadId: string): any | null;
    private formatEmailsForSummarization;
    private extractParticipants;
    private parseRunPodOutput;
    private extractKeyPoints;
    private extractActionItems;
    private extractSentiment;
    private sleep;
}
export declare function getRunPodAsyncService(dbPath?: string): RunPodAsyncService;
export {};
//# sourceMappingURL=runpodAsyncService.d.ts.map