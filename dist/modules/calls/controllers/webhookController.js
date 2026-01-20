"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const twilioService_1 = require("../services/twilioService");
const twilioConfig_1 = require("../config/twilioConfig");
/**
 * WebhookController
 *
 * Handles Twilio webhook callbacks for voice, status, and recording events.
 * These endpoints should NOT require authentication as they come from Twilio.
 */
class WebhookController {
    callService;
    twilioService = (0, twilioService_1.getTwilioService)();
    // Socket.io instance for real-time notifications
    io = null;
    constructor(callService) {
        this.callService = callService;
    }
    /**
     * Set the Socket.io instance for real-time notifications
     */
    setSocketIO(io) {
        this.io = io;
    }
    /**
     * POST /api/webhooks/twilio/voice
     *
     * Main TwiML endpoint - handles initial call setup for both inbound and outbound calls.
     * Returns TwiML instructions for Twilio on how to handle the call.
     */
    handleVoiceWebhook = async (req, res) => {
        console.log('[Webhook] Voice webhook received:', req.body);
        try {
            // Validate webhook signature in production
            if (process.env.NODE_ENV === 'production') {
                const signature = req.headers['x-twilio-signature'];
                const webhookUrls = (0, twilioConfig_1.getWebhookUrls)();
                if (!this.twilioService.validateWebhookSignature(signature, webhookUrls.voice, req.body)) {
                    console.warn('[Webhook] Invalid signature');
                    res.status(403).send('Invalid signature');
                    return;
                }
            }
            const { CallSid, From, To, Direction, CallStatus } = req.body;
            // Get optional query params (set when we initiate calls)
            const callId = req.query.callId ? parseInt(req.query.callId, 10) : undefined;
            const userId = req.query.userId ? parseInt(req.query.userId, 10) : undefined;
            const direction = req.query.direction || Direction;
            let twiml;
            if (direction === 'outbound' && callId) {
                // Outbound call - connect browser to PSTN
                const toNumber = req.query.toNumber || To;
                twiml = this.twilioService.generateOutboundTwiML(toNumber, callId);
                console.log(`[Webhook] Outbound call ${callId} connecting to ${toNumber}`);
            }
            else {
                // Incoming call - route to agent
                const result = this.callService.handleIncomingCall(CallSid, From, To, userId);
                twiml = result.twiml;
                // Notify agents via Socket.io
                if (this.io) {
                    this.io.emit('call:incoming', {
                        type: 'call:incoming',
                        callId: result.call.id,
                        twilioCallSid: CallSid,
                        fromNumber: From,
                        toNumber: To,
                        timestamp: new Date().toISOString()
                    });
                }
                console.log(`[Webhook] Incoming call ${result.call.id} from ${From}`);
            }
            // Return TwiML response
            res.type('text/xml');
            res.send(twiml);
        }
        catch (error) {
            console.error('[Webhook] Voice webhook error:', error);
            // Return a fallback TwiML that ends the call gracefully
            const VoiceResponse = require('twilio').twiml.VoiceResponse;
            const response = new VoiceResponse();
            response.say({ voice: 'alice' }, 'Sorry, an error occurred. Please try again later.');
            response.hangup();
            res.type('text/xml');
            res.send(response.toString());
        }
    };
    /**
     * POST /api/webhooks/twilio/status
     *
     * Handles call status updates (initiated, ringing, answered, completed, etc.)
     */
    handleStatusWebhook = async (req, res) => {
        console.log('[Webhook] Status webhook received:', req.body);
        try {
            const { CallSid, CallStatus, CallDuration } = req.body;
            // Get callId from query if provided
            const callId = req.query.callId ? parseInt(req.query.callId, 10) : undefined;
            // Find and update the call
            const call = this.callService.updateCallStatus(CallSid, CallStatus, CallDuration ? parseInt(CallDuration, 10) : undefined);
            if (call) {
                // Emit real-time update
                if (this.io) {
                    const eventType = ['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(CallStatus)
                        ? 'call:ended'
                        : CallStatus === 'in-progress'
                            ? 'call:started'
                            : 'call:status';
                    this.io.emit(eventType, {
                        type: eventType,
                        callId: call.id,
                        twilioCallSid: CallSid,
                        previousStatus: CallStatus, // This is actually the new status
                        currentStatus: call.status,
                        duration: call.duration,
                        timestamp: new Date().toISOString()
                    });
                }
                console.log(`[Webhook] Call ${call.id} status updated to ${call.status}`);
            }
            else {
                console.warn(`[Webhook] Call not found for status update: ${CallSid}`);
            }
            // Acknowledge the webhook
            res.status(200).send('OK');
        }
        catch (error) {
            console.error('[Webhook] Status webhook error:', error);
            res.status(500).send('Error processing webhook');
        }
    };
    /**
     * POST /api/webhooks/twilio/recording
     *
     * Handles recording ready notifications
     */
    handleRecordingWebhook = async (req, res) => {
        console.log('[Webhook] Recording webhook received:', req.body);
        try {
            const { RecordingSid, RecordingUrl, RecordingStatus, RecordingDuration, RecordingChannels, CallSid } = req.body;
            if (RecordingStatus !== 'completed') {
                console.log(`[Webhook] Recording ${RecordingSid} status: ${RecordingStatus}`);
                res.status(200).send('OK');
                return;
            }
            // Save recording metadata
            const recording = this.callService.handleRecordingReady(CallSid, RecordingSid, RecordingUrl + '.mp3', // Add format extension
            parseInt(RecordingDuration, 10), parseInt(RecordingChannels || '1', 10));
            if (recording) {
                // Emit real-time update
                if (this.io) {
                    // Find the call to get its ID
                    const call = this.callService.getCallByTwilioSid(CallSid);
                    if (call) {
                        this.io.emit('call:recording-ready', {
                            type: 'call:recording-ready',
                            callId: call.id,
                            recordingId: recording.id,
                            recordingUrl: recording.recordingUrl,
                            duration: recording.duration,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
                console.log(`[Webhook] Recording ${recording.id} saved for call ${CallSid}`);
            }
            res.status(200).send('OK');
        }
        catch (error) {
            console.error('[Webhook] Recording webhook error:', error);
            res.status(500).send('Error processing webhook');
        }
    };
    /**
     * POST /api/webhooks/twilio/transcription
     *
     * Handles transcription ready notifications
     */
    handleTranscriptionWebhook = async (req, res) => {
        console.log('[Webhook] Transcription webhook received:', req.body);
        try {
            const { TranscriptionSid, TranscriptionText, TranscriptionStatus, RecordingSid, CallSid } = req.body;
            if (TranscriptionStatus !== 'completed') {
                console.log(`[Webhook] Transcription ${TranscriptionSid} status: ${TranscriptionStatus}`);
                res.status(200).send('OK');
                return;
            }
            // Find the recording by RecordingSid
            // Note: This would need to be implemented in CallModel
            console.log(`[Webhook] Transcription completed for recording ${RecordingSid}`);
            console.log(`[Webhook] Transcription text: ${TranscriptionText?.substring(0, 100)}...`);
            // TODO: Update the recording with transcription data
            // this.callService.updateRecordingTranscription(RecordingSid, TranscriptionText, TranscriptionSid);
            res.status(200).send('OK');
        }
        catch (error) {
            console.error('[Webhook] Transcription webhook error:', error);
            res.status(500).send('Error processing webhook');
        }
    };
    /**
     * POST /api/webhooks/twilio/fallback
     *
     * Fallback URL when primary TwiML fails
     */
    handleFallback = async (req, res) => {
        console.error('[Webhook] Fallback triggered:', req.body);
        const VoiceResponse = require('twilio').twiml.VoiceResponse;
        const response = new VoiceResponse();
        response.say({ voice: 'alice' }, 'We are experiencing technical difficulties. Please try again later.');
        response.hangup();
        res.type('text/xml');
        res.send(response.toString());
    };
}
exports.WebhookController = WebhookController;
//# sourceMappingURL=webhookController.js.map