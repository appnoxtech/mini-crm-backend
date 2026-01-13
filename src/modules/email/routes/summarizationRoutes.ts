import { Router } from 'express';
import { SummarizationController } from '../controllers/summarizationController';
import { authMiddleware } from '../../../shared/middleware/auth';

export function createSummarizationRoutes(summarizationController: SummarizationController): Router {
    const router = Router();

    // All routes require authentication
    router.use(authMiddleware);

    // ========== THREAD SUMMARIZATION ROUTES ==========

    /**
     * Queue a thread for async summarization (uses BullMQ)
     * POST /api/summarization/threads/:threadId/queue
     */
    router.post('/threads/:threadId/queue', (req: any, res) =>
        summarizationController.queueThreadSummarization(req, res)
    );

    /**
     * Synchronously summarize a thread (immediate result)
     * POST /api/summarization/threads/:threadId/sync
     */
    router.post('/threads/:threadId/sync', (req: any, res) =>
        summarizationController.summarizeThreadSync(req, res)
    );

    /**
     * Get enhanced thread summary with key points, action items, sentiment
     * GET /api/summarization/threads/:threadId
     */
    router.get('/threads/:threadId', (req: any, res) =>
        summarizationController.getEnhancedThreadSummary(req, res)
    );

    // ========== BULK OPERATIONS ==========

    /**
     * Bulk summarize all pending threads for a user
     * POST /api/summarization/bulk
     * Body: { limit?: number }
     */
    router.post('/bulk', (req: any, res) =>
        summarizationController.bulkSummarize(req, res)
    );

    /**
     * Get threads pending summarization
     * GET /api/summarization/pending
     */
    router.get('/pending', (req: any, res) =>
        summarizationController.getPendingThreads(req, res)
    );

    // ========== JOB MANAGEMENT ==========

    /**
     * Get job status by job ID
     * GET /api/summarization/jobs/:jobId
     */
    router.get('/jobs/:jobId', (req: any, res) =>
        summarizationController.getJobStatus(req, res)
    );

    // ========== STATISTICS & MONITORING ==========

    /**
     * Get queue and database statistics
     * GET /api/summarization/stats
     */
    router.get('/stats', (req: any, res) =>
        summarizationController.getSummarizationStats(req, res)
    );

    /**
     * Manually trigger the scheduler
     * POST /api/summarization/trigger
     */
    router.post('/trigger', (req: any, res) =>
        summarizationController.triggerScheduler(req, res)
    );

    return router;
}
