import { Server as SocketIOServer } from 'socket.io';
import { Email } from '../models/types';

export interface EmailNotification {
  type: 'new_email' | 'sync_status' | 'error' | 'email_opened' | 'email_link_clicked' | 'email_delivered' | 'email_bounced' | 'email_status_changed';
  data: any;
  timestamp: Date;
}

export class RealTimeNotificationService {
  private io: SocketIOServer | null = null;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> socketIds

  constructor() {
    // Will be initialized when socket.io server is available
  }

  initialize(io: SocketIOServer): void {
    this.io = io;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log(`🔌 [SOCKET] New connection established - Socket ID: ${socket.id}`);

      // Handle user authentication
      socket.on('authenticate', (userId: any) => {
        if (!userId) {
          console.warn(`⚠️ [SOCKET] Authentication attempted with empty userId`);
          return;
        }

        const stringUserId = String(userId);
        console.log(`✅ [SOCKET] User authenticated - userId: ${stringUserId}, socketId: ${socket.id}`);

        // Add socket to user's socket set
        if (!this.userSockets.has(stringUserId)) {
          this.userSockets.set(stringUserId, new Set());
        }
        this.userSockets.get(stringUserId)!.add(socket.id);

        socket.join(`user_${stringUserId}`);

        // Log current user connections
        console.log(`📊 [SOCKET] Current user sockets:`, Array.from(this.userSockets.entries()).map(([uid, sockets]) => `${uid}:${sockets.size}`));

        // Send initial connection confirmation
        socket.emit('authenticated', { userId: stringUserId, timestamp: new Date() });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`❌ [SOCKET] Socket disconnected - Socket ID: ${socket.id}`);

        // Remove socket from all users
        for (const [userId, socketIds] of this.userSockets.entries()) {
          if (socketIds.has(socket.id)) {
            socketIds.delete(socket.id);
            if (socketIds.size === 0) {
              this.userSockets.delete(userId);
              console.log(`🗑️ [SOCKET] Removed user ${userId} (no more sockets)`);
            }

            break;
          }
        }
      });

      // Handle email sync requests
      socket.on('request_email_sync', (data: { accountId: string; userId: string }) => {
        this.handleEmailSyncRequest(data.accountId, data.userId);
      });
    });
  }

  private handleEmailSyncRequest(accountId: string, userId: string): void {
    // In a real implementation, this would trigger the email queue service


    // Notify user that sync is starting
    this.notifyUser(userId, {
      type: 'sync_status',
      data: { accountId, status: 'starting' },
      timestamp: new Date()
    });
  }

  // Notify specific user
  notifyUser(userId: string | number, notification: EmailNotification): void {
    if (!this.io) {
      console.warn('❌ Socket.io NOT initialized in RealTimeNotificationService!');
      return;
    }

    const stringUserId = String(userId);
    const userSockets = this.userSockets.get(stringUserId);
    const socketCount = userSockets?.size || 0;

    console.log(`📡 [SOCKET] Emitting ${notification.type} notification to user: ${stringUserId} (${socketCount} socket(s))`);

    this.io.to(`user_${stringUserId}`).emit('notification', notification);

    if (socketCount === 0) {
      console.warn(`⚠️ [SOCKET] User ${stringUserId} has no active sockets`);
    }
  }

  // Notify all connected users (admin broadcasts)
  notifyAll(notification: EmailNotification): void {
    if (!this.io) {
      console.warn('Socket.io not initialized, cannot send notification');
      return;
    }

    this.io.emit('notification', notification);

  }

  // Specific notification methods
  notifyNewEmail(userId: string, email: Email, accountInfo?: { id: string; email: string }): void {
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
  private extractSenderName(fromAddress: string): string {
    if (!fromAddress) return 'Unknown';
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
  private extractEmailAddress(fromAddress: string): string {
    if (!fromAddress) return '';
    const match = fromAddress.match(/<([^>]+)>/);
    return match && match[1] ? match[1] : fromAddress;
  }

  /**
   * Clean email snippet by removing HTML and extra whitespace
   */
  private cleanEmailSnippet(body: string, maxLength: number = 150): string {
    if (!body) return '';

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

  notifySyncStatus(userId: string, accountId: string, status: 'starting' | 'completed' | 'failed', details?: any): void {
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

  notifyError(userId: string, error: string, context?: any): void {
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

  notifyEmailOpened(userId: string, messageId: string, recipientEmail?: string, openCount?: number): void {
    console.log(`📬 [NOTIFY] Email opened - userId: ${userId}, messageId: ${messageId}, recipient: ${recipientEmail}, count: ${openCount}`);
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

  notifyEmailLinkClicked(userId: string, messageId: string, originalUrl: string, recipientEmail?: string, clickCount?: number): void {
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

  notifyEmailDelivered(userId: string, messageId: string, recipientEmail?: string): void {
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

  notifyEmailBounced(userId: string, messageId: string, recipientEmail?: string, reason?: string): void {
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
  getConnectionStats(): { totalConnections: number; uniqueUsers: number; userConnections: Record<string, number> } {
    const totalConnections = Array.from(this.userSockets.values())
      .reduce((total, socketIds) => total + socketIds.size, 0);

    const uniqueUsers = this.userSockets.size;

    const userConnections: Record<string, number> = {};
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
  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  // Disconnect all sockets for a user (useful for logout)
  disconnectUser(userId: string): void {
    if (!this.io || !this.userSockets.has(userId)) return;

    const socketIds = this.userSockets.get(userId)!;
    for (const socketId of socketIds) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
    }

    this.userSockets.delete(userId);

  }
}
