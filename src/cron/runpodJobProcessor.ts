import cron from 'node-cron';
import { getRunPodAsyncService, RunPodAsyncService } from '../modules/email/services/runpodAsyncService';

const SUBMIT_CRON = process.env.RUNPOD_SUBMIT_CRON || '*/15 * * * *';
const CHECK_CRON = process.env.RUNPOD_CHECK_CRON || '*/2 * * * *';
const BATCH_SIZE = parseInt(process.env.RUNPOD_BATCH_SIZE || '10');

let runpodService: RunPodAsyncService;

export function startRunPodJobProcessor(): void {
    runpodService = getRunPodAsyncService();

    cron.schedule(SUBMIT_CRON, async () => {
        try {
            const result = await runpodService.submitPendingThreads(BATCH_SIZE);
            if (result.submitted > 0) {
                console.log(`📊 [RunPod Cron] Submitted ${result.submitted} threads`);
            }
        } catch (error: any) {
            console.error('❌ [RunPod Cron] Error submitting threads:', error.message);
        }
    });

    cron.schedule(CHECK_CRON, async () => {
        try {
            const result = await runpodService.processPendingJobs();
            if (result.completed > 0 || result.failed > 0) {
                console.log(`📊 [RunPod Cron] Completed: ${result.completed}, Failed: ${result.failed}, Pending: ${result.pending}`);
            }
        } catch (error: any) {
            console.error('❌ [RunPod Cron] Error checking jobs:', error.message);
        }
    });

    setTimeout(async () => {
        try {
            await runpodService.processPendingJobs();
        } catch (error: any) {
            console.error('❌ [RunPod Cron] Initial check failed:', error.message);
        }
    }, 10000);
}

export async function triggerThreadSubmission(limit?: number): Promise<{ submitted: number; jobIds: string[] }> {
    if (!runpodService) {
        runpodService = getRunPodAsyncService();
    }
    return runpodService.submitPendingThreads(limit || BATCH_SIZE);
}

export async function triggerJobCheck(): Promise<{ completed: number; failed: number; pending: number }> {
    if (!runpodService) {
        runpodService = getRunPodAsyncService();
    }
    return runpodService.processPendingJobs();
}
