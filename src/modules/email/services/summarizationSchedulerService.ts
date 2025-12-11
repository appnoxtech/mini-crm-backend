import cron, { ScheduledTask } from 'node-cron';
import { SummarizationQueueService, getSummarizationQueueService } from './summarizationQueueService';

// Configuration from environment
const SUMMARIZATION_CRON = process.env.SUMMARIZATION_CRON || '*/30 * * * *'; // Every 30 minutes
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '50');

export class SummarizationSchedulerService {
    private cronJob: ScheduledTask | null = null;
    private queueService: SummarizationQueueService;
    private isRunning: boolean = false;

    constructor(dbPath: string = './data.db') {
        this.queueService = getSummarizationQueueService(dbPath);
    }

    /**
     * Start the scheduler
     */
    start(): void {
        if (this.cronJob) {
            console.log('⚠️ [Scheduler] Already running');
            return;
        }

        // Initialize schema on start
        this.queueService.initializeSchema();

        // Schedule the job
        this.cronJob = cron.schedule(SUMMARIZATION_CRON, async () => {
            await this.runScheduledSummarization();
        });

        console.log(`⏰ [Scheduler] Started with pattern: ${SUMMARIZATION_CRON}`);
        console.log(`📊 [Scheduler] Batch size: ${BATCH_SIZE}`);

        // Run immediately on startup (after a short delay to allow Redis connection)
        setTimeout(() => {
            this.runScheduledSummarization();
        }, 5000);
    }

    /**
     * Run the scheduled summarization batch
     */
    async runScheduledSummarization(): Promise<void> {
        if (this.isRunning) {
            console.log('⏳ [Scheduler] Previous batch still running, skipping...');
            return;
        }

        this.isRunning = true;
        console.log('\n🔄 [Scheduler] Starting scheduled summarization batch...');
        const startTime = Date.now();

        try {
            // Get threads that need summarization
            const threadsToSummarize = this.queueService.getThreadsNeedingSummary(BATCH_SIZE);

            console.log(`📊 [Scheduler] Found ${threadsToSummarize.length} threads to summarize`);

            if (threadsToSummarize.length === 0) {
                console.log('✨ [Scheduler] No threads need summarization');
                return;
            }

            // Add threads to queue
            let queued = 0;
            let skipped = 0;

            for (const threadId of threadsToSummarize) {
                try {
                    await this.queueService.addToQueue({
                        threadId,
                        subject: `Thread ${threadId}`
                    });
                    queued++;
                } catch (error: any) {
                    // Job might already exist in queue
                    if (error.message.includes('already exists')) {
                        skipped++;
                    } else {
                        console.error(`Failed to queue thread ${threadId}:`, error.message);
                    }
                }
            }

            const duration = Date.now() - startTime;
            console.log(`✅ [Scheduler] Queued ${queued} threads (${skipped} skipped) in ${duration}ms`);

            // Log queue stats
            const stats = await this.queueService.getQueueStats();
            console.log(`📊 [Scheduler] Queue stats:`, stats);

        } catch (error: any) {
            console.error('❌ [Scheduler] Error in scheduled job:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Manual trigger for immediate processing
     */
    async triggerNow(): Promise<{ queued: number; skipped: number }> {
        console.log('🔧 [Scheduler] Manual trigger requested');

        const threadsToSummarize = this.queueService.getThreadsNeedingSummary(BATCH_SIZE);

        let queued = 0;
        let skipped = 0;

        for (const threadId of threadsToSummarize) {
            try {
                await this.queueService.addToQueue({
                    threadId,
                    subject: `Thread ${threadId}`
                });
                queued++;
            } catch (error: any) {
                if (error.message.includes('already exists')) {
                    skipped++;
                }
            }
        }

        return { queued, skipped };
    }

    /**
     * Stop the scheduler
     */
    stop(): void {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            console.log('🛑 [Scheduler] Stopped');
        }
    }

    /**
     * Get scheduler status
     */
    getStatus(): {
        isRunning: boolean;
        cronPattern: string;
        batchSize: number;
        nextRun?: Date;
    } {
        return {
            isRunning: this.isRunning,
            cronPattern: SUMMARIZATION_CRON,
            batchSize: BATCH_SIZE
        };
    }

    /**
     * Get the queue service instance
     */
    getQueueService(): SummarizationQueueService {
        return this.queueService;
    }
}

// Singleton instance
let schedulerInstance: SummarizationSchedulerService | null = null;

export function getSummarizationScheduler(dbPath?: string): SummarizationSchedulerService {
    if (!schedulerInstance) {
        schedulerInstance = new SummarizationSchedulerService(dbPath);
    }
    return schedulerInstance;
}

/**
 * Start the summarization scheduler
 * Call this from your main server.ts
 */
export function startSummarizationScheduler(dbPath: string = './data.db'): SummarizationSchedulerService {
    const scheduler = getSummarizationScheduler(dbPath);
    scheduler.start();
    return scheduler;
}
