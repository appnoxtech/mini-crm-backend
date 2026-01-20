"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSummarizationRoutes = createSummarizationRoutes;
const express_1 = require("express");
const auth_1 = require("../../../shared/middleware/auth");
function createSummarizationRoutes(summarizationController) {
    const router = (0, express_1.Router)();
    // All routes require authentication
    router.use(auth_1.authMiddleware);
    // ========== THREAD SUMMARIZATION ROUTES ==========
    /**
     * Queue a thread for async summarization (uses BullMQ)
     * POST /api/summarization/threads/:threadId/queue
     */
    router.post('/threads/:threadId/queue', (req, res) => summarizationController.queueThreadSummarization(req, res));
    /**
     * Synchronously summarize a thread (immediate result)
     * POST /api/summarization/threads/:threadId/sync
     */
    router.post('/threads/:threadId/sync', (req, res) => summarizationController.summarizeThreadSync(req, res));
    /**
     * Get enhanced thread summary with key points, action items, sentiment
     * GET /api/summarization/threads/:threadId
     */
    router.get('/threads/:threadId', (req, res) => summarizationController.getEnhancedThreadSummary(req, res));
    // ========== BULK OPERATIONS ==========
    /**
     * Bulk summarize all pending threads for a user
     * POST /api/summarization/bulk
     * Body: { limit?: number }
     */
    router.post('/bulk', (req, res) => summarizationController.bulkSummarize(req, res));
    /**
     * Get threads pending summarization
     * GET /api/summarization/pending
     */
    router.get('/pending', (req, res) => summarizationController.getPendingThreads(req, res));
    // ========== JOB MANAGEMENT ==========
    /**
     * Get job status by job ID
     * GET /api/summarization/jobs/:jobId
     */
    router.get('/jobs/:jobId', (req, res) => summarizationController.getJobStatus(req, res));
    // ========== STATISTICS & MONITORING ==========
    /**
     * Get queue and database statistics
     * GET /api/summarization/stats
     */
    router.get('/stats', (req, res) => summarizationController.getSummarizationStats(req, res));
    /**
     * Manually trigger the scheduler
     * POST /api/summarization/trigger
     */
    router.post('/trigger', (req, res) => summarizationController.triggerScheduler(req, res));
    return router;
}
//# sourceMappingURL=summarizationRoutes.js.map