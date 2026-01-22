import { Router } from 'express';
import { gmailWebhookController } from '../controllers/gmailWebhookController';

/**
 * Email Webhook Routes
 * Handles incoming webhooks from email providers (Gmail Pub/Sub, etc.)
 */
export function createEmailWebhookRoutes(): Router {
    const router = Router();

    /**
     * Gmail Pub/Sub Push Notification
     * This endpoint receives push notifications from Google Cloud Pub/Sub
     * when new emails arrive in a user's Gmail inbox.
     * 
     * Setup:
     * 1. Create a Pub/Sub topic in Google Cloud Console
     * 2. Grant gmail-api-push@system.gserviceaccount.com Pub/Sub Publisher role
     * 3. Create a push subscription pointing to this endpoint
     * 4. Set GMAIL_PUBSUB_TOPIC environment variable
     */
    router.post('/gmail/push', (req, res) => {
        gmailWebhookController.handlePushNotification(req, res);
    });

    /**
     * Gmail webhook verification (GET request)
     */
    router.get('/gmail/push', (req, res) => {
        gmailWebhookController.verifyWebhook(req, res);
    });

    /**
     * Get status of Gmail push notifications
     */
    router.get('/gmail/status', (req, res) => {
        gmailWebhookController.getStatus(req, res);
    });

    /**
     * Health check for webhooks
     */
    router.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            service: 'email-webhooks',
            timestamp: new Date().toISOString()
        });
    });

    return router;
}
