import { Server as SocketIOServer } from 'socket.io';
import { Email } from '../models/types';
export interface EmailNotification {
    type: 'new_email' | 'email_sent' | 'sync_status' | 'error' | 'email_opened' | 'email_link_clicked' | 'email_delivered' | 'email_bounced' | 'email_status_changed';
    data: any;
    timestamp: Date;
}
export declare class RealTimeNotificationService {
    private io;
    private userSockets;
    constructor();
    initialize(io: SocketIOServer): void;
    private setupSocketHandlers;
    private handleEmailSyncRequest;
    notifyUser(userId: string | number, notification: EmailNotification): void;
    notifyAll(notification: EmailNotification): void;
    notifyNewEmail(userId: string, email: Email, accountInfo?: {
        id: string;
        email: string;
    }): void;
    /**
     * Extract sender name from "Name <email>" format
     */
    private extractSenderName;
    /**
     * Extract email address from "Name <email>" format
     */
    private extractEmailAddress;
    /**
     * Clean email snippet by removing HTML and extra whitespace
     */
    private cleanEmailSnippet;
    notifyEmailSent(userId: string, messageId: string, to: string[], subject: string): void;
    notifySyncStatus(userId: string, accountId: string, status: 'starting' | 'completed' | 'failed', details?: any): void;
    notifyError(userId: string, error: string, context?: any): void;
    notifyEmailOpened(userId: string, messageId: string, recipientEmail?: string, openCount?: number): void;
    notifyEmailLinkClicked(userId: string, messageId: string, originalUrl: string, recipientEmail?: string, clickCount?: number): void;
    notifyEmailDelivered(userId: string, messageId: string, recipientEmail?: string): void;
    notifyEmailBounced(userId: string, messageId: string, recipientEmail?: string, reason?: string): void;
    getConnectionStats(): {
        totalConnections: number;
        uniqueUsers: number;
        userConnections: Record<string, number>;
    };
    isUserConnected(userId: string): boolean;
    disconnectUser(userId: string): void;
}
//# sourceMappingURL=realTimeNotificationService.d.ts.map