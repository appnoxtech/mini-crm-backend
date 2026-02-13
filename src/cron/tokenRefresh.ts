import cron from 'node-cron';
import { prisma } from '../shared/prisma';
import { OAuthService } from '../modules/email/services/oauthService';
import { EmailModel } from '../modules/email/models/emailModel';

/**
 * Token Refresh Job
 * 
 * This cron job proactively refreshes OAuth tokens to prevent them from expiring.
 */
export function startTokenRefreshJob() {
    const emailModel = new EmailModel();
    const oauthService = new OAuthService();

    const refreshAllTokens = async () => {
        console.log('🔄 Starting proactive token refresh...');

        try {
            // Get all active OAuth email accounts
            const accounts = await prisma.emailAccount.findMany({
                where: {
                    isActive: true,
                    provider: { in: ['gmail', 'outlook'] },
                    refreshToken: { not: null }
                }
            });

            console.log(`Found ${accounts.length} OAuth accounts to refresh`);

            let refreshed = 0;
            let failed = 0;

            for (const accountRow of accounts) {
                try {
                    const account = {
                        id: accountRow.id,
                        userId: accountRow.userId,
                        companyId: accountRow.companyId,
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
                        await emailModel.updateEmailAccount(account.id, account.companyId, {
                            accessToken: oauthService.encryptToken(refreshResult.accessToken),
                            refreshToken: refreshResult.refreshToken
                                ? oauthService.encryptToken(refreshResult.refreshToken)
                                : accountRow.refreshToken || undefined,
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
                        await prisma.emailAccount.update({
                            where: { id: accountRow.id },
                            data: {
                                isActive: false,
                                updatedAt: new Date()
                            }
                        });
                    }
                }
            }

            console.log(`🔄 Token refresh completed. Refreshed: ${refreshed}, Failed: ${failed}`);
        } catch (err: any) {
            console.error('❌ Token refresh job failed:', err.message);
        }
    };

    // Schedule token refresh every 6 hours
    cron.schedule('0 */6 * * *', refreshAllTokens);

    // Also run immediately on startup
    setTimeout(refreshAllTokens, 5000);

    console.log('🔑 Token refresh cron job scheduled (every 6 hours)');

    return refreshAllTokens;
}
