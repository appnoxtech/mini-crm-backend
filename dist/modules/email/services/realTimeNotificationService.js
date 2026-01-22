"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealTimeNotificationService = void 0;
class RealTimeNotificationService {
    io = null;
    userSockets = new Map(); // userId -> socketIds
    constructor() {
        // Will be initialized when socket.io server is available
    }
    initialize(io) {
        this.io = io;
        this.setupSocketHandlers();
    }
    setupSocketHandlers() {
        if (!this.io)
            return;
        this.io.on('connection', (socket) => {
            console.log('New socket connection:', socket.id);
            // Handle user authentication
            socket.on('authenticate', (userId) => {
                if (!userId)
                    return;
                const stringUserId = String(userId);
                // Add socket to user's socket set
                if (!this.userSockets.has(stringUserId)) {
                    this.userSockets.set(stringUserId, new Set());
                }
                this.userSockets.get(stringUserId).add(socket.id);
                socket.join(`user_${stringUserId}`);
                console.log(`Socket ${socket.id} authenticated for user ${stringUserId}`);
                // Send initial connection confirmation
                socket.emit('authenticated', { userId: stringUserId, timestamp: new Date() });
            });
            // Handle disconnection
            socket.on('disconnect', () => {
                console.log('Socket disconnected:', socket.id);
                // Remove socket from all users
                for (const [userId, socketIds] of this.userSockets.entries()) {
                    if (socketIds.has(socket.id)) {
                        socketIds.delete(socket.id);
                        if (socketIds.size === 0) {
                            this.userSockets.delete(userId);
                        }
                        console.log(`Removed socket ${socket.id} from user ${userId}`);
                        break;
                    }
                }
            });
            // Handle email sync requests
            socket.on('request_email_sync', (data) => {
                this.handleEmailSyncRequest(data.accountId, data.userId);
            });
        });
    }
    handleEmailSyncRequest(accountId, userId) {
        // In a real implementation, this would trigger the email queue service
        console.log(`Email sync requested for account ${accountId} by user ${userId}`);
        // Notify user that sync is starting
        this.notifyUser(userId, {
            type: 'sync_status',
            data: { accountId, status: 'starting' },
            timestamp: new Date()
        });
    }
    // Notify specific user
    notifyUser(userId, notification) {
        if (!this.io) {
            console.warn('❌ Socket.io NOT initialized in RealTimeNotificationService!');
            return;
        }
        const stringUserId = String(userId);
        const userSockets = this.userSockets.get(stringUserId);
        const socketCount = userSockets?.size || 0;
        console.log(`🔔 Attempting to notify user ${stringUserId} (${notification.type}). Connections: ${socketCount}`);
        this.io.to(`user_${stringUserId}`).emit('notification', notification);
        if (socketCount === 0) {
            console.log(`⚠️ User ${stringUserId} has 0 active socket connections, but notification was sent to room user_${stringUserId}`);
        }
        else {
            console.log(`✅ Notification successfully emitted to user_${stringUserId}`);
        }
    }
    // Notify all connected users (admin broadcasts)
    notifyAll(notification) {
        if (!this.io) {
            console.warn('Socket.io not initialized, cannot send notification');
            return;
        }
        this.io.emit('notification', notification);
        console.log('Broadcast notification sent:', notification.type);
    }
    // Specific notification methods
    notifyNewEmail(userId, email, accountInfo) {
        // Parse sender name from "John Doe <john@example.com>" format
        const senderName = this.extractSenderName(email.from);
        const senderEmail = this.extractEmailAddress(email.from);
        // Clean snippet: remove HTML tags and extra whitespace
        const cleanSnippet = this.cleanEmailSnippet(email.body || '');
        this.notifyUser(userId, {
            type: 'new_email',
            data: {
                // Email identifiers
                id: email.id,
                messageId: email.messageId,
                threadId: email.threadId,
                // Account info (which inbox)
                accountId: email.accountId || accountInfo?.id,
                accountEmail: accountInfo?.email,
                // Sender info (for display)
                from: email.from,
                senderName: senderName,
                senderEmail: senderEmail,
                // Email content
                subject: email.subject || '(No Subject)',
                snippet: cleanSnippet,
                // Metadata
                receivedAt: email.receivedAt,
                isRead: email.isRead,
                hasAttachments: email.attachments && email.attachments.length > 0,
                attachmentCount: email.attachments?.length || 0,
                // CRM context (if matched)
                dealIds: email.dealIds || [],
                contactIds: email.contactIds || []
            },
            timestamp: new Date()
        });
    }
    /**
     * Extract sender name from "Name <email>" format
     */
    extractSenderName(fromAddress) {
        if (!fromAddress)
            return 'Unknown';
        const match = fromAddress.match(/^(.+?)\s*<[^>]+>$/);
        if (match && match[1]) {
            return match[1].trim().replace(/^["']|["']$/g, ''); // Remove quotes
        }
        // If no angle brackets, extract name from email
        const emailMatch = fromAddress.match(/([^@]+)@/);
        return emailMatch && emailMatch[1] ? emailMatch[1] : fromAddress;
    }
    /**
     * Extract email address from "Name <email>" format
     */
    extractEmailAddress(fromAddress) {
        if (!fromAddress)
            return '';
        const match = fromAddress.match(/<([^>]+)>/);
        return match && match[1] ? match[1] : fromAddress;
    }
    /**
     * Clean email snippet by removing HTML and extra whitespace
     */
    cleanEmailSnippet(body, maxLength = 150) {
        if (!body)
            return '';
        // Remove HTML tags
        let clean = body.replace(/<[^>]*>/g, ' ');
        // Decode common HTML entities
        clean = clean.replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"');
        // Remove extra whitespace
        clean = clean.replace(/\s+/g, ' ').trim();
        // Truncate
        return clean.length > maxLength
            ? clean.substring(0, maxLength) + '...'
            : clean;
    }
    notifyEmailSent(userId, messageId, to, subject) {
        this.notifyUser(userId, {
            type: 'email_sent',
            data: {
                messageId,
                to,
                subject,
                sentAt: new Date()
            },
            timestamp: new Date()
        });
    }
    notifySyncStatus(userId, accountId, status, details) {
        this.notifyUser(userId, {
            type: 'sync_status',
            data: {
                accountId,
                status,
                details,
                timestamp: new Date()
            },
            timestamp: new Date()
        });
    }
    notifyError(userId, error, context) {
        this.notifyUser(userId, {
            type: 'error',
            data: {
                message: error,
                context,
                timestamp: new Date()
            },
            timestamp: new Date()
        });
    }
    notifyEmailOpened(userId, messageId, recipientEmail, openCount) {
        this.notifyUser(userId, {
            type: 'email_opened',
            data: {
                messageId,
                recipientEmail,
                openCount,
                timestamp: new Date()
            },
            timestamp: new Date()
        });
    }
    notifyEmailLinkClicked(userId, messageId, originalUrl, recipientEmail, clickCount) {
        this.notifyUser(userId, {
            type: 'email_link_clicked',
            data: {
                messageId,
                originalUrl,
                recipientEmail,
                clickCount,
                timestamp: new Date()
            },
            timestamp: new Date()
        });
    }
    notifyEmailDelivered(userId, messageId, recipientEmail) {
        this.notifyUser(userId, {
            type: 'email_delivered',
            data: {
                messageId,
                recipientEmail,
                timestamp: new Date()
            },
            timestamp: new Date()
        });
    }
    notifyEmailBounced(userId, messageId, recipientEmail, reason) {
        this.notifyUser(userId, {
            type: 'email_bounced',
            data: {
                messageId,
                recipientEmail,
                reason,
                timestamp: new Date()
            },
            timestamp: new Date()
        });
    }
    // Get statistics about connected users
    getConnectionStats() {
        const totalConnections = Array.from(this.userSockets.values())
            .reduce((total, socketIds) => total + socketIds.size, 0);
        const uniqueUsers = this.userSockets.size;
        const userConnections = {};
        for (const [userId, socketIds] of this.userSockets.entries()) {
            userConnections[userId] = socketIds.size;
        }
        return {
            totalConnections,
            uniqueUsers,
            userConnections
        };
    }
    // Check if user is connected
    isUserConnected(userId) {
        return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
    }
    // Disconnect all sockets for a user (useful for logout)
    disconnectUser(userId) {
        if (!this.io || !this.userSockets.has(userId))
            return;
        const socketIds = this.userSockets.get(userId);
        for (const socketId of socketIds) {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket) {
                socket.disconnect(true);
            }
        }
        this.userSockets.delete(userId);
        console.log(`Disconnected all sockets for user ${userId}`);
    }
}
exports.RealTimeNotificationService = RealTimeNotificationService;
//# sourceMappingURL=realTimeNotificationService.js.map