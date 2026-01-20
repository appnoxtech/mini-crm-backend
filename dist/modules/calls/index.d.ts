/**
 * Calls Module
 *
 * This module handles all call-related functionality including:
 * - Initiating and receiving calls via Twilio
 * - Call recording and transcription
 * - Real-time call updates via WebSocket
 * - Call history and analytics
 *
 * Components:
 * - Model: Database operations for calls, recordings, participants, events
 * - Services: Business logic for call operations and Twilio integration
 * - Controllers: HTTP request handlers
 * - Routes: API endpoint definitions
 * - Socket: Real-time WebSocket events
 */
export { CallModel } from './models/Call';
export type { Call, CallDirection, CallStatus, CallDisposition, CallRecording, CallParticipant, CallEvent } from './models/Call';
export * from './types';
export { getTwilioConfig, validateTwilioConfig, getWebhookUrls } from './config/twilioConfig';
export { TwilioService, getTwilioService } from './services/twilioService';
export { CallService } from './services/callService';
export { CallSocketService, getCallSocketService } from './services/callSocketService';
export { CallController } from './controllers/callController';
export { WebhookController } from './controllers/webhookController';
export { createCallRoutes } from './routes/callRoutes';
export { createWebhookRoutes } from './routes/webhookRoutes';
export * from './validations/callValidation';
//# sourceMappingURL=index.d.ts.map