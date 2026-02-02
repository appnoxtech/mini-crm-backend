import cron from 'node-cron';
import { EmailModel } from '../modules/email/models/emailModel';
import { EmailService } from '../modules/email/services/emailService';
import { EmailConnectorService } from '../modules/email/services/emailConnectorService';
import { OAuthService } from '../modules/email/services/oauthService';

const TRASH_RETENTION_DAYS = 30;

/**
 * Trash Cleanup Job
 * 
 * Runs daily to permanently delete emails that have been in trash for more than 30 days.
 */
export function startTrashCleanupJob() {
    const emailModel = new EmailModel();
    const oauthService = new OAuthService();
    const connectorService = new EmailConnectorService(oauthService);
    const emailService = new EmailService(emailModel, connectorService);

    const cleanupOldTrashEmails = async () => {
        console.log(`[TrashCleanup] Starting cleanup of emails older than ${TRASH_RETENTION_DAYS} days...`);

        try {
            // Get old trash emails for logging and potential provider sync
            const oldTrashEmails = await emailModel.getTrashEmailsOlderThan(TRASH_RETENTION_DAYS);

            if (oldTrashEmails.length === 0) {
                console.log('[TrashCleanup] No old trash emails to clean up.');
                return;
            }

            console.log(`[TrashCleanup] Found ${oldTrashEmails.length} emails to permanently delete.`);

            let deletedCount = 0;
            let failCount = 0;

            // For each email, try to sync the permanent deletion to the provider
            for (const emailInfo of oldTrashEmails) {
                try {
                    // Use the service method which handles provider sync
                    await emailService.deleteEmailPermanently(emailInfo.emailId, emailInfo.userId);
                    deletedCount++;
                } catch (error) {
                    console.error(`[TrashCleanup] Failed to delete email ${emailInfo.emailId}:`, error);
                    failCount++;
                }
            }

            console.log(`[TrashCleanup] Completed. Successfully deleted: ${deletedCount}, Failed: ${failCount}`);

        } catch (error) {
            console.error('[TrashCleanup] Error during trash cleanup:', error);
        }
    };

    // Schedule to run every day at 2:00 AM
    cron.schedule('0 2 * * *', cleanupOldTrashEmails);

    // Run shortly after startup (1 minute)
    setTimeout(cleanupOldTrashEmails, 60000);

    console.log('[TrashCleanup] Trash cleanup cron job scheduled (Daily at 2:00 AM)');

    return cleanupOldTrashEmails;
}
