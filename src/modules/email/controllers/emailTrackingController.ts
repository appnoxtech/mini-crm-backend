import { Request, Response } from 'express';
import { EmailModel } from '../models/emailModel';
import { RealTimeNotificationService } from '../services/realTimeNotificationService';

// Track recently notified opens to deduplicate within a time window (60 seconds)
// This prevents spam from a single email open session (e.g., user keeps email open and reads it)
const recentlyNotified = new Map<string, number>();
const DEDUP_WINDOW_MS = 60000; // 60 seconds (1 minute)

// Cleanup old entries from recentlyNotified map every minute
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of recentlyNotified.entries()) {
        if (now - timestamp > DEDUP_WINDOW_MS * 2) {
            recentlyNotified.delete(key);
        }
    }
}, 60000);

export class EmailTrackingController {
    constructor(
        private emailModel: EmailModel,
        private notificationService: RealTimeNotificationService
    ) { }

    async trackOpen(req: Request, res: Response) {
        const emailId = req.params.emailId as string;
        const ipAddress = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '').toString();
        const userAgent = (req.headers['user-agent'] as string) || '';

        console.log(`📧 [TRACKING] Email open event received for emailId: ${emailId}`);

        try {
            // Get email details first
            const email = await this.emailModel.findEmailByIdGlobal(emailId);

            if (!email) {
                console.warn(`⚠️ [TRACKING] Email not found for emailId: ${emailId}`);
                // Still return pixel even if email not found
                const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
                res.writeHead(200, {
                    'Content-Type': 'image/gif',
                    'Content-Length': pixel.length,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                });
                res.end(pixel);
                return;
            }

            console.log(`✉️ [TRACKING] Found email with accountId: ${email.accountId}`);

            // Get the email account to find the userId
            const emailAccount = await this.emailModel.getEmailAccountById(email.accountId, email.companyId);

            if (emailAccount) {
                console.log(`👤 [TRACKING] Found email account for userId: ${emailAccount.userId}`);

                // Increment the counter
                await this.emailModel.incrementOpens(emailId, email.companyId);

                // Log the event with more metadata if needed
                await this.emailModel.logTrackingEvent({
                    emailId,
                    companyId: email.companyId,
                    type: 'open',
                    ipAddress,
                    userAgent
                });

                // Check if we already notified recently (deduplicate within time window)
                const now = Date.now();
                const lastNotified = recentlyNotified.get(emailId);

                if (lastNotified && (now - lastNotified) < DEDUP_WINDOW_MS) {
                    console.log(`⏭️ [TRACKING] Skipping duplicate notification for emailId: ${emailId} (within 60s window)`);
                } else {
                    // Notify the user via real-time socket with correct userId
                    console.log(`🔔 [TRACKING] Sending notification to userId: ${emailAccount.userId} for messageId: ${email.messageId}`);
                    this.notificationService.notifyEmailOpened(
                        emailAccount.userId,
                        email.id,
                        email.messageId,
                        email.to[0] || 'Unknown',
                        (email.opens || 0) + 1
                    );
                    console.log(`✅ [TRACKING] Notification sent successfully`);

                    // Record that we notified for this email
                    recentlyNotified.set(emailId, now);
                }
            } else {
                console.warn(`⚠️ [TRACKING] Email account not found for accountId: ${email.accountId}`);
            }

        } catch (error) {
            console.error('❌ [TRACKING] Tracking open failed:', error);
        }

        // Return a 1x1 transparent GIF
        const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.writeHead(200, {
            'Content-Type': 'image/gif',
            'Content-Length': pixel.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.end(pixel);
    }

    async trackClick(req: Request, res: Response) {
        const emailId = req.params.emailId as string;
        const encodedUrl = req.query.url as string;
        const ipAddress = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '').toString();
        const userAgent = (req.headers['user-agent'] as string) || '';

        if (!encodedUrl) {
            return res.status(400).send('Missing URL');
        }

        let originalUrl: string;
        try {
            originalUrl = Buffer.from(encodedUrl, 'base64').toString('utf8');
        } catch (e) {
            return res.status(400).send('Invalid URL');
        }

        try {
            // Get email details first
            const email = await this.emailModel.findEmailByIdGlobal(emailId);

            if (email) {
                // Get the email account to find the userId
                const emailAccount = await this.emailModel.getEmailAccountById(email.accountId, email.companyId);

                if (emailAccount) {
                    // Increment the counter
                    await this.emailModel.incrementClicks(emailId, email.companyId);

                    // Log the event
                    await this.emailModel.logTrackingEvent({
                        emailId,
                        companyId: email.companyId,
                        type: 'click',
                        ipAddress,
                        userAgent,
                        metadata: { url: originalUrl }
                    });

                    // Check if we already notified recently (deduplicate within time window)
                    const clickKey = `click-${emailId}`;
                    const now = Date.now();
                    const lastNotified = recentlyNotified.get(clickKey);

                    if (lastNotified && (now - lastNotified) < DEDUP_WINDOW_MS) {
                        console.log(`⏭️ [TRACKING] Skipping duplicate click notification for emailId: ${emailId}`);
                    } else {
                        // Notify the user via real-time socket with correct userId
                        this.notificationService.notifyEmailLinkClicked(
                            emailAccount.userId,
                            email.id,
                            email.messageId,
                            originalUrl,
                            email.to[0] || 'Unknown',
                            (email.clicks || 0) + 1
                        );

                        // Record that we notified for this click
                        recentlyNotified.set(clickKey, now);
                    }
                }
            }
        } catch (error) {
            console.error('Tracking click failed:', error);
        }

        // Redirect to the original URL
        res.redirect(originalUrl);
    }
}
