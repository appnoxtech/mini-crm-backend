import cron from 'node-cron';
import Database from 'better-sqlite3';
import { EmailModel } from '../modules/email/models/emailModel';
import { EmailConnectorService } from '../modules/email/services/emailConnectorService';
import { EmailService } from '../modules/email/services/emailService';
import { OAuthService } from '../modules/email/services/oauthService';
import { RealTimeNotificationService } from '../modules/email/services/realTimeNotificationService';

export function startEmailSyncJob(
    dbPath: string,
    notificationService?: RealTimeNotificationService
) {
    const db = new Database(dbPath);
    const emailModel = new EmailModel(db);
    const oauthService = new OAuthService();
    const connectorService = new EmailConnectorService(oauthService);
    const emailService = new EmailService(emailModel, connectorService, notificationService);

    const syncAllAccounts = async () => {
        console.log('🔄 Starting automatic email sync...');

        try {
            // Get all active email accounts
            const accounts = db.prepare(`
        SELECT * FROM email_accounts WHERE isActive = 1
      `).all() as any[];

            console.log(`Found ${accounts.length} active email accounts to sync`);

            for (const accountRow of accounts) {
                try {
                    // Convert row to EmailAccount format
                    const account: any = {
                        id: accountRow.id,
                        userId: accountRow.userId,
                        email: accountRow.email,
                        provider: accountRow.provider,
                        accessToken: accountRow.accessToken,
                        refreshToken: accountRow.refreshToken,
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
                } catch (err: any) {
                    console.error(`❌ Failed to sync emails for account ${accountRow.email}:`, err.message);
                }
            }

            console.log('🔄 Automatic email sync completed');
        } catch (err: any) {
            console.error('❌ Email sync job failed:', err.message);
        }
    };

    // Schedule email sync every 5 minutes
    cron.schedule('*/5 * * * *', syncAllAccounts);

    console.log('📧 Email sync cron job scheduled (every 5 minutes)');

    return syncAllAccounts; // also allow manual invocation
}
