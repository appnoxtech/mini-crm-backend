"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebhookRoutes = createWebhookRoutes;
const express_1 = require("express");
const express_2 = __importDefault(require("express"));
/**
 * Create webhook routes
 *
 * IMPORTANT: These routes should NOT require authentication
 * They are called by Twilio servers, which can't authenticate with our system.
 * Security is handled via Twilio signature validation.
 */
function createWebhookRoutes(webhookController) {
    const router = (0, express_1.Router)();
    // Twilio sends webhook data as form-urlencoded
    router.use(express_2.default.urlencoded({ extended: true }));
    /**
     * POST /api/webhooks/twilio/voice
     * Main TwiML endpoint for call handling
     *
     * This is called by Twilio when:
     * - An outbound call is initiated (to get TwiML for connecting)
     * - An inbound call is received (to get TwiML for routing)
     *
     * Returns: TwiML XML
     */
    router.post('/voice', webhookController.handleVoiceWebhook);
    /**
     * POST /api/webhooks/twilio/status
     * Call status callback
     *
     * This is called by Twilio when call status changes:
     * - initiated → ringing → in-progress → completed
     * - or other terminal states: busy, no-answer, failed, canceled
     *
     * Returns: 200 OK
     */
    router.post('/status', webhookController.handleStatusWebhook);
    /**
     * POST /api/webhooks/twilio/recording
     * Recording status callback
     *
     * This is called by Twilio when:
     * - Recording starts (status: in-progress)
     * - Recording is complete (status: completed)
     * - Recording fails (status: failed)
     *
     * Returns: 200 OK
     */
    router.post('/recording', webhookController.handleRecordingWebhook);
    /**
     * POST /api/webhooks/twilio/transcription
     * Transcription status callback
     *
     * This is called by Twilio when transcription of a recording is complete.
     * Note: Twilio transcription is a paid feature.
     *
     * Returns: 200 OK
     */
    router.post('/transcription', webhookController.handleTranscriptionWebhook);
    /**
     * POST /api/webhooks/twilio/fallback
     * Fallback URL when primary TwiML fails
     *
     * Returns: TwiML XML with error message and hangup
     */
    router.post('/fallback', webhookController.handleFallback);
    return router;
}
//# sourceMappingURL=webhookRoutes.js.map