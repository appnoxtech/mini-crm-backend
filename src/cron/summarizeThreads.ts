import cron from 'node-cron';
import { summarizeThreadWithVLLM } from '../shared/utils/summarizer';
import { EmailModel } from '../modules/email/models/emailModel';

export function startThreadSummaryJob() {
  const emailModel = new EmailModel();

  const summarizeAll = async () => {
    console.log('🕑 Starting thread summarization...');

    const threads = await emailModel.getThreadsNeedingSummary();
    console.log(`Found ${threads.length} threads needing summary`);

    for (const threadId of threads) {
      try {
        const threadEmails = await emailModel.getEmailsForThread(threadId);
        const threadText = threadEmails.map(e => `${e.from}: ${e.body}`).join('\n');

        // Directly call VLLM service
        const summary = await summarizeThreadWithVLLM(threadText);

        await emailModel.saveThreadSummary(threadId, summary);
        console.log(`✅ Thread ${threadId} summarized`);
      } catch (err: any) {
        console.error(`❌ Failed to summarize thread ${threadId}:`, err.message);
      }
    }

    console.log('🕑 Thread summarization completed');
  };

  // Schedule daily at 2 AM
  cron.schedule('0 2 * * *', summarizeAll);

  return summarizeAll; // also allow manual invocation
}
