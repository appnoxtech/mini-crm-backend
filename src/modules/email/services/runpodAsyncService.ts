import { prisma } from '../../../shared/prisma';
import { Prisma } from '@prisma/client';

/**
 * RunPod Async Summarization Service using Prisma
 */

const getRunPodConfig = () => ({
    RUNPOD_ENDPOINT_ID: process.env.RUNPOD_ENDPOINT_ID || '2ul7r04332koqo',
    RUNPOD_API_KEY: process.env.RUNPOD_API_KEY || '',
    RUNPOD_BASE_URL: `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID || '2ul7r04332koqo'}`
});

const POLL_INTERVAL_MS = parseInt(process.env.RUNPOD_POLL_INTERVAL || '5000');
const MAX_POLL_ATTEMPTS = parseInt(process.env.RUNPOD_MAX_POLL_ATTEMPTS || '60');

interface SummaryData {
    summary: string;
    keyPoints: string[];
    actionItems: string[];
    sentiment: 'positive' | 'negative' | 'neutral';
}

interface RunPodJob {
    id: string;
    status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    output?: any;
    error?: string;
}

export class RunPodAsyncService {
    constructor(_dbPath?: string) { }

    async submitForSummarization(threadId: string, companyId: number): Promise<{ jobId: string; status: string }> {
        const config = getRunPodConfig();

        const emails = await prisma.email.findMany({
            where: { threadId, companyId },
            orderBy: { sentAt: 'asc' }
        });

        if (emails.length === 0) {
            throw new Error(`No emails found for thread ${threadId}`);
        }

        const emailContent = this.formatEmailsForSummarization(emails);

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
            throw new Error(`RunPod API error: ${response.status} ${errorText}`);
        }

        const data = await response.json() as any;
        const jobId = data.id;

        await this.updateJobStatus(threadId, companyId, jobId, 'IN_QUEUE');

