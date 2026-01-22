import { Request, Response } from 'express';
/**
 * Gmail Webhook Controller
 * Handles incoming Pub/Sub push notifications from Google
 */
export declare class GmailWebhookController {
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
    handlePushNotification(req: Request, res: Response): Promise<void>;
    /**
     * Health check / verification endpoint for Pub/Sub
     * GET /api/webhooks/gmail/push
     *
     * Google may send a verification request when setting up the subscription
     */
    verifyWebhook(req: Request, res: Response): Promise<void>;
    /**
     * Get status of Gmail push notifications
     * GET /api/webhooks/gmail/status
     */
    getStatus(req: Request, res: Response): Promise<void>;
}
export declare const gmailWebhookController: GmailWebhookController;
//# sourceMappingURL=gmailWebhookController.d.ts.map