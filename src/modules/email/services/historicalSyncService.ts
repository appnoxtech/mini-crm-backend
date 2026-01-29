import { EmailModel } from '../models/emailModel';
import { EmailConnectorService } from './emailConnectorService';
import { RealTimeNotificationService } from './realTimeNotificationService';
import { Email, EmailAccount } from '../models/types';
import { simpleParser } from 'mailparser';

export class HistoricalSyncService {
    constructor(
        private emailModel: EmailModel,
        private connectorService: EmailConnectorService,
        private notificationService?: RealTimeNotificationService
    ) { }

    /**
     * Quick initial load: Fetch latest 100 emails immediately (for fast UI display)
     * Returns the emails so they can be shown to the user right away
     */
    async quickInitialLoad(account: EmailAccount): Promise<{ emails: Email[]; count: number }> {
        const resolvedFolders = await this.getResolvedFolders(account);
        const allEmails: Email[] = [];
        const QUICK_LIMIT = 50; // 50 per folder = 100 total

        console.log(`[QuickLoad] Fetching latest ${QUICK_LIMIT * 2} emails for ${account.email}`);

        for (const folderConfig of resolvedFolders) {
            const folder = folderConfig.path;
            try {
                const highestUid = await this.connectorService.getHighestUid(account, folder);
                if (highestUid <= 0) continue;

                // Fetch latest 50 UIDs (highestUid - 49 to highestUid)
                const startUid = Math.max(1, highestUid - QUICK_LIMIT + 1);
                const rawMessages = await this.connectorService.fetchEmailsByUidRange(account, folder, startUid, highestUid);

                for (const raw of rawMessages) {
                    try {
                        const parsed = await this.parseIMAPMessage(raw);
                        if (!parsed.messageId) continue;

                        const isIncoming = this.determineEmailDirection(parsed, account);
                        const email: Email = {
                            id: `${account.id}-${parsed.messageId}`,
                            messageId: parsed.messageId,
                            accountId: account.id,
                            from: parsed.from || '',
                            to: parsed.to || [],
                            subject: parsed.subject || '',
                            body: parsed.body || '',
                            htmlBody: parsed.htmlBody,
                            isRead: parsed.isRead ?? true,
                            isIncoming: isIncoming,
                            sentAt: parsed.sentAt || new Date(),
                            receivedAt: parsed.receivedAt || new Date(),
                            contactIds: [],
                            dealIds: [],
                            accountEntityIds: [],
                            opens: 0,
                            clicks: 0,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            uid: raw.uid,
                            folder: folder.toUpperCase(),
                            labelIds: [folder.toUpperCase()],
                            attachments: parsed.attachments || []
                        };

                        allEmails.push(email);
                    } catch (pError) {
                        console.error(`[QuickLoad] Error parsing message:`, pError);
                    }
                }

                // Update last synced UID for incremental sync later
                this.emailModel.updateLastSyncedUid(account.id, folder, highestUid);
            } catch (error) {
                console.error(`[QuickLoad] Error in folder ${folder}:`, error);
            }
        }

        // Bulk insert all fetched emails
        if (allEmails.length > 0) {
            this.emailModel.bulkCreateEmails(allEmails);
        }

        // Update lastSyncAt
        await this.emailModel.updateEmailAccount(account.id, {
            lastSyncAt: new Date(),
            updatedAt: new Date()
        });

        console.log(`[QuickLoad] Completed. Fetched ${allEmails.length} emails for ${account.email}`);
        return { emails: allEmails, count: allEmails.length };
    }

    /**
     * Full historical sync - runs in background, fetches ALL emails
     */
    async syncHistoricalEmails(account: EmailAccount): Promise<void> {
        const resolvedFolders = await this.getResolvedFolders(account);
        const userId = account.userId;
        const accountId = account.id;

        console.log(`[HistoricalSync] Starting FULL sync for ${account.email} on folders: ${resolvedFolders.map(f => f.path).join(', ')}`);

        if (this.notificationService) {
            this.notificationService.notifySyncStatus(userId, accountId, 'starting', {
                type: 'full_historical',
                folders: resolvedFolders.map(f => f.path)
            });
        }

        const stats = { totalFetched: 0, folderStats: {} as any };

        try {
            for (const folderConfig of resolvedFolders) {
                const folder = folderConfig.path;
                const folderStats = await this.syncFolderHistorical(account, folder);
                stats.totalFetched += folderStats.fetched;
                stats.folderStats[folder] = folderStats;
            }

            console.log(`[HistoricalSync] Completed for ${account.email}. Total: ${stats.totalFetched}`);

            if (this.notificationService) {
                this.notificationService.notifySyncStatus(userId, accountId, 'completed', stats);
            }

            await this.emailModel.updateEmailAccount(accountId, {
                lastSyncAt: new Date(),
                updatedAt: new Date()
            });

        } catch (error: any) {
            console.error(`[HistoricalSync] Failed for ${account.email}:`, error);
            if (this.notificationService) {
                this.notificationService.notifyError(userId, `Historical sync failed: ${error.message}`, { accountId });
            }
        }
    }

