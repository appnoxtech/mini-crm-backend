import cron, { ScheduledTask } from 'node-cron';
import { SummarizationQueueService, getSummarizationQueueService } from './summarizationQueueService';

const SUMMARIZATION_CRON = process.env.SUMMARIZATION_CRON || '*/30 * * * *';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '50');

export class SummarizationSchedulerService {
    private cronJob: ScheduledTask | null = null;
    private queueService: SummarizationQueueService;
    private isRunning: boolean = false;

    constructor(_dbPath?: string) {
        this.queueService = getSummarizationQueueService();
    }

    start(): void {
        if (this.cronJob) return;

        this.cronJob = cron.schedule(SUMMARIZATION_CRON, async () => {
            await this.runScheduledSummarization();
        });

        setTimeout(() => {
            this.runScheduledSummarization();
        }, 5000);
    }

    async runScheduledSummarization(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;

        try {
            const threadsToSummarize = await this.queueService.getThreadsNeedingSummary(BATCH_SIZE);
            if (threadsToSummarize.length === 0) return;

            for (const threadId of threadsToSummarize) {
                try {
                    await this.queueService.addToQueue({
                        threadId,
                        subject: `Thread ${threadId}`
                    });
                } catch (error: any) {
                    if (error.message.includes('Redis queue is not available')) {
                        console.warn('⚠️ Skipping summarization - Redis not available');
                        return; // Exit early if Redis is not available
                    }
                    if (!error.message.includes('already exists')) {
                        console.error(`Failed to queue thread ${threadId}:`, error.message);
                    }
                }
            }
        } catch (error: any) {
            console.error('❌ [Scheduler] Error in scheduled job:', error);
        } finally {
            this.isRunning = false;
        }
    }

    async triggerNow(): Promise<{ queued: number; skipped: number }> {
        const threadsToSummarize = await this.queueService.getThreadsNeedingSummary(BATCH_SIZE);
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

    stop(): void {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            cronPattern: SUMMARIZATION_CRON,
            batchSize: BATCH_SIZE
        };
    }
}

let schedulerInstance: SummarizationSchedulerService | null = null;
export function getSummarizationScheduler(): SummarizationSchedulerService {
    if (!schedulerInstance) {
        schedulerInstance = new SummarizationSchedulerService();
    }
    return schedulerInstance;
}

export function startSummarizationScheduler(): SummarizationSchedulerService {
    const scheduler = getSummarizationScheduler();
    scheduler.start();
    return scheduler;
}
