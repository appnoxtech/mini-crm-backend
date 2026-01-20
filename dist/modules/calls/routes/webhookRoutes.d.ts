import { Router } from 'express';
import { WebhookController } from '../controllers/webhookController';
/**
 * Create webhook routes
 *
 * IMPORTANT: These routes should NOT require authentication
 * They are called by Twilio servers, which can't authenticate with our system.
 * Security is handled via Twilio signature validation.
 */
export declare function createWebhookRoutes(webhookController: WebhookController): Router;
//# sourceMappingURL=webhookRoutes.d.ts.map