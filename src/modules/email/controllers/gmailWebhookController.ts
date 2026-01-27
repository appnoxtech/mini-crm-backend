import { Request, Response } from 'express';
import { gmailPushService } from '../services/gmailPushService';

/**
 * Gmail Webhook Controller
 * Handles incoming Pub/Sub push notifications from Google
 */
export class GmailWebhookController {

    /**
     * Handle Gmail Pub/Sub push notification
     * POST /api/webhooks/gmail/push
     * 
     * Google sends a POST request with the following body:
     * {
     *   "message": {
     *     "data": "base64-encoded-data",
     *     "messageId": "unique-id",
     *     "publishTime": "2024-01-22T10:00:00Z"
     *   },
     *   "subscription": "projects/PROJECT/subscriptions/SUBSCRIPTION"
     * }
     */
    async handlePushNotification(req: Request, res: Response): Promise<void> {
        try {


            // Validate request
            const { message, subscription } = req.body;

            if (!message || !message.data) {
                console.warn('Invalid Gmail webhook payload - missing message or data');
                res.status(400).json({ error: 'Invalid payload' });
                return;
            }

            // Acknowledge immediately to prevent Google from retrying
            // We process asynchronously
            res.status(200).json({ status: 'received' });

            // Process the notification asynchronously
            setImmediate(async () => {
                try {
                    await gmailPushService.handlePushNotification({
                        data: message.data,
                        messageId: message.messageId || 'unknown',
                        publishTime: message.publishTime || new Date().toISOString()
                    });
                } catch (error: any) {
                    console.error('Error processing Gmail push notification:', error.message);
                }
            });

        } catch (error: any) {
            console.error('Gmail webhook error:', error);
            // Still return 200 to prevent retries for malformed requests
            res.status(200).json({ status: 'error', message: error.message });
        }
    }

    /**
     * Health check / verification endpoint for Pub/Sub
     * GET /api/webhooks/gmail/push
     * 
     * Google may send a verification request when setting up the subscription
     */
    async verifyWebhook(req: Request, res: Response): Promise<void> {

        res.status(200).json({
            status: 'ok',
            service: 'gmail-push-notifications',
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Get status of Gmail push notifications
     * GET /api/webhooks/gmail/status
     */
    async getStatus(req: Request, res: Response): Promise<void> {
        try {
            const status = gmailPushService.getStatus();
            res.json({
                success: true,
                activeWatches: status.length,
                watches: status
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}

export const gmailWebhookController = new GmailWebhookController();
