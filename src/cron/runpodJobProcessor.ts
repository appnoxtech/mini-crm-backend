import cron from 'node-cron';
import { getRunPodAsyncService, RunPodAsyncService } from '../modules/email/services/runpodAsyncService';

/**
 * RunPod Job Processor Cron
 * 
 * This cron job handles two tasks:
 * 1. Submit new threads for summarization
 * 2. Check status of pending jobs and update database
 * 
 * Cost-efficient: Uses RunPod's built-in queue, no Redis needed!
 */

// Configuration
const SUBMIT_CRON = process.env.RUNPOD_SUBMIT_CRON || '*/15 * * * *';  // Every 15 minutes
const CHECK_CRON = process.env.RUNPOD_CHECK_CRON || '*/2 * * * *';     // Every 2 minutes
const BATCH_SIZE = parseInt(process.env.RUNPOD_BATCH_SIZE || '10');

let runpodService: RunPodAsyncService;

export function startRunPodJobProcessor(dbPath: string = './data.db'): void {
    runpodService = getRunPodAsyncService(dbPath);

    // Initialize schema
    runpodService.initializeSchema();

    // Cron job to submit new threads for summarization
    cron.schedule(SUBMIT_CRON, async () => {
        console.log('\n📤 [RunPod Cron] Submitting pending threads...');
        try {
            const result = await runpodService.submitPendingThreads(BATCH_SIZE);
            console.log(`📊 [RunPod Cron] Submitted ${result.submitted} threads`);
        } catch (error: any) {
            console.error('❌ [RunPod Cron] Error submitting threads:', error.message);
        }
    });

    // Cron job to check status of pending jobs
    cron.schedule(CHECK_CRON, async () => {
        console.log('\n🔍 [RunPod Cron] Checking pending jobs...');
        try {
            const result = await runpodService.processPendingJobs();
            if (result.completed > 0 || result.failed > 0) {
                console.log(`📊 [RunPod Cron] Completed: ${result.completed}, Failed: ${result.failed}, Pending: ${result.pending}`);
            }
        } catch (error: any) {
            console.error('❌ [RunPod Cron] Error checking jobs:', error.message);
        }
    });

    console.log(`⏰ [RunPod Cron] Job processor started`);
    console.log(`   📤 Submit new threads: ${SUBMIT_CRON}`);
    console.log(`   🔍 Check pending jobs: ${CHECK_CRON}`);
    console.log(`   📦 Batch size: ${BATCH_SIZE}`);

    // Run initial check after 10 seconds
    setTimeout(async () => {
        console.log('\n🚀 [RunPod Cron] Running initial job check...');
        try {
            await runpodService.processPendingJobs();
        } catch (error: any) {
            console.error('❌ [RunPod Cron] Initial check failed:', error.message);
        }
    }, 10000);
}

/**
 * Manually trigger thread submission
 */
export async function triggerThreadSubmission(limit?: number): Promise<{ submitted: number; jobIds: string[] }> {
    if (!runpodService) {
        runpodService = getRunPodAsyncService();
    }
    return runpodService.submitPendingThreads(limit || BATCH_SIZE);
}

/**
 * Manually trigger job status check
 */
export async function triggerJobCheck(): Promise<{ completed: number; failed: number; pending: number }> {
    if (!runpodService) {
        runpodService = getRunPodAsyncService();
    }
    return runpodService.processPendingJobs();
}
