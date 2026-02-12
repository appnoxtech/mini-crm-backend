import cron from 'node-cron';
import { prisma } from '../shared/prisma';
import { EmailModel } from '../modules/email/models/emailModel';
import { EmailConnectorService } from '../modules/email/services/emailConnectorService';
import { EmailService } from '../modules/email/services/emailService';
import { OAuthService } from '../modules/email/services/oauthService';
import { RealTimeNotificationService } from '../modules/email/services/realTimeNotificationService';
import { DealActivityModel } from '../modules/pipelines/models/DealActivity';

export function startEmailSyncJob(
    notificationService?: RealTimeNotificationService
) {
    const emailModel = new EmailModel();
    const dealActivityModel = new DealActivityModel();
    const oauthService = new OAuthService();
    const connectorService = new EmailConnectorService(oauthService);
    const emailService = new EmailService(emailModel, connectorService, notificationService, dealActivityModel);

    // Concurrency lock
    let isSyncRunning = false;

    const syncAllAccounts = async () => {
        if (isSyncRunning) {
            console.log('⚠️ Email sync skipped: Previous sync job still running.');
            return;
        }

        isSyncRunning = true;
        console.log('🔄 Starting automatic email sync...');

        try {
            // Get all active email accounts
            const accountRows = await prisma.emailAccount.findMany({
                where: { isActive: true }
            });

            console.log(`Found ${accountRows.length} active email accounts to sync`);

            for (const accountRow of accountRows) {
                try {
                    // Convert row to EmailAccount format
                    const account: any = {
                        id: accountRow.id,
                        userId: accountRow.userId.toString(),
                        email: accountRow.email,
                        provider: accountRow.provider,
                        accessToken: accountRow.accessToken || undefined,
                        refreshToken: accountRow.refreshToken || undefined,
                        imapConfig: accountRow.imapConfig ? JSON.parse(accountRow.imapConfig as string) : undefined,
                        smtpConfig: accountRow.smtpConfig ? JSON.parse(accountRow.smtpConfig as string) : undefined,
                        isActive: accountRow.isActive,
                        lastSyncAt: accountRow.lastSyncAt || undefined,
                        createdAt: accountRow.createdAt,
                        updatedAt: accountRow.updatedAt,
                    };

                    console.log(`Syncing emails for account: ${account.email} (${account.provider})`);

                    const result = await emailService.processIncomingEmails(account);
                    console.log(`✅ Synced ${result.processed} emails for ${account.email}, errors: ${result.errors}`);
                } catch (err: any) {
                    console.error(`❌ Failed to sync emails for account ${accountRow.email}:`, err.message);
                }
            }

            console.log('🔄 Automatic email sync completed');
        } catch (err: any) {
            console.error('❌ Email sync job failed:', err.message);
        } finally {
            isSyncRunning = false;
        }
    };

    // Schedule email sync every 15 seconds
    cron.schedule('*/15 * * * * *', syncAllAccounts);

    console.log('📧 Email sync cron job scheduled (every 15 seconds)');

    return syncAllAccounts;
}
