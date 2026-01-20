"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startThreadSummaryJob = startThreadSummaryJob;
const node_cron_1 = __importDefault(require("node-cron"));
const summarizer_1 = require("../shared/utils/summarizer");
const emailModel_1 = require("../modules/email/models/emailModel");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
function startThreadSummaryJob(dbPath) {
    const db = new better_sqlite3_1.default(dbPath);
    const emailModel = new emailModel_1.EmailModel(db);
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
                const summary = await (0, summarizer_1.summarizeThreadWithVLLM)(threadText);
                await emailModel.saveThreadSummary(threadId, summary);
                console.log(`✅ Thread ${threadId} summarized`);
            }
            catch (err) {
                console.error(`❌ Failed to summarize thread ${threadId}:`, err.message);
            }
        }
        console.log('🕑 Thread summarization completed');
    };
    // Schedule daily at 2 AM
    node_cron_1.default.schedule('0 2 * * *', summarizeAll);
    return summarizeAll; // also allow manual invocation
}
//# sourceMappingURL=summarizeThreads.js.map