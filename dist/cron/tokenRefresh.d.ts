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
export declare function startTokenRefreshJob(dbPath: string): () => Promise<void>;
//# sourceMappingURL=tokenRefresh.d.ts.map