    private async syncFolderHistorical(account: EmailAccount, folder: string): Promise<{ fetched: number; errors: number }> {
        const BATCH_SIZE = 50;
        let fetchedCount = 0;
        let errorCount = 0;

        try {
            const highestUid = await this.connectorService.getHighestUid(account, folder);
            const lastSyncedUid = this.emailModel.getLastSyncedUid(account.id, folder) || 0;

            // Start from where quick load left off (go backwards from lastSyncedUid - 1 down to 1)
            let endUid = Math.max(0, lastSyncedUid - 1);

            if (endUid <= 0) {
                console.log(`[HistoricalSync] No historical emails to sync for ${folder}`);
                return { fetched: 0, errors: 0 };
            }

            while (endUid > 0) {
                const startUid = Math.max(1, endUid - BATCH_SIZE + 1);
                console.log(`[HistoricalSync] Fetching ${folder} UIDs ${startUid} to ${endUid}`);

                try {
                    const rawMessages = await this.connectorService.fetchEmailsByUidRange(account, folder, startUid, endUid);
                    const emailsToSave: Email[] = [];

                    for (const raw of rawMessages) {
                        try {
                            const parsed = await this.parseIMAPMessage(raw);
                            if (!parsed.messageId) continue;

                            const isIncoming = this.determineEmailDirection(parsed, account);
                            const email: Email = {
                                id: `${account.id}-${parsed.messageId}`,
                                messageId: parsed.messageId,
                                accountId: account.id,
                                from: parsed.from || '',
                                to: parsed.to || [],
                                subject: parsed.subject || '',
                                body: parsed.body || '',
                                htmlBody: parsed.htmlBody,
                                isRead: parsed.isRead ?? true,
                                isIncoming: isIncoming,
                                sentAt: parsed.sentAt || new Date(),
                                receivedAt: parsed.receivedAt || new Date(),
                                contactIds: [],
                                dealIds: [],
                                accountEntityIds: [],
                                opens: 0,
                                clicks: 0,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                                uid: raw.uid,
                                folder: folder.toUpperCase(),
                                labelIds: [folder.toUpperCase()],
                                attachments: parsed.attachments || []
                            };

                            emailsToSave.push(email);
                        } catch (pError) {
                            errorCount++;
                        }
                    }

                    if (emailsToSave.length > 0) {
                        this.emailModel.bulkCreateEmails(emailsToSave);
                        fetchedCount += emailsToSave.length;
                    }

                    // Progress notification
                    if (this.notificationService) {
                        this.notificationService.notifySyncStatus(account.userId, account.id, 'starting', {
                            folder,
                            processed: fetchedCount,
                            percentage: Math.round(((highestUid - startUid) / highestUid) * 100)
                        });
                    }

                } catch (fError) {
                    console.error(`[HistoricalSync] Batch error in ${folder}:`, fError);
                    errorCount++;
                }

                endUid = startUid - 1;
            }

            return { fetched: fetchedCount, errors: errorCount };
        } catch (error) {
            console.error(`[HistoricalSync] Fatal error in ${folder}:`, error);
            throw error;
        }
    }

