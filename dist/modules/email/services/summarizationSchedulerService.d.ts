import { SummarizationQueueService } from './summarizationQueueService';
export declare class SummarizationSchedulerService {
    private cronJob;
    private queueService;
    private isRunning;
    constructor(dbPath?: string);
    /**
     * Start the scheduler
     */
    start(): void;
    /**
     * Run the scheduled summarization batch
     */
    runScheduledSummarization(): Promise<void>;
    /**
     * Manual trigger for immediate processing
     */
    triggerNow(): Promise<{
        queued: number;
        skipped: number;
    }>;
    /**
     * Stop the scheduler
     */
    stop(): void;
    /**
     * Get scheduler status
     */
    getStatus(): {
        isRunning: boolean;
        cronPattern: string;
        batchSize: number;
        nextRun?: Date;
    };
    /**
     * Get the queue service instance
     */
    getQueueService(): SummarizationQueueService;
}
export declare function getSummarizationScheduler(dbPath?: string): SummarizationSchedulerService;
/**
 * Start the summarization scheduler
 * Call this from your main server.ts
 */
export declare function startSummarizationScheduler(dbPath?: string): SummarizationSchedulerService;
//# sourceMappingURL=summarizationSchedulerService.d.ts.map