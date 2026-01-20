"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startEmailSyncJob = startEmailSyncJob;
const node_cron_1 = __importDefault(require("node-cron"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const emailModel_1 = require("../modules/email/models/emailModel");
const emailConnectorService_1 = require("../modules/email/services/emailConnectorService");
const emailService_1 = require("../modules/email/services/emailService");
const oauthService_1 = require("../modules/email/services/oauthService");
function startEmailSyncJob(dbPath, notificationService) {
    const db = new better_sqlite3_1.default(dbPath);
    const emailModel = new emailModel_1.EmailModel(db);
    const oauthService = new oauthService_1.OAuthService();
    const connectorService = new emailConnectorService_1.EmailConnectorService(oauthService);
    const emailService = new emailService_1.EmailService(emailModel, connectorService, notificationService);
    const syncAllAccounts = async () => {
        console.log('🔄 Starting automatic email sync...');
        try {
            // Get all active email accounts
            const accounts = db.prepare(`
        SELECT * FROM email_accounts WHERE isActive = 1
      `).all();
            console.log(`Found ${accounts.length} active email accounts to sync`);
            for (const accountRow of accounts) {
                try {
                    // Convert row to EmailAccount format
                    const account = {
                        id: accountRow.id,
                        userId: accountRow.userId,
                        email: accountRow.email,
                        provider: accountRow.provider,
                        accessToken: accountRow.accessToken,
                        refreshToken: accountRow.refreshToken,
                        imapConfig: accountRow.imapConfig ? JSON.parse(accountRow.imapConfig) : undefined,
                        smtpConfig: accountRow.smtpConfig ? JSON.parse(accountRow.smtpConfig) : undefined,
                        isActive: Boolean(accountRow.isActive),
                        lastSyncAt: accountRow.lastSyncAt ? new Date(accountRow.lastSyncAt) : undefined,
                        createdAt: new Date(accountRow.createdAt),
                        updatedAt: new Date(accountRow.updatedAt),
                    };
                    console.log(`Syncing emails for account: ${account.email} (${account.provider})`);
                    const result = await emailService.processIncomingEmails(account);
                    console.log(`✅ Synced ${result.processed} emails for ${account.email}, errors: ${result.errors}`);
                    // Notify user if there are new emails
                    if (result.processed > 0 && notificationService) {
                        notificationService.notifySyncStatus(account.userId, account.id, 'completed');
                    }
                }
                catch (err) {
                    console.error(`❌ Failed to sync emails for account ${accountRow.email}:`, err.message);
                }
            }
            console.log('🔄 Automatic email sync completed');
        }
        catch (err) {
            console.error('❌ Email sync job failed:', err.message);
        }
    };
    // Schedule email sync every 5 minutes
    node_cron_1.default.schedule('*/5 * * * *', syncAllAccounts);
    console.log('📧 Email sync cron job scheduled (every 5 minutes)');
    return syncAllAccounts; // also allow manual invocation
}
//# sourceMappingURL=emailSync.js.map