    /**
     * Incremental sync using UIDs (for subsequent syncs)
     */
    async syncIncrementalByUid(account: EmailAccount): Promise<void> {
        const resolvedFolders = await this.getResolvedFolders(account);

        for (const folderConfig of resolvedFolders) {
            const folder = folderConfig.path;
            const lastUid = this.emailModel.getLastSyncedUid(account.id, folder) || 0;
            console.log(`[IncrementalSync] ${account.email} folder ${folder} since UID ${lastUid}`);

            const rawMessages = await this.connectorService.fetchEmailsIncrementalByUid(account, folder, lastUid);
            if (rawMessages.length === 0) continue;

            const emailsToSave: Email[] = [];
            let maxUid = lastUid;

            for (const raw of rawMessages) {
                const parsed = await this.parseIMAPMessage(raw);
                if (!parsed.messageId) continue;

                const isIncoming = this.determineEmailDirection(parsed, account);
                const email: Email = {
                    id: `${account.id}-${parsed.messageId}`,
                    messageId: parsed.messageId,
                    accountId: account.id,
                    from: parsed.from || '',
                    to: parsed.to || [],
                    subject: parsed.subject || '',
                    body: parsed.body || '',
                    isRead: parsed.isRead ?? true,
                    isIncoming: isIncoming,
                    sentAt: parsed.sentAt || new Date(),
                    receivedAt: parsed.receivedAt || new Date(),
                    contactIds: [],
                    dealIds: [],
                    accountEntityIds: [],
                    opens: 0,
                    clicks: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    uid: raw.uid,
                    folder: folder.toUpperCase()
                };

                emailsToSave.push(email);
                if (raw.uid > maxUid) maxUid = raw.uid;
            }

            if (emailsToSave.length > 0) {
                this.emailModel.bulkCreateEmails(emailsToSave);
                this.emailModel.updateLastSyncedUid(account.id, folder, maxUid);
            }
        }

        await this.emailModel.updateEmailAccount(account.id, {
            lastSyncAt: new Date(),
            updatedAt: new Date()
        });
    }

    // Helper methods
    private async parseIMAPMessage(message: any): Promise<Partial<Email>> {
        const source = message.source;
        let body = "";
        let htmlBody: string | undefined;
        let parsed: any = {};

        if (source) {
            try {
                const sourceData = Buffer.isBuffer(source) ? source : String(source);
                parsed = await simpleParser(sourceData);
                body = parsed.text || "";
                htmlBody = parsed.html || parsed.textAsHtml || undefined;
            } catch (err) {
                body = "Error parsing email content.";
            }
        }

        const from = parsed.from?.text || message.envelope?.from?.[0]?.address;
        const to = parsed.to?.value?.map((a: any) => a.name ? `${a.name} <${a.address}>` : a.address) ||
            (message.envelope?.to || []).map((a: any) => a.address);
        const subject = parsed.subject || message.envelope?.subject || "";
        const date = parsed.date || message.envelope?.date;

        let isRead = true;
        if (message.flags) {
            if (message.flags instanceof Set) {
                isRead = message.flags.has('\\Seen');
            } else if (Array.isArray(message.flags)) {
                isRead = message.flags.includes('\\Seen');
            }
        }

        return {
            messageId: parsed.messageId || message.envelope?.messageId,
            threadId: parsed.inReplyTo || undefined,
            from,
            to,
            subject,
            body,
            htmlBody,
            sentAt: date,
            receivedAt: date,
            isRead,
            folder: message.folder,
            labelIds: message.folder ? [message.folder] : [],
        } as any;
    }

    private determineEmailDirection(parsed: Partial<Email>, account: EmailAccount): boolean {
        const fromLower = (parsed.from || '').toLowerCase();
        if (fromLower.includes(account.email.toLowerCase())) return false;

        if (parsed.folder) {
            const folder = parsed.folder.toUpperCase();
            if (folder === 'SENT' || folder.includes('SENT')) return false;
        }

        return true;
    }

    private async getResolvedFolders(account: EmailAccount): Promise<{ path: string, label: string }[]> {
        // For Gmail/Outlook, we don't use this service or these methods yet as they have their own sync flows
        // But for IMAP, we need to find the real paths for INBOX and SENT
        if (account.provider !== 'imap' && account.provider !== 'custom') {
            return [
                { path: 'INBOX', label: 'INBOX' },
                { path: 'SENT', label: 'SENT' }
            ];
        }

        try {
            const configs = await this.connectorService.getIMAPFolderConfigs(account);
            const targetLabels = ['INBOX', 'SENT'];
            const resolved = configs.filter(c => targetLabels.includes(c.label));

            if (resolved.length > 0) {
                console.log(`[HistoricalSync] Resolved folders for ${account.email}:`, resolved.map(r => `${r.label}=>${r.path}`));
                return resolved;
            }
        } catch (error) {
            console.error(`[HistoricalSync] Failed to resolve IMAP folders:`, error);
        }

        // Fallback
        return [
            { path: 'INBOX', label: 'INBOX' },
            { path: 'SENT', label: 'SENT' }
        ];
    }
}