        return { jobId, status: 'IN_QUEUE' };
    }

    async checkJobStatus(jobId: string): Promise<RunPodJob> {
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

        return await response.json() as RunPodJob;
    }

    async summarizeAndWait(threadId: string, companyId: number): Promise<SummaryData> {
        const { jobId } = await this.submitForSummarization(threadId, companyId);

        for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

            const status = await this.checkJobStatus(jobId);

            if (status.status === 'COMPLETED') {
                const result = this.parseRunPodOutput(status.output);
                await this.saveCompletedSummary(threadId, jobId, result);
                return result;
            }

            if (status.status === 'FAILED' || status.status === 'CANCELLED') {
                // Note: We don't have companyId here easily if called this way, 
                // but this method (summarizeAndWait) seems unused in updated controller.
                // For safety, we can query it or just fail.
                // Assuming this is used in context where record exists, so upsert in updateJobStatus might strictly not need it for update
                // BUT updateJobStatus signature changes. 
                // Let's look up companyId from DB first.
                const existing = await prisma.threadSummary.findUnique({ where: { threadId } });
                if (existing) {
                    await this.updateJobStatus(threadId, existing.companyId, jobId, status.status, status.error);
                }
                throw new Error(`Job failed: ${status.error || 'Unknown error'}`);
            }
        }

        throw new Error(`Job ${jobId} timed out`);
    }

    async submitPendingThreads(limit: number = 10): Promise<{ submitted: number; jobIds: string[] }> {
        const threadsNeedingSummary = (await prisma.$queryRaw`
            SELECT DISTINCT e."threadId", e."companyId"
            FROM emails e
            LEFT JOIN thread_summaries ts ON e."threadId" = ts."threadId"
            WHERE e."threadId" IS NOT NULL
            AND (ts."status" IS NULL OR ts."status" = 'failed' OR ts."lastSummarizedAt" < NOW() - INTERVAL '7 days')
            LIMIT ${limit}
        `) as { threadId: string; companyId: number }[];

        if (threadsNeedingSummary.length === 0) {
            return { submitted: 0, jobIds: [] };
        }

        const jobIds: string[] = [];
        let submitted = 0;

        for (const thread of threadsNeedingSummary) {
            try {
                const { jobId } = await this.submitForSummarization(thread.threadId, thread.companyId);
                jobIds.push(jobId);
                submitted++;
            } catch (error) {
                console.error(`Failed to submit thread ${thread.threadId}:`, error);
            }
        }

        return { submitted, jobIds };
    }

    async processPendingJobs(): Promise<{ completed: number; failed: number; pending: number }> {
        const pendingJobs = await prisma.threadSummary.findMany({
            where: {
                status: {
                    in: ['IN_QUEUE', 'IN_PROGRESS']
                },
                runpodJobId: { not: null }
            }
        });

        let completed = 0;
        let failed = 0;
        let pending = 0;

        for (const job of pendingJobs) {
            try {
                const status = await this.checkJobStatus(job.runpodJobId!);

                if (status.status === 'COMPLETED') {
                    const result = this.parseRunPodOutput(status.output);
                    await this.saveCompletedSummary(job.threadId, job.runpodJobId!, result);
                    completed++;
                } else if (status.status === 'FAILED' || status.status === 'CANCELLED') {
                    await this.updateJobStatus(job.threadId, job.companyId, job.runpodJobId!, status.status, status.error);
                    failed++;
                } else {
                    pending++;
                }
            } catch (error: any) {
                console.error(`Error checking job ${job.runpodJobId}:`, error.message);
            }
        }

        return { completed, failed, pending };
    }

    /**
     * Get thread summary from DB
     */
    async getThreadSummary(threadId: string, companyId: number): Promise<any | null> {
        const row = await prisma.threadSummary.findFirst({
            where: { threadId, companyId }
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

    private async updateJobStatus(threadId: string, companyId: number, jobId: string, status: string, error?: string): Promise<void> {
        await prisma.threadSummary.upsert({
            where: { threadId },
            update: {
                runpodJobId: jobId,
                status: status,
                summary: error || '',
                lastSummarizedAt: new Date(),
                submittedAt: new Date()
            },
            create: {
                threadId,
                companyId,
                runpodJobId: jobId,
                status: status,
                summary: error || '',
                lastSummarizedAt: new Date(),
                submittedAt: new Date()
            }
        });
    }

    private async saveCompletedSummary(threadId: string, jobId: string, data: SummaryData): Promise<void> {
        const emails = await prisma.email.findMany({
            where: { threadId },
            orderBy: { sentAt: 'asc' }
        });
        const participants = this.extractParticipants(emails);

        await prisma.threadSummary.update({
            where: { threadId },
            data: {
                summary: data.summary,
                keyPoints: (data.keyPoints as any) || null,
                actionItems: (data.actionItems as any) || null,
                sentiment: data.sentiment,
                participants: (participants as any) || null,
                status: 'completed',
                completedAt: new Date(),
                modelVersion: 'runpod-async-v1',
                lastSummarizedAt: new Date()
            }
        });
    }

    private formatEmailsForSummarization(emails: any[]): string {
        return emails.map((email, idx) => `=== Email ${idx + 1} ===\nFrom: ${email.from}\nSubject: ${email.subject}\n\n${email.body.substring(0, 2000)}`).join('\n\n---\n');
    }

    private extractParticipants(emails: any[]): string[] {
        const participants = new Set<string>();
        for (const email of emails) {
            participants.add(email.from);
            if (email.to && Array.isArray(email.to)) {
                email.to.forEach((addr: string) => participants.add(addr));
            }
        }
        return Array.from(participants);
    }

    private parseRunPodOutput(output: any): SummaryData {
        if (!output) return { summary: '', keyPoints: [], actionItems: [], sentiment: 'neutral' };
        if (output.summary) return {
            summary: output.summary,
            keyPoints: output.keyPoints || [],
            actionItems: output.actionItems || [],
            sentiment: output.sentiment || 'neutral'
        };
        const text = typeof output === 'string' ? output : JSON.stringify(output);
        return { summary: text.substring(0, 1000), keyPoints: [], actionItems: [], sentiment: 'neutral' };
    }
}

let instance: RunPodAsyncService | null = null;
export function getRunPodAsyncService(): RunPodAsyncService {
    if (!instance) instance = new RunPodAsyncService();
    return instance;
}
