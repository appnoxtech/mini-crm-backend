import { Request, Response } from 'express';
import { CallService } from '../services/callService';
/**
 * WebhookController
 *
 * Handles Twilio webhook callbacks for voice, status, and recording events.
 * These endpoints should NOT require authentication as they come from Twilio.
 */
export declare class WebhookController {
    private callService;
    private twilioService;
    private io;
    constructor(callService: CallService);
    /**
     * Set the Socket.io instance for real-time notifications
     */
    setSocketIO(io: any): void;
    /**
     * POST /api/webhooks/twilio/voice
     *
     * Main TwiML endpoint - handles initial call setup for both inbound and outbound calls.
     * Returns TwiML instructions for Twilio on how to handle the call.
     */
    handleVoiceWebhook: (req: Request, res: Response) => Promise<void>;
    /**
     * POST /api/webhooks/twilio/status
     *
     * Handles call status updates (initiated, ringing, answered, completed, etc.)
     */
    handleStatusWebhook: (req: Request, res: Response) => Promise<void>;
    /**
     * POST /api/webhooks/twilio/recording
     *
     * Handles recording ready notifications
     */
    handleRecordingWebhook: (req: Request, res: Response) => Promise<void>;
    /**
     * POST /api/webhooks/twilio/transcription
     *
     * Handles transcription ready notifications
     */
    handleTranscriptionWebhook: (req: Request, res: Response) => Promise<void>;
    /**
     * POST /api/webhooks/twilio/fallback
     *
     * Fallback URL when primary TwiML fails
     */
    handleFallback: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=webhookController.d.ts.map