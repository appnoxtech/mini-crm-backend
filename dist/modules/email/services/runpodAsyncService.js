"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunPodAsyncService = void 0;
exports.getRunPodAsyncService = getRunPodAsyncService;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
/**
 * RunPod Async Summarization Service
 *
 * This service uses RunPod's built-in async job queue instead of Redis/BullMQ.
 * Cost-efficient for serverless workloads - no external queue needed!
 *
 * Flow:
 * 1. Submit job to RunPod /run endpoint -> get job ID
 * 2. Store job ID in database
 * 3. Poll /status endpoint or use cron to check completed jobs
 * 4. Update database when job completes
 */
// RunPod API configuration
// Load these lazily to ensure dotenv has been initialized
const getRunPodConfig = () => ({
    RUNPOD_ENDPOINT_ID: process.env.RUNPOD_ENDPOINT_ID || '2ul7r04332koqo',
    RUNPOD_API_KEY: process.env.RUNPOD_API_KEY || '',
    RUNPOD_BASE_URL: `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID || '2ul7r04332koqo'}`
});
// Polling configuration
const POLL_INTERVAL_MS = parseInt(process.env.RUNPOD_POLL_INTERVAL || '5000'); // 5 seconds
const MAX_POLL_ATTEMPTS = parseInt(process.env.RUNPOD_MAX_POLL_ATTEMPTS || '60'); // 5 minutes max
class RunPodAsyncService {
    db;
    constructor(dbPath = './data.db') {
        this.db = new better_sqlite3_1.default(dbPath);
    }
    /**
     * Initialize database schema
     */
    initializeSchema() {
        // Add runpod_job_id column if not exists
        const alterTableQueries = [
            "ALTER TABLE thread_summaries ADD COLUMN runpodJobId TEXT",
            "ALTER TABLE thread_summaries ADD COLUMN keyPoints TEXT",
            "ALTER TABLE thread_summaries ADD COLUMN actionItems TEXT",
            "ALTER TABLE thread_summaries ADD COLUMN sentiment TEXT",
            "ALTER TABLE thread_summaries ADD COLUMN participants TEXT",
            "ALTER TABLE thread_summaries ADD COLUMN processingTime INTEGER",
            "ALTER TABLE thread_summaries ADD COLUMN modelVersion TEXT",
            "ALTER TABLE thread_summaries ADD COLUMN status TEXT DEFAULT 'pending'",
            "ALTER TABLE thread_summaries ADD COLUMN submittedAt TEXT",
            "ALTER TABLE thread_summaries ADD COLUMN completedAt TEXT"
        ];
        for (const query of alterTableQueries) {
            try {
                this.db.exec(query);
                console.log(`✅ Schema update: ${query.substring(0, 50)}...`);
            }
            catch (error) {
                // Column already exists, ignore
            }
        }
        // Create indexes
        try {
            this.db.exec("CREATE INDEX IF NOT EXISTS idx_thread_summaries_runpodJobId ON thread_summaries(runpodJobId)");
            this.db.exec("CREATE INDEX IF NOT EXISTS idx_thread_summaries_status ON thread_summaries(status)");
        }
        catch (error) {
            // Index might already exist
        }
        console.log('📊 RunPod async service schema initialized');
    }
    /**
     * Submit a thread for async summarization
     * Returns immediately with a job ID
     */
    async submitForSummarization(threadId) {
        const config = getRunPodConfig();
        console.log(`📤 Submitting thread ${threadId} for summarization...`);
        console.log(`🔑 API Key loaded: ${config.RUNPOD_API_KEY ? 'Yes (length: ' + config.RUNPOD_API_KEY.length + ')' : 'No - MISSING!'}`);
        console.log(`🌐 Endpoint: ${config.RUNPOD_BASE_URL}/run`);
        // Get emails for this thread
        const emails = this.getEmailsByThreadId(threadId);
        if (emails.length === 0) {
            throw new Error(`No emails found for thread ${threadId}`);
        }
        // Format email content
        const emailContent = this.formatEmailsForSummarization(emails);
        // Submit to RunPod async endpoint (/run instead of /runsync)
        const response = await fetch(`${config.RUNPOD_BASE_URL}/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.RUNPOD_API_KEY}`
            },
            body: JSON.stringify({
                input: {
                    email_content: emailContent
                }
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ RunPod API Error: ${response.status} ${response.statusText}`);
            console.error(`❌ Response body: ${errorText}`);
            if (response.status === 401) {
                throw new Error(`RunPod API Unauthorized (401). Check your RUNPOD_API_KEY and ensure RUNPOD_ENDPOINT_ID (${config.RUNPOD_ENDPOINT_ID}) is correct.`);
            }
            throw new Error(`RunPod API error: ${response.status}`);
        }
        const data = await response.json();
        const jobId = data.id;
        console.log(`📥 Job submitted: ${jobId}`);
        // Store job info in database
        this.updateJobStatus(threadId, jobId, 'IN_QUEUE');
        return {
            jobId,
            status: 'IN_QUEUE'
        };
    }
    /**
     * Check the status of a RunPod job
     */
    async checkJobStatus(jobId) {
        const config = getRunPodConfig();
        const response = await fetch(`${config.RUNPOD_BASE_URL}/status/${jobId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${config.RUNPOD_API_KEY}`
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to check job status: ${response.status}`);
        }
        return response.json();
    }
    /**
     * Submit and wait for result (with polling)
     * Use this for real-time requests
     */
    async summarizeAndWait(threadId) {
        const { jobId } = await this.submitForSummarization(threadId);
        console.log(`⏳ Waiting for job ${jobId} to complete...`);
        // Poll for completion
        for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
            await this.sleep(POLL_INTERVAL_MS);
            const status = await this.checkJobStatus(jobId);
            console.log(`📊 Job ${jobId} status: ${status.status}`);
            if (status.status === 'COMPLETED') {
                const result = this.parseRunPodOutput(status.output);
                await this.saveCompletedSummary(threadId, jobId, result);
                return result;
            }
            if (status.status === 'FAILED' || status.status === 'CANCELLED') {
                this.updateJobStatus(threadId, jobId, status.status, status.error);
                throw new Error(`Job failed: ${status.error || 'Unknown error'}`);
            }
        }
        throw new Error(`Job ${jobId} timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000} seconds`);
    }
    /**
     * Check all pending jobs and update their status
     * Call this from a cron job for batch processing
     */
    async processPendingJobs() {
        console.log('🔄 Processing pending RunPod jobs...');
        const pendingJobs = this.getPendingJobs();
        let completed = 0;
        let failed = 0;
        let pending = 0;
        for (const job of pendingJobs) {
            try {
                const status = await this.checkJobStatus(job.runpodJobId);
                if (status.status === 'COMPLETED') {
                    const result = this.parseRunPodOutput(status.output);
                    await this.saveCompletedSummary(job.threadId, job.runpodJobId, result);
                    completed++;
                    console.log(`✅ Job ${job.runpodJobId} completed`);
                }
                else if (status.status === 'FAILED' || status.status === 'CANCELLED') {
                    this.updateJobStatus(job.threadId, job.runpodJobId, status.status, status.error);
                    failed++;
                    console.log(`❌ Job ${job.runpodJobId} failed: ${status.error}`);
                }
                else {
                    pending++;
                }
            }
            catch (error) {
                console.error(`Error checking job ${job.runpodJobId}:`, error.message);
            }
        }
        console.log(`📊 Processed: ${completed} completed, ${failed} failed, ${pending} still pending`);
        return { completed, failed, pending };
    }
    /**
     * Get threads that need summarization and submit them
     */
    async submitPendingThreads(limit = 10) {
        const threads = this.getThreadsNeedingSummary(limit);
        const jobIds = [];
        console.log(`📤 Submitting ${threads.length} threads for summarization...`);
        for (const threadId of threads) {
            try {
                const { jobId } = await this.submitForSummarization(threadId);
                jobIds.push(jobId);
            }
            catch (error) {
                console.error(`Failed to submit thread ${threadId}:`, error.message);
            }
        }
        return { submitted: jobIds.length, jobIds };
    }
    // ==================== Database Methods ====================
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
    getThreadsNeedingSummary(limit = 50) {
        const stmt = this.db.prepare(`
            SELECT DISTINCT threadId 
            FROM emails 
            WHERE threadId IS NOT NULL 
                AND threadId NOT IN (
                    SELECT threadId FROM thread_summaries 
                    WHERE status IN ('completed', 'IN_QUEUE', 'IN_PROGRESS')
                )
            LIMIT ?
        `);
        const rows = stmt.all(limit);
        return rows.map(r => r.threadId);
    }
    getPendingJobs() {
        const stmt = this.db.prepare(`
            SELECT threadId, runpodJobId 
            FROM thread_summaries 
            WHERE status IN ('IN_QUEUE', 'IN_PROGRESS') 
                AND runpodJobId IS NOT NULL
        `);
        return stmt.all();
    }
    updateJobStatus(threadId, jobId, status, error) {
        const stmt = this.db.prepare(`
            INSERT INTO thread_summaries (threadId, runpodJobId, status, summary, lastSummarizedAt, submittedAt)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(threadId) DO UPDATE SET
                runpodJobId = excluded.runpodJobId,
                status = excluded.status,
                lastSummarizedAt = excluded.lastSummarizedAt
        `);
        stmt.run(threadId, jobId, status, error || '', new Date().toISOString(), new Date().toISOString());
    }
    async saveCompletedSummary(threadId, jobId, data) {
        const emails = this.getEmailsByThreadId(threadId);
        const participants = this.extractParticipants(emails);
        const stmt = this.db.prepare(`
            UPDATE thread_summaries SET
                summary = ?,
                keyPoints = ?,
                actionItems = ?,
                sentiment = ?,
                participants = ?,
                status = 'completed',
                completedAt = ?,
                modelVersion = 'runpod-async-v1',
                lastSummarizedAt = ?
            WHERE threadId = ?
        `);
        stmt.run(data.summary, JSON.stringify(data.keyPoints), JSON.stringify(data.actionItems), data.sentiment, JSON.stringify(participants), new Date().toISOString(), new Date().toISOString(), threadId);
    }
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
            status: row.status,
            runpodJobId: row.runpodJobId,
            submittedAt: row.submittedAt,
            completedAt: row.completedAt,
            lastSummarizedAt: row.lastSummarizedAt
        };
    }
    // ==================== Helper Methods ====================
    formatEmailsForSummarization(emails) {
        return emails.map((email, idx) => {
            const body = email.body || '';
            return `
=== Email ${idx + 1} ===
From: ${email.from}
Date: ${email.sentAt.toISOString()}
Subject: ${email.subject}

${body.substring(0, 2000)}`;
        }).join('\n\n---\n');
    }
    extractParticipants(emails) {
        const participants = new Set();
        for (const email of emails) {
            if (email.from) {
                const fromMatch = email.from.match(/<(.+?)>/);
                const fromEmail = fromMatch && fromMatch[1] ? fromMatch[1] : email.from;
                participants.add(fromEmail);
            }
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
    parseRunPodOutput(output) {
        if (!output) {
            return {
                summary: 'No summary available',
                keyPoints: [],
                actionItems: [],
                sentiment: 'neutral'
            };
        }
        // If output has structured data
        if (output.keyPoints || output.actionItems || output.sentiment) {
            return {
                summary: output.summary || '',
                keyPoints: output.keyPoints || [],
                actionItems: output.actionItems || [],
                sentiment: output.sentiment || 'neutral'
            };
        }
        // If output only has summary
        if (output.summary) {
            const summaryText = output.summary;
            return {
                summary: summaryText,
                keyPoints: this.extractKeyPoints(summaryText),
                actionItems: this.extractActionItems(summaryText),
                sentiment: this.extractSentiment(summaryText)
            };
        }
        // Fallback
        const text = typeof output === 'string' ? output : JSON.stringify(output);
        return {
            summary: text.substring(0, 500),
            keyPoints: [],
            actionItems: [],
            sentiment: 'neutral'
        };
    }
    extractKeyPoints(text) {
        const lines = text.split('\n');
        return lines
            .filter(line => line.trim().match(/^[-•*]\s+/) || line.includes('Key point'))
            .map(line => line.replace(/^[-•*]\s+/, '').trim())
            .filter(line => line.length > 0)
            .slice(0, 5);
    }
    extractActionItems(text) {
        const lines = text.split('\n');
        return lines
            .filter(line => line.toLowerCase().includes('action') ||
            line.toLowerCase().includes('todo') ||
            line.toLowerCase().includes('next step'))
            .map(line => line.replace(/^[-•*]\s+/, '').trim())
            .filter(line => line.length > 0)
            .slice(0, 5);
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
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.RunPodAsyncService = RunPodAsyncService;
// Singleton instance
let instance = null;
function getRunPodAsyncService(dbPath) {
    if (!instance) {
        instance = new RunPodAsyncService(dbPath);
    }
    return instance;
}
//# sourceMappingURL=runpodAsyncService.js.map