"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCallRoutes = createCallRoutes;
const express_1 = require("express");
const auth_1 = require("../../../shared/middleware/auth");
/**
 * Create call routes
 *
 * All routes require authentication except webhooks
 */
function createCallRoutes(callController) {
    const router = (0, express_1.Router)();
    // ============================================
    // Call Management Routes (Authenticated)
    // ============================================
    /**
     * POST /api/calls/initiate
     * Initiate an outbound call
     *
     * Body: { toNumber: string, contactId?: number, dealId?: number, leadId?: number, notes?: string }
     * Response: { call: Call, token: string }
     */
    router.post('/initiate', auth_1.authMiddleware, callController.initiateCall);
    /**
     * POST /api/calls/token
     * Generate Twilio client token for browser calling
     *
     * Response: { token: string, identity: string, expiresAt: string }
     */
    router.post('/token', auth_1.authMiddleware, callController.generateToken);
    /**
     * GET /api/calls
     * List calls with pagination and filters
     *
     * Query: { direction?, status?, contactId?, dealId?, startDate?, endDate?, search?, page?, limit? }
     * Response: { calls: CallWithDetails[], count: number, total: number, page: number, limit: number }
     */
    router.get('/', auth_1.authMiddleware, callController.listCalls);
    /**
     * GET /api/calls/stats
     * Get call statistics for the current user
     *
     * Query: { startDate?, endDate? }
     * Response: { totalCalls, inboundCalls, outboundCalls, completedCalls, missedCalls, totalDuration, averageDuration }
     */
    router.get('/stats', auth_1.authMiddleware, callController.getStats);
    /**
     * GET /api/calls/contact/:contactId
     * Get calls for a specific contact
     *
     * Params: { contactId: number }
     * Query: { limit?: number }
     * Response: { calls: CallWithDetails[] }
     */
    router.get('/contact/:contactId', auth_1.authMiddleware, callController.getCallsForContact);
    /**
     * GET /api/calls/deal/:dealId
     * Get calls for a specific deal
     *
     * Params: { dealId: number }
     * Response: { calls: CallWithDetails[] }
     */
    router.get('/deal/:dealId', auth_1.authMiddleware, callController.getCallsForDeal);
    /**
     * GET /api/calls/:id
     * Get a single call by ID with all details
     *
     * Params: { id: number }
     * Response: CallWithDetails (including events)
     */
    router.get('/:id', auth_1.authMiddleware, callController.getCall);
    /**
     * GET /api/calls/:id/recording
     * Get recording for a specific call
     *
     * Params: { id: number }
     * Response: CallRecording
     */
    router.get('/:id/recording', auth_1.authMiddleware, callController.getRecording);
    /**
     * PATCH /api/calls/:id
     * Update call notes and disposition
     *
     * Params: { id: number }
     * Body: { notes?: string, disposition?: string, summary?: string }
     * Response: Call
     */
    router.patch('/:id', auth_1.authMiddleware, callController.updateCall);
    /**
     * POST /api/calls/end/:id
     * End an active call
     *
     * Params: { id: number }
     * Response: Call
     */
    router.post('/end/:id', auth_1.authMiddleware, callController.endCall);
    /**
     * DELETE /api/calls/:id
     * Soft delete a call
     *
     * Params: { id: number }
     * Response: 204 No Content
     */
    router.delete('/:id', auth_1.authMiddleware, callController.deleteCall);
    return router;
}
//# sourceMappingURL=callRoutes.js.map