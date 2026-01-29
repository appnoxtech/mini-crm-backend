import cron from 'node-cron';
import Database from 'better-sqlite3';
import { OAuthService } from '../modules/email/services/oauthService';
import { EmailModel } from '../modules/email/models/emailModel';

/**
 * Token Refresh Job
 * 
 * This cron job proactively refreshes OAuth tokens to prevent them from expiring.
 * Google OAuth refresh tokens can expire if:
 * 1. Not used for 6 months
 * 2. The app is in "testing" mode and hasn't been used for 7 days
 * 3. The user revokes access
 * 
 * By refreshing tokens regularly, we keep them active and prevent expiration.
 */
export function startTokenRefreshJob(dbPath: string) {
    const db = new Database(dbPath, { timeout: 10000 });
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    const emailModel = new EmailModel(db);
    const oauthService = new OAuthService();

    const refreshAllTokens = async () => {
        console.log('🔄 Starting proactive token refresh...');

        try {
            // Get all active OAuth email accounts
            const accounts = db.prepare(`
        SELECT * FROM email_accounts 
        WHERE isActive = 1 
        AND (provider = 'gmail' OR provider = 'outlook')
        AND refreshToken IS NOT NULL
      `).all() as any[];

            console.log(`Found ${accounts.length} OAuth accounts to refresh`);

            let refreshed = 0;
            let failed = 0;

            for (const accountRow of accounts) {
                try {
                    const account = {
                        id: accountRow.id,
                        userId: accountRow.userId,
                        email: accountRow.email,
                        provider: accountRow.provider,
                        accessToken: accountRow.accessToken,
                        refreshToken: accountRow.refreshToken,
                        isActive: Boolean(accountRow.isActive),
                    };

                    console.log(`Refreshing token for ${account.email}...`);

                    // Attempt to refresh the token
                    const refreshResult = await oauthService.refreshTokenIfNeeded(account as any);

                    if (refreshResult) {
                        // Update the account with new tokens
                        await emailModel.updateEmailAccount(account.id, {
                            accessToken: oauthService.encryptToken(refreshResult.accessToken),
                            refreshToken: refreshResult.refreshToken
                                ? oauthService.encryptToken(refreshResult.refreshToken)
                                : accountRow.refreshToken,
                            updatedAt: new Date(),
                        });

                        console.log(`✅ Token refreshed for ${account.email}`);
                        refreshed++;
                    } else {
                        console.log(`ℹ️ Token for ${account.email} doesn't need refresh yet`);
                    }
                } catch (err: any) {
                    console.error(`❌ Failed to refresh token for ${accountRow.email}:`, err.message);
                    failed++;

                    // If it's an invalid_grant error, mark the account as needing re-auth
                    if (err.message?.includes('invalid_grant') ||
                        err.response?.data?.error === 'invalid_grant') {
                        console.log(`⚠️ Account ${accountRow.email} needs re-authentication`);

                        // Update the account to indicate it needs re-auth
                        db.prepare(`
              UPDATE email_accounts 
              SET updatedAt = ?, isActive = 0 
              WHERE id = ?
            `).run(new Date().toISOString(), accountRow.id);
                    }
                }
            }

            console.log(`🔄 Token refresh completed. Refreshed: ${refreshed}, Failed: ${failed}`);
        } catch (err: any) {
            console.error('❌ Token refresh job failed:', err.message);
        }
    };

    // Schedule token refresh every 6 hours to keep tokens active
    // This is more frequent than the 7-day expiry, ensuring tokens stay fresh
    cron.schedule('0 */6 * * *', refreshAllTokens);

    // Also run immediately on startup to refresh any stale tokens
    setTimeout(refreshAllTokens, 5000); // Run 5 seconds after startup

    console.log('🔑 Token refresh cron job scheduled (every 6 hours)');

    return refreshAllTokens; // Allow manual invocation
}
