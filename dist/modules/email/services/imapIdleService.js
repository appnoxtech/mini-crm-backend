"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.imapIdleService = exports.IMAPIdleService = void 0;
const imapflow_1 = require("imapflow");
/**
 * IMAP IDLE Service
 * Maintains persistent IMAP connections and listens for new emails in real-time
 * using the IMAP IDLE command.
 */
class IMAPIdleService {
    connections = new Map();
    emailService = null;
    notificationService = null;
    isShuttingDown = false;
    MAX_RECONNECT_ATTEMPTS = 5;
    RECONNECT_DELAY_MS = 5000;
    IDLE_TIMEOUT_MS = 25 * 60 * 1000; // 25 minutes (IMAP IDLE timeout is typically 29 mins)
    constructor() {
        // Services will be injected via initialize()
    }
    /**
     * Initialize the service with required dependencies
     */
    initialize(emailService, notificationService) {
        this.emailService = emailService;
        this.notificationService = notificationService;
        console.log('📧 IMAP IDLE Service initialized');
    }
    /**
     * Start listening for new emails on an IMAP account
     */
    async startListening(account) {
        if (!account.imapConfig) {
            console.warn(`Account ${account.id} has no IMAP config, skipping IDLE`);
            return false;
        }
        if (this.connections.has(account.id)) {
            console.log(`IMAP IDLE already active for account ${account.id}`);
            return true;
        }
        try {
            console.log(`🔌 Starting IMAP IDLE for account: ${account.email}`);
            const client = new imapflow_1.ImapFlow({
                host: account.imapConfig.host,
                port: account.imapConfig.port,
                secure: account.imapConfig.secure,
                auth: {
                    user: account.imapConfig.username,
                    pass: account.imapConfig.password
                },
                logger: false, // Disable verbose logging
                emitLogs: false
            });
            // Setup event handlers before connecting
            this.setupEventHandlers(client, account);
            await client.connect();
            console.log(`✅ IMAP connected for ${account.email}`);
            // Open INBOX and start IDLE
            const lock = await client.getMailboxLock('INBOX');
            const connection = {
                client,
                accountId: account.id,
                userId: account.userId,
                mailboxLock: lock,
                isIdling: false,
                reconnectAttempts: 0,
                lastActivity: new Date()
            };
            this.connections.set(account.id, connection);
            // Start the IDLE loop
            this.startIdleLoop(account.id, account);
            return true;
        }
        catch (error) {
            console.error(`❌ Failed to start IMAP IDLE for ${account.email}:`, error.message);
            return false;
        }
    }
    /**
     * Setup event handlers for IMAP client
     */
    setupEventHandlers(client, account) {
        // ImapFlow emits 'exists' when new messages arrive
        client.on('exists', async (data) => {
            console.log(`📬 New email detected in ${data.path} for ${account.email}! Count: ${data.prevCount} -> ${data.count}`);
            const connection = this.connections.get(account.id);
            if (connection) {
                connection.lastActivity = new Date();
            }
            // Fetch and process the new email(s)
            await this.handleNewEmail(account, data.count - data.prevCount);
        });
        // Use type assertion for events that may not be in the TypeScript definitions
        client.on('expunge', (data) => {
            console.log(`🗑️ Email deleted in ${data.path} for ${account.email}, seq: ${data.seq}`);
        });
        client.on('flags', (data) => {
            console.log(`🏷️ Flags changed for email in ${data.path} for ${account.email}`);
        });
        client.on('close', () => {
            console.log(`🔌 IMAP connection closed for ${account.email}`);
            if (!this.isShuttingDown) {
                this.handleDisconnect(account);
            }
        });
        client.on('error', (error) => {
            console.error(`❌ IMAP error for ${account.email}:`, error.message);
            if (!this.isShuttingDown) {
                this.handleDisconnect(account);
            }
        });
    }
    /**
     * Start the IDLE loop for continuous listening
     */
    async startIdleLoop(accountId, account) {
        const connection = this.connections.get(accountId);
        if (!connection || this.isShuttingDown)
            return;
        try {
            connection.isIdling = true;
            console.log(`🔄 Starting IDLE loop for ${account.email}`);
            // IDLE with timeout (must restart before IMAP server times out)
            while (this.connections.has(accountId) && !this.isShuttingDown) {
                try {
                    // ImapFlow handles IDLE internally, we just need to keep the connection alive
                    // The 'exists' event will fire when new emails arrive
                    await connection.client.idle();
                    // After IDLE returns (timeout or new mail), we can restart it
                    connection.lastActivity = new Date();
                    // Small delay before restarting IDLE
                    await this.delay(100);
                }
                catch (idleError) {
                    if (idleError.message?.includes('Not authenticated') ||
                        idleError.message?.includes('connection')) {
                        console.warn(`IDLE interrupted for ${account.email}, will reconnect`);
                        break;
                    }
                    console.error(`IDLE error for ${account.email}:`, idleError.message);
                    await this.delay(1000);
                }
            }
        }
        catch (error) {
            console.error(`IDLE loop error for ${account.email}:`, error.message);
        }
        finally {
            connection.isIdling = false;
        }
    }
    /**
     * Handle new email detection
     */
    async handleNewEmail(account, newCount) {
        if (!this.emailService || !this.notificationService) {
            console.warn('EmailService or NotificationService not initialized');
            return;
        }
        try {
            console.log(`📥 Processing ${newCount} new email(s) for ${account.email}`);
            // Trigger a quick sync to fetch the new emails
            const result = await this.emailService.processIncomingEmails(account);
            console.log(`✅ Processed ${result.newEmails} new emails for ${account.email}`);
            // Notifications are sent inside processIncomingEmails via notifyNewEmail
        }
        catch (error) {
            console.error(`Failed to process new email for ${account.email}:`, error.message);
            // Notify user of the error
            if (this.notificationService) {
                this.notificationService.notifyError(account.userId, `Failed to fetch new email: ${error.message}`, { accountId: account.id, accountEmail: account.email });
            }
        }
    }
    /**
     * Handle disconnection and attempt reconnection
     */
    async handleDisconnect(account) {
        const connection = this.connections.get(account.id);
        if (!connection)
            return;
        connection.reconnectAttempts++;
        if (connection.reconnectAttempts > this.MAX_RECONNECT_ATTEMPTS) {
            console.error(`❌ Max reconnect attempts reached for ${account.email}, giving up`);
            this.stopListening(account.id);
            // Notify user
            if (this.notificationService) {
                this.notificationService.notifyError(account.userId, `IMAP connection lost for ${account.email}. Please check your credentials.`, { accountId: account.id, code: 'IMAP_DISCONNECTED' });
            }
            return;
        }
        console.log(`🔄 Attempting to reconnect IMAP for ${account.email} (attempt ${connection.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
        await this.delay(this.RECONNECT_DELAY_MS * connection.reconnectAttempts);
        // Clean up old connection
        try {
            if (connection.mailboxLock) {
                connection.mailboxLock.release();
            }
            await connection.client.logout();
        }
        catch {
            // Ignore cleanup errors
        }
        this.connections.delete(account.id);
        // Try to reconnect
        const success = await this.startListening(account);
        if (success) {
            console.log(`✅ Successfully reconnected IMAP for ${account.email}`);
        }
    }
    /**
     * Stop listening for an account
     */
    async stopListening(accountId) {
        const connection = this.connections.get(accountId);
        if (!connection)
            return;
        console.log(`⏹️ Stopping IMAP IDLE for account ${accountId}`);
        try {
            if (connection.mailboxLock) {
                connection.mailboxLock.release();
            }
            await connection.client.logout();
        }
        catch (error) {
            console.error(`Error during IMAP cleanup for ${accountId}:`, error.message);
        }
        this.connections.delete(accountId);
    }
    /**
     * Stop all IMAP connections (for graceful shutdown)
     */
    async stopAll() {
        console.log('⏹️ Stopping all IMAP IDLE connections...');
        this.isShuttingDown = true;
        const stopPromises = Array.from(this.connections.keys()).map(id => this.stopListening(id));
        await Promise.all(stopPromises);
        console.log('✅ All IMAP IDLE connections stopped');
    }
    /**
     * Get status of all active connections
     */
    getStatus() {
        return Array.from(this.connections.values()).map(conn => ({
            accountId: conn.accountId,
            userId: conn.userId,
            isIdling: conn.isIdling,
            lastActivity: conn.lastActivity,
            reconnectAttempts: conn.reconnectAttempts
        }));
    }
    /**
     * Check if an account is being monitored
     */
    isMonitoring(accountId) {
        return this.connections.has(accountId);
    }
    /**
     * Start monitoring all active IMAP accounts from database
     */
    async startMonitoringAllAccounts(getActiveAccounts) {
        try {
            const accounts = await getActiveAccounts();
            const imapAccounts = accounts.filter(a => (a.provider === 'imap' || a.provider === 'custom') && a.imapConfig && a.isActive);
            console.log(`📧 Starting IMAP IDLE monitoring for ${imapAccounts.length} accounts`);
            for (const account of imapAccounts) {
                await this.startListening(account);
                // Small delay between connections to avoid overwhelming
                await this.delay(500);
            }
        }
        catch (error) {
            console.error('Failed to start monitoring all accounts:', error.message);
        }
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.IMAPIdleService = IMAPIdleService;
// Singleton instance
exports.imapIdleService = new IMAPIdleService();
//# sourceMappingURL=imapIdleService.js.map