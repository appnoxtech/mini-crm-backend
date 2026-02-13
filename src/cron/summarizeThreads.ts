import cron from 'node-cron';
import { summarizeThreadWithVLLM } from '../shared/utils/summarizer';
import { EmailModel } from '../modules/email/models/emailModel';

export function startThreadSummaryJob() {
  const emailModel = new EmailModel();

  const summarizeAll = async () => {
    console.log('🕑 [Cron] Starting thread summarization...');

    const threads = await emailModel.getThreadsNeedingSummary();
    console.log(`[Cron] Found ${threads.length} threads needing summary`);

    let successCount = 0;
    let failCount = 0;

    for (const threadId of threads) {
      try {
        console.log(`[Cron] Processing thread ${threadId}...`);
        const threadEmails = await emailModel.getEmailsForThread(threadId);
        console.log(`[Cron] Thread ${threadId} has ${threadEmails.length} emails`);
        
        const threadText = threadEmails.map(e => `${e.from}: ${e.body}`).join('\n');

        const summary = await summarizeThreadWithVLLM(threadText);
        
        console.log(`[Cron] Thread ${threadId} summary preview: ${summary.substring(0, 100)}...`);

        await emailModel.saveThreadSummary(threadId, summary);
        console.log(`✅ [Cron] Thread ${threadId} summarized and saved`);
        successCount++;
      } catch (err: any) {
        console.error(`❌ [Cron] Failed to summarize thread ${threadId}:`, err.message);
        failCount++;
      }
    }

    console.log(`🕑 [Cron] Thread summarization completed. Success: ${successCount}, Failed: ${failCount}`);
  };

  // Schedule daily at 2 AM
  cron.schedule('0 2 * * *', summarizeAll);

  return summarizeAll; // also allow manual invocation
}
