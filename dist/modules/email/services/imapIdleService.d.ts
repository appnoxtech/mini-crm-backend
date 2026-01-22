import { EmailAccount } from '../models/types';
import { EmailService } from './emailService';
import { RealTimeNotificationService } from './realTimeNotificationService';
/**
 * IMAP IDLE Service
 * Maintains persistent IMAP connections and listens for new emails in real-time
 * using the IMAP IDLE command.
 */
export declare class IMAPIdleService {
    private connections;
    private emailService;
    private notificationService;
    private isShuttingDown;
    private readonly MAX_RECONNECT_ATTEMPTS;
    private readonly RECONNECT_DELAY_MS;
    private readonly IDLE_TIMEOUT_MS;
    constructor();
    /**
     * Initialize the service with required dependencies
     */
    initialize(emailService: EmailService, notificationService: RealTimeNotificationService): void;
    /**
     * Start listening for new emails on an IMAP account
     */
    startListening(account: EmailAccount): Promise<boolean>;
    /**
     * Setup event handlers for IMAP client
     */
    private setupEventHandlers;
    /**
     * Start the IDLE loop for continuous listening
     */
    private startIdleLoop;
    /**
     * Handle new email detection
     */
    private handleNewEmail;
    /**
     * Handle disconnection and attempt reconnection
     */
    private handleDisconnect;
    /**
     * Stop listening for an account
     */
    stopListening(accountId: string): Promise<void>;
    /**
     * Stop all IMAP connections (for graceful shutdown)
     */
    stopAll(): Promise<void>;
    /**
     * Get status of all active connections
     */
    getStatus(): Array<{
        accountId: string;
        userId: string;
        isIdling: boolean;
        lastActivity: Date;
        reconnectAttempts: number;
    }>;
    /**
     * Check if an account is being monitored
     */
    isMonitoring(accountId: string): boolean;
    /**
     * Start monitoring all active IMAP accounts from database
     */
    startMonitoringAllAccounts(getActiveAccounts: () => Promise<EmailAccount[]>): Promise<void>;
    private delay;
}
export declare const imapIdleService: IMAPIdleService;
//# sourceMappingURL=imapIdleService.d.ts.map