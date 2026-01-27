import Queue, { Job, JobOptions } from 'bull';
import Database from 'better-sqlite3';

// RunPod API configuration
const RUNPOD_API_URL = process.env.RUNPOD_API_URL || 'https://api.runpod.ai/v2/2ul7r04332koqo/run';
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || '';

// Queue configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || '3');

interface SummarizationJobData {
    threadId: string;
    userId?: string;
    subject?: string;
    priority?: number;
}

interface SummaryData {
    summary: string;
    keyPoints: string[];
    actionItems: string[];
    sentiment: 'positive' | 'negative' | 'neutral';
}

interface Email {
    id: string;
    threadId: string | null;
    from: string;
    to: string[];
    subject: string;
    body: string;
    htmlBody?: string;
    sentAt: Date;
    [key: string]: any;
}

export class SummarizationQueueService {
    private queue: Queue.Queue<SummarizationJobData>;
    private db: Database.Database;
    private isInitialized: boolean = false;

    constructor(dbPath: string = './data.db') {
        this.db = new Database(dbPath);

        // Initialize the queue
        this.queue = new Queue<SummarizationJobData>('email-summarization', REDIS_URL, {
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
    initializeSchema(): void {
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

            } catch (error: any) {
                // Column already exists, ignore
                if (!error.message.includes('duplicate column name')) {

                }
            }
        }

        // Create index for faster lookups
        try {
            this.db.exec("CREATE INDEX IF NOT EXISTS idx_thread_summaries_status ON thread_summaries(status)");
            this.db.exec("CREATE INDEX IF NOT EXISTS idx_thread_summaries_jobId ON thread_summaries(jobId)");
        } catch (error) {
            // Index might already exist
        }

        this.isInitialized = true;

    }

    /**
     * Setup the queue processor
     */
    private setupQueueProcessor(): void {
        this.queue.process(MAX_CONCURRENT_JOBS, async (job: Job<SummarizationJobData>) => {
            const { threadId, userId } = job.data;
            const startTime = Date.now();


            await job.progress(10);

            try {
                // Check if thread already has a recent summary
                const existingSummary = this.getThreadSummary(threadId);
                if (existingSummary && existingSummary.status === 'completed') {
                    const hoursSinceSummary = (Date.now() - new Date(existingSummary.lastSummarizedAt).getTime()) / (1000 * 60 * 60);
                    if (hoursSinceSummary < 24) {

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


                return {
                    success: true,
                    threadId,
                    processingTime: Date.now() - startTime
                };

            } catch (error: any) {
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
    private setupEventListeners(): void {
        this.queue.on('completed', (job, result) => {

        });

        this.queue.on('failed', (job, err) => {
            console.error(`❌ [Queue] Job ${job?.id} failed:`, err.message);
        });

        this.queue.on('progress', (job, progress) => {

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
    async addToQueue(data: SummarizationJobData, options?: JobOptions): Promise<Job<SummarizationJobData>> {
        const jobOptions: JobOptions = {
            jobId: `thread-${data.threadId}`,
            removeOnComplete: true,
            ...options
        };

        // Update status to queued
        this.updateSummaryStatus(data.threadId, 'queued');

        const job = await this.queue.add(data, jobOptions);

        return job;
    }

    /**
     * Add a thread with high priority
     */
    async addPriorityJob(data: SummarizationJobData): Promise<Job<SummarizationJobData>> {
        return this.addToQueue(data, {
            priority: 1,
            jobId: `thread-${data.threadId}-priority-${Date.now()}`
        });
    }

    /**
     * Get job status by job ID
     */
    async getJobStatus(jobId: string): Promise<{
        state: string;
        progress: number;
        data: SummarizationJobData | undefined;
        failedReason?: string;
        finishedOn?: number;
        processedOn?: number;
    } | null> {
        const job = await this.queue.getJob(jobId);
        if (!job) return null;

        const state = await job.getState();
        return {
            state,
            progress: job.progress() as number,
            data: job.data,
            failedReason: job.failedReason,
            finishedOn: job.finishedOn,
            processedOn: job.processedOn
        };
    }

    /**
     * Get queue statistics
     */
    async getQueueStats(): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
    }> {
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
    getDatabaseStats(): { status: string; count: number }[] {
        const stmt = this.db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM thread_summaries 
      GROUP BY status
    `);
        return stmt.all() as { status: string; count: number }[];
    }

    /**
     * Get threads needing summarization
     */
    getThreadsNeedingSummary(limit: number = 50): string[] {
        const stmt = this.db.prepare(`
      SELECT DISTINCT threadId 
      FROM emails 
      WHERE threadId IS NOT NULL 
        AND threadId NOT IN (
          SELECT threadId FROM thread_summaries WHERE status = 'completed'
        )
      LIMIT ?
    `);
        const rows = stmt.all(limit) as { threadId: string }[];
        return rows.map(r => r.threadId);
    }

    /**
     * Get emails by thread ID
     */
    private getEmailsByThreadId(threadId: string): Email[] {
        const stmt = this.db.prepare(`
      SELECT * FROM emails WHERE threadId = ? ORDER BY sentAt ASC
    `);
        const rows = stmt.all(threadId) as any[];

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
    getThreadSummary(threadId: string): any | null {
        const stmt = this.db.prepare('SELECT * FROM thread_summaries WHERE threadId = ?');
        const row = stmt.get(threadId) as any;
        if (!row) return null;

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
    private updateSummaryStatus(threadId: string, status: string, jobId?: string): void {
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
    private saveEnhancedSummary(
        threadId: string,
        data: SummaryData & {
            participants: string[];
            processingTime: number;
            modelVersion: string;
            status: string;
            jobId?: string;
        }
    ): void {
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

        stmt.run(
            threadId,
            data.summary,
            JSON.stringify(data.keyPoints),
            JSON.stringify(data.actionItems),
            data.sentiment,
            JSON.stringify(data.participants),
            data.processingTime,
            data.modelVersion,
            data.status,
            data.jobId || null,
            new Date().toISOString()
        );
    }

    /**
     * Format emails for summarization
     */
    private formatEmailsForSummarization(emails: Email[]): string {
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
    private extractParticipants(emails: Email[]): string[] {
        const participants = new Set<string>();

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
    private async callRunPodSummarization(emailContent: string, emails: Email[]): Promise<SummaryData> {
        try {


            const response = await fetch(RUNPOD_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${RUNPOD_API_KEY}`
                },
                body: JSON.stringify({
                    input: {
                        email_content: emailContent  // Send raw email content, handler has its own prompt
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();


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
                } catch (e) {
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

        } catch (error: any) {
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
    private parseTextResponse(text: string): SummaryData {
        return {
            summary: text.substring(0, 500),
            keyPoints: this.extractKeyPoints(text),
            actionItems: this.extractActionItems(text),
            sentiment: this.extractSentiment(text)
        };
    }

    private extractKeyPoints(text: string): string[] {
        const lines = text.split('\n');
        const points = lines
            .filter(line => line.trim().match(/^[-•*]\s+/) || line.includes('Key point'))
            .map(line => line.replace(/^[-•*]\s+/, '').trim())
            .filter(line => line.length > 0);
        return points.slice(0, 5);
    }

    private extractActionItems(text: string): string[] {
        const lines = text.split('\n');
        const actions = lines
            .filter(line =>
                line.toLowerCase().includes('action') ||
                line.toLowerCase().includes('todo') ||
                line.toLowerCase().includes('next step')
            )
            .map(line => line.replace(/^[-•*]\s+/, '').trim())
            .filter(line => line.length > 0);
        return actions.slice(0, 5);
    }

    private extractSentiment(text: string): 'positive' | 'negative' | 'neutral' {
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
    async close(): Promise<void> {
        await this.queue.close();
        this.db.close();

    }

    /**
     * Get the queue instance for external access
     */
    getQueue(): Queue.Queue<SummarizationJobData> {
        return this.queue;
    }
}

// Singleton instance
let queueServiceInstance: SummarizationQueueService | null = null;

export function getSummarizationQueueService(dbPath?: string): SummarizationQueueService {
    if (!queueServiceInstance) {
        queueServiceInstance = new SummarizationQueueService(dbPath);
    }
    return queueServiceInstance;
}
