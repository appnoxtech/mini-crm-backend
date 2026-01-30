import { EventNotificationModel, EventNotification } from '../models/EventNotification';
import { CalendarEventModel } from '../models/CalendarEvent';
import { NotificationSchedulerService } from './notificationSchedulerService';
import { Server as SocketIOServer } from 'socket.io';
import nodemailer from 'nodemailer';

interface EmailService {
    sendEmail(to: string, subject: string, body: string, htmlBody?: string): Promise<boolean>;
}

interface UserModel {
    findById(id: number): { id: number; email: string; name: string } | null;
}

export class NotificationDispatcherService {
    private io: SocketIOServer | null = null;

    constructor(
        private notificationModel: EventNotificationModel,
        private eventModel: CalendarEventModel,
        private emailService: EmailService,
        private userModel: UserModel
    ) { }

    setSocketIO(io: SocketIOServer): void {
        this.io = io;
    }

    /**
     * Process all pending notifications that are due
     */
    async processPendingNotifications(): Promise<{ processed: number; succeeded: number; failed: number }> {
        const pending = this.notificationModel.findPending();
        let processed = 0;
        let succeeded = 0;
        let failed = 0;

        for (const notification of pending) {
            processed++;
            try {
                await this.dispatchNotification(notification);
                succeeded++;
            } catch (error: any) {
                console.error(`Failed to dispatch notification ${notification.id}:`, error);
                this.notificationModel.markFailed(notification.id, error.message || 'Unknown error');
                failed++;
            }
        }

        return { processed, succeeded, failed };
    }

    /**
     * Dispatch a single notification via in-app and email
     */
    private async dispatchNotification(notification: EventNotification): Promise<void> {
        const event = this.eventModel.findById(notification.eventId);
        if (!event) {
            this.notificationModel.markFailed(notification.id, 'Event not found');
            return;
        }

        const user = this.userModel.findById(notification.userId);
        if (!user) {
            this.notificationModel.markFailed(notification.id, 'User not found');
            return;
        }

        const timeRemaining = NotificationSchedulerService.calculateTimeRemaining(event.startTime);

        // Send in-app notification
        await this.sendInAppNotification(notification, event, user, timeRemaining);

        // Send email notification
        await this.sendEmailNotification(notification, event, user, timeRemaining);
    }

    private async sendInAppNotification(
        notification: EventNotification,
        event: { id: number; title: string; startTime: string; location?: string },
        user: { id: number; name: string },
        timeRemaining: string
    ): Promise<void> {
        if (!notification.inAppSentAt && this.io) {
            const payload = {
                type: 'calendar_reminder',
                eventId: event.id,
                title: `Reminder: ${event.title}`,
                message: `Your event "${event.title}" starts ${timeRemaining}`,
                eventDetails: {
                    title: event.title,
                    startTime: event.startTime,
                    location: event.location,
                    timeRemaining
                },
                timestamp: new Date().toISOString()
            };

            // Emit to user's room (uses underscore to match realTimeNotificationService)
            this.io.to(`user_${notification.userId}`).emit('notification', payload);
            this.notificationModel.markSent(notification.id, 'inApp');
        }
    }

    private async sendEmailNotification(
        notification: EventNotification,
        event: { id: number; title: string; startTime: string; endTime: string; location?: string; description?: string },
        user: { id: number; email: string; name: string },
        timeRemaining: string
    ): Promise<void> {
        if (!notification.emailSentAt) {
            const subject = `Reminder: ${event.title} - ${timeRemaining}`;

            const startDate = new Date(event.startTime);
            const endDate = new Date(event.endTime);

            const textBody = `
Hi ${user.name},

This is a reminder for your upcoming event:

📅 ${event.title}
🕐 ${startDate.toLocaleString()} - ${endDate.toLocaleString()}
${event.location ? `📍 ${event.location}` : ''}
${event.description ? `\n${event.description}` : ''}

This event starts ${timeRemaining}.

Best regards,
Your CRM Calendar
            `.trim();

            const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .event-card { background: white; padding: 15px; border-radius: 8px; margin: 10px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .detail { margin: 8px 0; }
        .time-badge { display: inline-block; background: #667eea; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin:0">📅 Event Reminder</h2>
        </div>
        <div class="content">
            <p>Hi ${user.name},</p>
            <p>This is a reminder for your upcoming event:</p>
            <div class="event-card">
                <h3 style="margin-top:0">${event.title}</h3>
                <div class="detail">🕐 <strong>When:</strong> ${startDate.toLocaleString()} - ${endDate.toLocaleString()}</div>
                ${event.location ? `<div class="detail">📍 <strong>Where:</strong> ${event.location}</div>` : ''}
                ${event.description ? `<div class="detail">${event.description}</div>` : ''}
                <div style="margin-top: 15px;">
                    <span class="time-badge">Starts ${timeRemaining}</span>
                </div>
            </div>
            <p style="font-size: 12px; color: #888; margin-top: 20px;">
                This email was sent via system notification.
            </p>
        </div>
    </div>
</body>
</html>
            `.trim();

            try {
                // Use system SMTP instead of user's connected account
                await this.sendViaSystemSmtp(user.email, subject, textBody, htmlBody);
                this.notificationModel.markSent(notification.id, 'email');
            } catch (error: any) {
                console.error(`Failed to send email for notification ${notification.id}:`, error);
                // Don't fail the whole notification, just log the email failure
            }
        }
    }

    /**
     * Send email using the system-wide SMTP configuration from .env
     */
    private async sendViaSystemSmtp(to: string, subject: string, text: string, html: string): Promise<void> {
        const smtpHost = process.env.SMTP_HOST;
        const smtpPort = parseInt(process.env.SMTP_PORT || '587');
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        const smtpSecure = process.env.SMTP_SECURE === 'true';

        if (!smtpHost || !smtpUser || !smtpPass) {
            console.warn('⚠️ System SMTP not configured in .env. Skipping email notification.');
            return;
        }

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure, // true for 465, false for other ports
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        await transporter.sendMail({
            from: `"CRM System" <${smtpUser}>`,
            to,
            subject,
            text,
            html,
        });

        console.log(`📧 System email sent to ${to}`);
    }
}
