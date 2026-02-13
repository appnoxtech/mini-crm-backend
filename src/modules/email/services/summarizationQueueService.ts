import Queue, { Job, JobOptions } from 'bull';
import { prisma } from '../../../shared/prisma';
import { Prisma } from '@prisma/client';

const RUNPOD_API_URL = process.env.RUNPOD_API_URL || 'https://api.runpod.ai/v2/2ul7r04332koqo/run';
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || '';
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

export class SummarizationQueueService {
    private queue: Queue.Queue<SummarizationJobData> | null = null;
    private redisAvailable: boolean = false;

    constructor(_dbPath?: string) {
        try {
            this.queue = new Queue<SummarizationJobData>('email-summarization', REDIS_URL, {
                defaultJobOptions: {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 5000 },
                    removeOnComplete: 100,
                    removeOnFail: false,
                    timeout: 300000
                }
            });

            this.setupQueueProcessor();
            this.setupEventListeners();
            this.redisAvailable = true;
            console.log('✅ Redis queue initialized successfully');
        } catch (error: any) {
            console.warn('⚠️ Redis not available - email summarization queue disabled:', error.message);
            this.redisAvailable = false;
        }
    }

    private setupQueueProcessor(): void {
        if (!this.queue) {
            console.warn('Queue is not initialized, cannot set up processor.');
            return;
        }
        this.queue.process(MAX_CONCURRENT_JOBS, async (job: Job<SummarizationJobData>) => {
            const { threadId } = job.data;
            const startTime = Date.now();

            try {
                const existingSummary = await prisma.threadSummary.findUnique({ where: { threadId } });
                if (existingSummary && existingSummary.status === 'completed') {
                    const hoursSinceSummary = (Date.now() - existingSummary.lastSummarizedAt.getTime()) / (1000 * 60 * 60);
                    if (hoursSinceSummary < 24) return { skipped: true, reason: 'recently_summarized' };
                }

                const emails = await prisma.email.findMany({
                    where: { threadId },
                    orderBy: { sentAt: 'asc' }
                });

                if (emails.length === 0) throw new Error(`No emails found for thread ${threadId}`);

                const emailContent = this.formatEmailsForSummarization(emails);
                await this.updateSummaryStatus(threadId, 'processing', job.id?.toString());

                const summaryData = await this.callRunPodSummarization(emailContent, emails);
                const participants = this.extractParticipants(emails);

                console.log(`✅ [Queue] Successfully summarized thread ${threadId}`);
                console.log(`Summary preview: ${summaryData.summary.substring(0, 100)}...`);

                await this.saveEnhancedSummary(threadId, {
                    ...summaryData,
                    participants,
                    processingTime: Date.now() - startTime,
                    modelVersion: 'runpod-v1',
                    status: 'completed',
                    runpodJobId: job.id?.toString()
                });

                return { success: true, threadId, processingTime: Date.now() - startTime };
            } catch (error: any) {
                console.error(`❌ [Queue] Failed thread ${threadId}:`, error.message);
                console.error(`❌ [Queue] Error stack:`, error.stack);
                await this.updateSummaryStatus(threadId, 'failed', job.id?.toString());
                throw error;
            }
        });
    }

    private setupEventListeners(): void {
        if (!this.queue) return;
        this.queue.on('failed', (job, err) => console.error(`❌ [Queue] Job ${job?.id} failed:`, err.message));
        this.queue.on('error', (error) => console.error('❌ [Queue] Queue error:', error));
    }

    async addToQueue(data: SummarizationJobData, options?: JobOptions): Promise<Job<SummarizationJobData>> {
        if (!this.queue) {
            throw new Error('Redis queue is not available');
        }
        const jobOptions: JobOptions = { jobId: `thread-${data.threadId}`, removeOnComplete: true, ...options };
        await this.updateSummaryStatus(data.threadId, 'queued');
        return await this.queue.add(data, jobOptions);
    }

    async getQueueStats() {
        if (!this.queue) {
            return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
        }
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
     * Get thread summary from DB
     */
    async getThreadSummary(threadId: string): Promise<any | null> {
        const row = await prisma.threadSummary.findUnique({
            where: { threadId }
        });
        if (!row) return null;

        return {
            threadId: row.threadId,
            summary: row.summary,
            keyPoints: row.keyPoints || [],
            actionItems: row.actionItems || [],
            sentiment: row.sentiment,
            participants: row.participants || [],
            processingTime: row.processingTime,
            modelVersion: row.modelVersion,
            status: row.status,
            runpodJobId: row.runpodJobId,
            submittedAt: row.submittedAt,
            completedAt: row.completedAt,
            lastSummarizedAt: row.lastSummarizedAt
        };
    }

    /**
     * Get threads that need summarization
     */
    async getThreadsNeedingSummary(limit: number = 50): Promise<string[]> {
        // Use raw SQL to find threads without summaries since the relation was removed
        const threads = await prisma.$queryRaw<{ threadId: string }[]>`
            SELECT DISTINCT e."threadId"
            FROM emails e
            WHERE e."threadId" IS NOT NULL
              AND e."threadId" NOT IN (SELECT ts."thread_id" FROM thread_summaries ts)
            LIMIT ${limit}
        `;

        return threads.map((t: any) => t.threadId);
    }

    /**
     * Get database stats
     */
    async getDatabaseStats(): Promise<{ status: string; count: number }[]> {
        const stats = await prisma.threadSummary.groupBy({
            by: ['status'],
            _count: { _all: true }
        });

        return stats.map((s: any) => ({
            status: s.status,
            count: s._count._all
        }));
    }

    /**
     * Get job status from Bull queue
     */
    async getJobStatus(jobId: string) {
        if (!this.queue) return null;
        const job = await this.queue.getJob(jobId);
        if (!job) return null;

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

    private async updateSummaryStatus(threadId: string, status: string, jobId?: string): Promise<void> {
        await prisma.threadSummary.upsert({
            where: { threadId },
            update: { status, runpodJobId: jobId, lastSummarizedAt: new Date() },
            create: { threadId, summary: '', status, runpodJobId: jobId, lastSummarizedAt: new Date() }
        });
    }

    private async saveEnhancedSummary(threadId: string, data: any): Promise<void> {
        await prisma.threadSummary.upsert({
            where: { threadId },
            update: {
                summary: data.summary,
                keyPoints: (data.keyPoints as any) || null,
                actionItems: (data.actionItems as any) || null,
                sentiment: data.sentiment,
                participants: (data.participants as any) || null,
                processingTime: data.processingTime,
                modelVersion: data.modelVersion,
                status: data.status,
                runpodJobId: data.runpodJobId,
                lastSummarizedAt: new Date(),
                completedAt: new Date()
            },
            create: {
                threadId,
                summary: data.summary,
                keyPoints: (data.keyPoints as any) || null,
                actionItems: (data.actionItems as any) || null,
                sentiment: data.sentiment,
                participants: (data.participants as any) || null,
                processingTime: data.processingTime,
                modelVersion: data.modelVersion,
                status: data.status,
                runpodJobId: data.runpodJobId,
                lastSummarizedAt: new Date(),
                completedAt: new Date()
            }
        });
    }

    private formatEmailsForSummarization(emails: any[]): string {
        return emails.map((e, i) => `=== Email ${i + 1} ===\nFrom: ${e.from}\nSubject: ${e.subject}\n\n${e.body.substring(0, 2000)}`).join('\n\n---\n');
    }

    private extractParticipants(emails: any[]): string[] {
        const p = new Set<string>();
        emails.forEach(e => {
            p.add(e.from);
            if (Array.isArray(e.to)) e.to.forEach((a: string) => p.add(a));
        });
        return Array.from(p);
    }

    private async callRunPodSummarization(emailContent: string, emails: any[]): Promise<SummaryData> {
        console.log('Email content:>>>>>>>>>>>>>>>> ', emailContent);
        console.log('Emails: ', emails);

        try {
            const res = await fetch(RUNPOD_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RUNPOD_API_KEY}` },
                body: JSON.stringify({ input: { email_content: emailContent } })
            });
            console.log('res>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> ', res);

            if (!res.ok) {
                const errorText = await res.text();
                console.error(`❌ RunPod API error! Status: ${res.status}, Response: ${errorText}`);
                throw new Error(`HTTP error! status: ${res.status}, response: ${errorText}`);
            }
            
            const data = await res.json() as any;
            console.log('RunPod API response data:', JSON.stringify(data, null, 2));
            
            const output = data.output;
            if (!output) {
                console.error('❌ No output field in RunPod response:', data);
                throw new Error('No output from RunPod');
            }
            
            console.log('✅ Successfully received summary from RunPod:', output.summary?.substring(0, 100));
            
            return {
                summary: output.summary || '',
                keyPoints: output.keyPoints || [],
                actionItems: output.actionItems || [],
                sentiment: output.sentiment || 'neutral'
            };
        } catch (error: any) {
            console.error('❌ RunPod summarization failed:', error.message);
            console.error('❌ Falling back to subject line as summary');
            throw error;
        }
    }

    async close() {
        if (this.queue) {
            await this.queue.close();
        }
    }
}

let instance: SummarizationQueueService | null = null;
export function getSummarizationQueueService(): SummarizationQueueService {
    if (!instance) instance = new SummarizationQueueService();
    return instance;
}
