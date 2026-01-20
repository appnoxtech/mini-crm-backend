"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SummarizationQueueService = void 0;
exports.getSummarizationQueueService = getSummarizationQueueService;
const bull_1 = __importDefault(require("bull"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
// RunPod API configuration
const RUNPOD_API_URL = process.env.RUNPOD_API_URL || 'https://api.runpod.ai/v2/2ul7r04332koqo/run';
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || '';
// Queue configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || '3');
class SummarizationQueueService {
    queue;
    db;
    isInitialized = false;
    constructor(dbPath = './data.db') {
        this.db = new better_sqlite3_1.default(dbPath);
        // Initialize the queue
        this.queue = new bull_1.default('email-summarization', REDIS_URL, {
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000
                },
                removeOnComplete: 100,
                removeOnFail: false,
                timeout: 300000 // 5 minutes
            }
        });
        this.setupQueueProcessor();
        this.setupEventListeners();
    }
    /**
     * Initialize database schema for enhanced summaries
     */
    initializeSchema() {
        // Add new columns to thread_summaries if they don't exist
        const alterTableQueries = [
            "ALTER TABLE thread_summaries ADD COLUMN keyPoints TEXT",
            "ALTER TABLE thread_summaries ADD COLUMN actionItems TEXT",
            "ALTER TABLE thread_summaries ADD COLUMN sentiment TEXT",
            "ALTER TABLE thread_summaries ADD COLUMN participants TEXT",
            "ALTER TABLE thread_summaries ADD COLUMN processingTime INTEGER",
            "ALTER TABLE thread_summaries ADD COLUMN modelVersion TEXT",
            "ALTER TABLE thread_summaries ADD COLUMN jobId TEXT",
            "ALTER TABLE thread_summaries ADD COLUMN status TEXT DEFAULT 'pending'"
        ];
        for (const query of alterTableQueries) {
            try {
                this.db.exec(query);
                console.log(`✅ Schema update: ${query.substring(0, 50)}...`);
            }
            catch (error) {
                // Column already exists, ignore
                if (!error.message.includes('duplicate column name')) {
                    console.log(`ℹ️  Column already exists or error: ${error.message}`);
                }
            }
        }
        // Create index for faster lookups
        try {
            this.db.exec("CREATE INDEX IF NOT EXISTS idx_thread_summaries_status ON thread_summaries(status)");
            this.db.exec("CREATE INDEX IF NOT EXISTS idx_thread_summaries_jobId ON thread_summaries(jobId)");
        }
        catch (error) {
            // Index might already exist
        }
        this.isInitialized = true;
        console.log('📊 Summarization queue schema initialized');
    }
    /**
     * Setup the queue processor
     */
    setupQueueProcessor() {
        this.queue.process(MAX_CONCURRENT_JOBS, async (job) => {
            const { threadId, userId } = job.data;
            const startTime = Date.now();
            console.log(`📧 [Queue] Processing thread: ${threadId}`);
            await job.progress(10);
            try {
                // Check if thread already has a recent summary
                const existingSummary = this.getThreadSummary(threadId);
                if (existingSummary && existingSummary.status === 'completed') {
                    const hoursSinceSummary = (Date.now() - new Date(existingSummary.lastSummarizedAt).getTime()) / (1000 * 60 * 60);
                    if (hoursSinceSummary < 24) {
                        console.log(`⏭️  Thread ${threadId} already summarized within 24 hours`);
                        return { skipped: true, reason: 'recently_summarized' };
                    }
                }
                await job.progress(20);
                // Get emails for this thread
                const emails = this.getEmailsByThreadId(threadId);
                if (emails.length === 0) {
                    throw new Error(`No emails found for thread ${threadId}`);
                }
                await job.progress(30);
                // Format emails for summarization
                const emailContent = this.formatEmailsForSummarization(emails);
                await job.progress(40);
                // Update status to processing
                this.updateSummaryStatus(threadId, 'processing', job.id?.toString());
                // Call RunPod API
                const summaryData = await this.callRunPodSummarization(emailContent, emails);
                await job.progress(70);
                // Extract participants
                const participants = this.extractParticipants(emails);
                // Store enhanced summary
                this.saveEnhancedSummary(threadId, {
                    ...summaryData,
                    participants,
                    processingTime: Date.now() - startTime,
                    modelVersion: 'runpod-v1',
                    status: 'completed',
                    jobId: job.id?.toString()
                });
                await job.progress(100);
                console.log(`✅ [Queue] Completed thread: ${threadId} in ${Date.now() - startTime}ms`);
                return {
                    success: true,
                    threadId,
                    processingTime: Date.now() - startTime
                };
            }
            catch (error) {
                console.error(`❌ [Queue] Failed thread ${threadId}:`, error.message);
                // Update status to failed
                this.updateSummaryStatus(threadId, 'failed', job.id?.toString());
                throw error;
            }
        });
    }
    /**
     * Setup event listeners for the queue
     */
    setupEventListeners() {
        this.queue.on('completed', (job, result) => {
            console.log(`✅ [Queue] Job ${job.id} completed:`, result);
        });
        this.queue.on('failed', (job, err) => {
            console.error(`❌ [Queue] Job ${job?.id} failed:`, err.message);
        });
        this.queue.on('progress', (job, progress) => {
            console.log(`⏳ [Queue] Job ${job.id} progress: ${progress}%`);
        });
        this.queue.on('error', (error) => {
            console.error('❌ [Queue] Queue error:', error);
        });
        this.queue.on('stalled', (job) => {
            console.warn(`⚠️ [Queue] Job ${job.id} stalled`);
        });
    }
    /**
     * Add a thread to the summarization queue
     */
    async addToQueue(data, options) {
        const jobOptions = {
            jobId: `thread-${data.threadId}`,
            removeOnComplete: true,
            ...options
        };
        // Update status to queued
        this.updateSummaryStatus(data.threadId, 'queued');
        const job = await this.queue.add(data, jobOptions);
        console.log(`📥 [Queue] Added thread ${data.threadId} to queue with job ID: ${job.id}`);
        return job;
    }
    /**
     * Add a thread with high priority
     */
    async addPriorityJob(data) {
        return this.addToQueue(data, {
            priority: 1,
            jobId: `thread-${data.threadId}-priority-${Date.now()}`
        });
    }
    /**
     * Get job status by job ID
     */
    async getJobStatus(jobId) {
        const job = await this.queue.getJob(jobId);
        if (!job)
            return null;
        const state = await job.getState();
        return {
            state,
            progress: job.progress(),
            data: job.data,
            failedReason: job.failedReason,
            finishedOn: job.finishedOn,
            processedOn: job.processedOn
        };
    }
    /**
     * Get queue statistics
     */
    async getQueueStats() {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            this.queue.getWaitingCount(),
            this.queue.getActiveCount(),
            this.queue.getCompletedCount(),
            this.queue.getFailedCount(),
            this.queue.getDelayedCount()
        ]);
        return { waiting, active, completed, failed, delayed };
    }
    /**
     * Get database statistics
     */
    getDatabaseStats() {
        const stmt = this.db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM thread_summaries 
      GROUP BY status
    `);
        return stmt.all();
    }
    /**
     * Get threads needing summarization
     */
    getThreadsNeedingSummary(limit = 50) {
        const stmt = this.db.prepare(`
      SELECT DISTINCT threadId 
      FROM emails 
      WHERE threadId IS NOT NULL 
        AND threadId NOT IN (
          SELECT threadId FROM thread_summaries WHERE status = 'completed'
        )
      LIMIT ?
    `);
        const rows = stmt.all(limit);
        return rows.map(r => r.threadId);
    }
    /**
     * Get emails by thread ID
     */
    getEmailsByThreadId(threadId) {
        const stmt = this.db.prepare(`
      SELECT * FROM emails WHERE threadId = ? ORDER BY sentAt ASC
    `);
        const rows = stmt.all(threadId);
        return rows.map(row => ({
            id: row.id,
            threadId: row.threadId,
            from: row.from_address,
            to: row.to_addresses ? JSON.parse(row.to_addresses) : [],
            subject: row.subject,
            body: row.body,
            htmlBody: row.htmlBody,
            sentAt: new Date(row.sentAt)
        }));
    }
    /**
     * Get thread summary
     */
    getThreadSummary(threadId) {
        const stmt = this.db.prepare('SELECT * FROM thread_summaries WHERE threadId = ?');
        const row = stmt.get(threadId);
        if (!row)
            return null;
        return {
            threadId: row.threadId,
            summary: row.summary,
            keyPoints: row.keyPoints ? JSON.parse(row.keyPoints) : [],
            actionItems: row.actionItems ? JSON.parse(row.actionItems) : [],
            sentiment: row.sentiment,
            participants: row.participants ? JSON.parse(row.participants) : [],
            processingTime: row.processingTime,
            modelVersion: row.modelVersion,
            status: row.status || 'completed',
            jobId: row.jobId,
            lastSummarizedAt: row.lastSummarizedAt
        };
    }
    /**
     * Update summary status
     */
    updateSummaryStatus(threadId, status, jobId) {
        const stmt = this.db.prepare(`
      INSERT INTO thread_summaries (threadId, summary, lastSummarizedAt, status, jobId)
      VALUES (?, '', ?, ?, ?)
      ON CONFLICT(threadId) DO UPDATE SET
        status = excluded.status,
        jobId = excluded.jobId
    `);
        stmt.run(threadId, new Date().toISOString(), status, jobId || null);
    }
    /**
     * Save enhanced summary to database
     */
    saveEnhancedSummary(threadId, data) {
        const stmt = this.db.prepare(`
      INSERT INTO thread_summaries (
        threadId, summary, keyPoints, actionItems, sentiment, 
        participants, processingTime, modelVersion, status, jobId, lastSummarizedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(threadId) DO UPDATE SET
        summary = excluded.summary,
        keyPoints = excluded.keyPoints,
        actionItems = excluded.actionItems,
        sentiment = excluded.sentiment,
        participants = excluded.participants,
        processingTime = excluded.processingTime,
        modelVersion = excluded.modelVersion,
        status = excluded.status,
        jobId = excluded.jobId,
        lastSummarizedAt = excluded.lastSummarizedAt
    `);
        stmt.run(threadId, data.summary, JSON.stringify(data.keyPoints), JSON.stringify(data.actionItems), data.sentiment, JSON.stringify(data.participants), data.processingTime, data.modelVersion, data.status, data.jobId || null, new Date().toISOString());
    }
    /**
     * Format emails for summarization
     */
    formatEmailsForSummarization(emails) {
        return emails.map((email, idx) => {
            const body = email.body || '';
            return `
=== Email ${idx + 1} ===
From: ${email.from}
Date: ${email.sentAt.toISOString()}
Subject: ${email.subject}

${body.substring(0, 2000)}`; // Limit body length
        }).join('\n\n---\n');
    }
    /**
     * Extract participants from emails
     */
    extractParticipants(emails) {
        const participants = new Set();
        for (const email of emails) {
            // Extract from address
            if (email.from) {
                const fromMatch = email.from.match(/<(.+?)>/);
                const fromEmail = fromMatch && fromMatch[1] ? fromMatch[1] : email.from;
                participants.add(fromEmail);
            }
            // Extract to addresses
            if (email.to && Array.isArray(email.to)) {
                for (const addr of email.to) {
                    const toMatch = addr.match(/<(.+?)>/);
                    const toEmail = toMatch && toMatch[1] ? toMatch[1] : addr.trim();
                    participants.add(toEmail);
                }
            }
        }
        return Array.from(participants);
    }
    /**
     * Call RunPod API for summarization
     * Note: The RunPod handler has its own prompt logic, so we just send the email content
     */
    async callRunPodSummarization(emailContent, emails) {
        try {
            console.log('📤 Calling RunPod API...');
            const response = await fetch(RUNPOD_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${RUNPOD_API_KEY}`
                },
                body: JSON.stringify({
                    input: {
                        email_content: emailContent // Send raw email content, handler has its own prompt
                    }
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('📥 RunPod response:', JSON.stringify(data).substring(0, 500));
            // RunPod wraps handler response in 'output' field
            // Your handler returns: {status: "success", summary: "...", keyPoints?: [...], ...}
            const output = data.output;
            if (!output) {
                throw new Error('No output from RunPod');
            }
            // Check for error status
            if (output.status === 'error') {
                throw new Error(output.error || 'RunPod handler returned error');
            }
            // If output has structured data (keyPoints, actionItems, sentiment)
            if (output.keyPoints || output.actionItems || output.sentiment) {
                return {
                    summary: output.summary || '',
                    keyPoints: output.keyPoints || [],
                    actionItems: output.actionItems || [],
                    sentiment: output.sentiment || 'neutral'
                };
            }
            // If output only has summary (current handler format)
            if (output.summary) {
                const summaryText = output.summary;
                // Try to extract structured data from summary if it looks like JSON
                try {
                    const jsonMatch = summaryText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        if (parsed.summary) {
                            return {
                                summary: parsed.summary,
                                keyPoints: parsed.keyPoints || [],
                                actionItems: parsed.actionItems || [],
                                sentiment: parsed.sentiment || 'neutral'
                            };
                        }
                    }
                }
                catch (e) {
                    // Not JSON, use as plain text
                }
                // Use the summary as-is and extract insights from text
                return {
                    summary: summaryText,
                    keyPoints: this.extractKeyPoints(summaryText),
                    actionItems: this.extractActionItems(summaryText),
                    sentiment: this.extractSentiment(summaryText)
                };
            }
            // Ultimate fallback
            return this.parseTextResponse(JSON.stringify(output));
        }
        catch (error) {
            console.error('❌ RunPod API error:', error.message);
            // Create a fallback summary from email content
            return {
                summary: `Email thread with ${emails.length} messages about: ${emails[0]?.subject || 'Unknown subject'}`,
                keyPoints: [`Contains ${emails.length} emails`],
                actionItems: [],
                sentiment: 'neutral'
            };
        }
    }
    /**
     * Parse text response as fallback
     */
    parseTextResponse(text) {
        return {
            summary: text.substring(0, 500),
            keyPoints: this.extractKeyPoints(text),
            actionItems: this.extractActionItems(text),
            sentiment: this.extractSentiment(text)
        };
    }
    extractKeyPoints(text) {
        const lines = text.split('\n');
        const points = lines
            .filter(line => line.trim().match(/^[-•*]\s+/) || line.includes('Key point'))
            .map(line => line.replace(/^[-•*]\s+/, '').trim())
            .filter(line => line.length > 0);
        return points.slice(0, 5);
    }
    extractActionItems(text) {
        const lines = text.split('\n');
        const actions = lines
            .filter(line => line.toLowerCase().includes('action') ||
            line.toLowerCase().includes('todo') ||
            line.toLowerCase().includes('next step'))
            .map(line => line.replace(/^[-•*]\s+/, '').trim())
            .filter(line => line.length > 0);
        return actions.slice(0, 5);
    }
    extractSentiment(text) {
        const lower = text.toLowerCase();
        if (lower.includes('positive') || lower.includes('excited') || lower.includes('great')) {
            return 'positive';
        }
        if (lower.includes('negative') || lower.includes('concern') || lower.includes('issue')) {
            return 'negative';
        }
        return 'neutral';
    }
    /**
     * Clean up resources
     */
    async close() {
        await this.queue.close();
        this.db.close();
        console.log('🔒 Summarization queue closed');
    }
    /**
     * Get the queue instance for external access
     */
    getQueue() {
        return this.queue;
    }
}
exports.SummarizationQueueService = SummarizationQueueService;
// Singleton instance
let queueServiceInstance = null;
function getSummarizationQueueService(dbPath) {
    if (!queueServiceInstance) {
        queueServiceInstance = new SummarizationQueueService(dbPath);
    }
    return queueServiceInstance;
}
//# sourceMappingURL=summarizationQueueService.js.map