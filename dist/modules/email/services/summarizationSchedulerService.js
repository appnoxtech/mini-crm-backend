"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SummarizationSchedulerService = void 0;
exports.getSummarizationScheduler = getSummarizationScheduler;
exports.startSummarizationScheduler = startSummarizationScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const summarizationQueueService_1 = require("./summarizationQueueService");
// Configuration from environment
const SUMMARIZATION_CRON = process.env.SUMMARIZATION_CRON || '*/30 * * * *'; // Every 30 minutes
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '50');
class SummarizationSchedulerService {
    cronJob = null;
    queueService;
    isRunning = false;
    constructor(dbPath = './data.db') {
        this.queueService = (0, summarizationQueueService_1.getSummarizationQueueService)(dbPath);
    }
    /**
     * Start the scheduler
     */
    start() {
        if (this.cronJob) {
            console.log('⚠️ [Scheduler] Already running');
            return;
        }
        // Initialize schema on start
        this.queueService.initializeSchema();
        // Schedule the job
        this.cronJob = node_cron_1.default.schedule(SUMMARIZATION_CRON, async () => {
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
    async runScheduledSummarization() {
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
                }
                catch (error) {
                    // Job might already exist in queue
                    if (error.message.includes('already exists')) {
                        skipped++;
                    }
                    else {
                        console.error(`Failed to queue thread ${threadId}:`, error.message);
                    }
                }
            }
            const duration = Date.now() - startTime;
            console.log(`✅ [Scheduler] Queued ${queued} threads (${skipped} skipped) in ${duration}ms`);
            // Log queue stats
            const stats = await this.queueService.getQueueStats();
            console.log(`📊 [Scheduler] Queue stats:`, stats);
        }
        catch (error) {
            console.error('❌ [Scheduler] Error in scheduled job:', error);
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Manual trigger for immediate processing
     */
    async triggerNow() {
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
            }
            catch (error) {
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
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            console.log('🛑 [Scheduler] Stopped');
        }
    }
    /**
     * Get scheduler status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            cronPattern: SUMMARIZATION_CRON,
            batchSize: BATCH_SIZE
        };
    }
    /**
     * Get the queue service instance
     */
    getQueueService() {
        return this.queueService;
    }
}
exports.SummarizationSchedulerService = SummarizationSchedulerService;
// Singleton instance
let schedulerInstance = null;
function getSummarizationScheduler(dbPath) {
    if (!schedulerInstance) {
        schedulerInstance = new SummarizationSchedulerService(dbPath);
    }
    return schedulerInstance;
}
/**
 * Start the summarization scheduler
 * Call this from your main server.ts
 */
function startSummarizationScheduler(dbPath = './data.db') {
    const scheduler = getSummarizationScheduler(dbPath);
    scheduler.start();
    return scheduler;
}
//# sourceMappingURL=summarizationSchedulerService.js.map