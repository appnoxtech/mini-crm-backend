import { Server as SocketIOServer } from 'socket.io';
import { Email } from '../models/types';

export interface EmailNotification {
  type: 'new_email' | 'email_sent' | 'sync_status' | 'error' | 'email_opened' | 'email_link_clicked' | 'email_delivered' | 'email_bounced' | 'email_status_changed';
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
      console.log('New socket connection:', socket.id);

      // Handle user authentication
      socket.on('authenticate', (userId: string) => {
        if (!userId) return;

        // Add socket to user's socket set
        if (!this.userSockets.has(userId)) {
          this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId)!.add(socket.id);

        socket.join(`user_${userId}`);
        console.log(`Socket ${socket.id} authenticated for user ${userId}`);

        // Send initial connection confirmation
        socket.emit('authenticated', { userId, timestamp: new Date() });
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
    console.log(`Email sync requested for account ${accountId} by user ${userId}`);
    
    // Notify user that sync is starting
    this.notifyUser(userId, {
      type: 'sync_status',
      data: { accountId, status: 'starting' },
      timestamp: new Date()
    });
  }

  // Notify specific user
  notifyUser(userId: string, notification: EmailNotification): void {
    if (!this.io) {
      console.warn('Socket.io not initialized, cannot send notification');
      return;
    }

    const userSockets = this.userSockets.get(userId);
    console.log(`🔔 Sending notification to user ${userId}:`, notification.type, 'to', userSockets?.size || 0, 'sockets');
    this.io.to(`user_${userId}`).emit('notification', notification);
    console.log(`✅ Notification sent to user ${userId}:`, notification.type);
  }

  // Notify all connected users (admin broadcasts)
  notifyAll(notification: EmailNotification): void {
    if (!this.io) {
      console.warn('Socket.io not initialized, cannot send notification');
      return;
    }

    this.io.emit('notification', notification);
    console.log('Broadcast notification sent:', notification.type);
  }

  // Specific notification methods
  notifyNewEmail(userId: string, email: Email): void {
    this.notifyUser(userId, {
      type: 'new_email',
      data: {
        id: email.id,
        from: email.from,
        subject: email.subject,
        receivedAt: email.receivedAt,
        isRead: email.isRead
      },
      timestamp: new Date()
    });
  }

  notifyEmailSent(userId: string, messageId: string, to: string[], subject: string): void {
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
    console.log(`Disconnected all sockets for user ${userId}`);
  }
}
