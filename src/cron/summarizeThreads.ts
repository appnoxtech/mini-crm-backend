import cron from 'node-cron';
import { summarizeThreadWithVLLM } from '../shared/utils/summarizer';
import { EmailModel } from '../modules/email/models/emailModel';
import Database from 'better-sqlite3';

export function startThreadSummaryJob(dbPath: string) {
  const db = new Database(dbPath, { timeout: 10000 });
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  const emailModel = new EmailModel(db);

  const summarizeAll = async () => {
    console.log('🕑 Starting thread summarization...');

    const threads = await emailModel.getThreadsNeedingSummary();
    console.log(`Found ${threads.length} threads needing summary`);

    for (const threadId of threads) {
      try {
        const { emails } = await emailModel.getAllEmails({ limit: 1000 });
        const threadEmails = emails.filter(e => e.threadId === threadId);
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
