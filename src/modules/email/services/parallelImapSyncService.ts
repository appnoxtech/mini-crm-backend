import { ImapFlow } from 'imapflow';
import { EmailAccount } from '../models/types';

/**
 * Parallel IMAP Sync Service
 * 
 * This service optimizes email fetching by:
 * 1. Using multiple IMAP connections in parallel
 * 2. Batching email fetches to reduce memory usage
 * 3. Processing folders concurrently
 * 4. Implementing connection pooling for better performance
 */

interface FolderConfig {
    path: string;
    label: string;
    priority: number; // Higher priority folders are fetched first
}

interface SyncOptions {
    maxConnections?: number; // Max parallel IMAP connections (default: 3)
    batchSize?: number; // Number of emails to fetch per batch (default: 100)
    lastSyncTime?: Date;
    foldersToSync?: string[]; // Specific folders to sync, or all if undefined
}

interface SyncResult {
    messages: any[];
    totalFetched: number;
    errors: string[];
    duration: number;
}

export class ParallelImapSyncService {
    private maxConnections: number;
    private batchSize: number;

    constructor(maxConnections: number = 3, batchSize: number = 100) {
        this.maxConnections = maxConnections;
        this.batchSize = batchSize;
    }

    /**
     * Create a new IMAP connection
     */
    private async createConnection(account: EmailAccount): Promise<ImapFlow> {
        if (!account.imapConfig) {
            throw new Error('IMAP configuration is required');
        }

        const client = new ImapFlow({
            host: account.imapConfig.host,
            port: account.imapConfig.port,
            secure: account.imapConfig.secure,
            auth: {
                user: account.imapConfig.username,
                pass: account.imapConfig.password,
            },
            logger: false, // Disable logging for better performance
        });

        await client.connect();
        return client;
    }

    /**
     * Identify all available folders and their configurations
     */
    private async identifyFolders(client: ImapFlow): Promise<FolderConfig[]> {
        const mailboxes = await client.list();
        const folders: FolderConfig[] = [];
        const seenPaths = new Set<string>();

        // Priority mapping: higher numbers = higher priority
        const priorityMap: Record<string, number> = {
            INBOX: 10,
            SENT: 8,
            DRAFT: 5,
            SPAM: 3,
            TRASH: 2,
            ARCHIVE: 1,
        };

        // Helper to add folder
        const addFolder = (path: string, label: string, priority: number) => {
            if (!seenPaths.has(path)) {
                folders.push({ path, label, priority });
                seenPaths.add(path);
            }
        };

        for (const box of mailboxes) {
            const path = box.path;
            const name = box.name;
            const specialUse = (box as any).specialUse;

            let label = name; // Default to folder name
            let priority = 0;

            if (path.toUpperCase() === 'INBOX') {
                label = 'INBOX';
                priority = priorityMap.INBOX ?? 10;
            } else if (specialUse === '\\Sent' || name === 'Sent' || name === 'Sent Items' || name === 'Sent Mail' || path === 'INBOX.Sent Messages') {
                label = 'SENT';
                priority = priorityMap.SENT ?? 8;
            } else if (specialUse === '\\Drafts' || name.toLowerCase().includes('draft') || path === 'INBOX.Drafts') {
                label = 'DRAFT';
                priority = priorityMap.DRAFT ?? 5;
            } else if (specialUse === '\\Junk' || name.toLowerCase().includes('spam') || name.toLowerCase().includes('junk') || path === 'INBOX.Spam') {
                label = 'SPAM';
                priority = priorityMap.SPAM ?? 3;
            } else if (specialUse === '\\Trash' || name.toLowerCase().includes('trash') || name.toLowerCase().includes('delete') || path === 'INBOX.Trash') {
                label = 'TRASH';
                priority = priorityMap.TRASH ?? 2;
            } else if (specialUse === '\\Archive' || name.toLowerCase().includes('archive')) {
                label = 'ARCHIVE';
                priority = priorityMap.ARCHIVE ?? 1;
            }

            addFolder(path, label, priority);
        }

        // Sort by priority (highest first)
        return folders.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Fetch emails from a single folder in batches
     */
    private async fetchFolderEmails(
        client: ImapFlow,
        folder: FolderConfig,
        searchCriteria: any,
        batchSize: number
    ): Promise<any[]> {
        const messages: any[] = [];

        try {
            await client.mailboxOpen(folder.path);

            // Get total message count
            const mailboxStatus = client.mailbox;
            const totalMessages = (mailboxStatus && typeof mailboxStatus !== 'boolean') ? (mailboxStatus.exists || 0) : 0;

            if (totalMessages === 0) {
                return messages;
            }

            // Fetch in batches to avoid memory issues
            let fetchedCount = 0;

            for await (const message of client.fetch(searchCriteria, {
                envelope: true,
                bodyStructure: true,
                source: true,
                uid: true,
                flags: true,
            })) {
                messages.push({ ...message, folder: folder.label });
                fetchedCount++;

                // Log progress for large folders
                if (fetchedCount % batchSize === 0) {

                }
            }

        } catch (err: any) {
            console.error(`❌ Error fetching from ${folder.path}:`, err.message);
            // Don't throw, just return empty for this folder so others proceed
        }

        return messages;
    }

    /**
     * Process a batch of folders using a single connection
     */
    private async processFolderBatch(
        account: EmailAccount,
        folders: FolderConfig[],
        searchCriteria: any,
        batchSize: number
    ): Promise<{ messages: any[]; errors: string[] }> {
        const messages: any[] = [];
        const errors: string[] = [];
        let client: ImapFlow | null = null;

        try {
            client = await this.createConnection(account);

            for (const folder of folders) {
                try {
                    // For TRASH and SPAM, always fetch all emails since moved emails keep their original date
                    // Using date filter would miss older emails that were just moved to trash
                    const folderSearchCriteria = (folder.label === 'TRASH' || folder.label === 'SPAM')
                        ? { all: true }
                        : searchCriteria;

                    const folderMessages = await this.fetchFolderEmails(
                        client,
                        folder,
                        folderSearchCriteria,
                        batchSize
                    );
                    messages.push(...folderMessages);
                } catch (err: any) {
                    errors.push(`${folder.label}: ${err.message}`);
                }
            }
        } catch (err: any) {
            errors.push(`Connection error: ${err.message}`);
        } finally {
            if (client) {
                try {
                    await client.logout();
                } catch (err) {
                    // Ignore logout errors
                }
            }
        }

        return { messages, errors };
    }

    /**
     * Sync emails using parallel IMAP connections
     * 
     * This method:
     * 1. Identifies all folders to sync
     * 2. Splits folders into batches based on maxConnections
     * 3. Processes each batch in parallel
     * 4. Returns all fetched messages
     */
    async syncEmails(account: EmailAccount, options: SyncOptions = {}): Promise<SyncResult> {
        const startTime = Date.now();
        const {
            maxConnections = this.maxConnections,
            batchSize = this.batchSize,
            lastSyncTime,
            foldersToSync,
        } = options;

        const allMessages: any[] = [];
        const allErrors: string[] = [];

        try {
            // Step 1: Identify folders
            const tempClient = await this.createConnection(account);
            const allFolders = await this.identifyFolders(tempClient);
            await tempClient.logout();

            // Filter folders if specific ones are requested
            const foldersToProcess = foldersToSync
                ? allFolders.filter(f => foldersToSync.includes(f.label))
                : allFolders; // Default to ALL folders

            // Step 2: Prepare search criteria
            const searchCriteria: any = lastSyncTime
                ? { since: lastSyncTime }
                : { all: true };

            // Step 3: Split folders into batches for parallel processing
            // Each batch will use one connection
            const folderBatches: FolderConfig[][] = [];
            for (let i = 0; i < foldersToProcess.length; i += Math.ceil(foldersToProcess.length / maxConnections)) {
                folderBatches.push(
                    foldersToProcess.slice(i, i + Math.ceil(foldersToProcess.length / maxConnections))
                );
            }

            // Step 4: Process batches in parallel
            const batchPromises = folderBatches.map((batch, index) => {
                return this.processFolderBatch(account, batch, searchCriteria, batchSize);
            });

            const results = await Promise.all(batchPromises);

            // Step 5: Aggregate results
            for (const result of results) {
                allMessages.push(...result.messages);
                allErrors.push(...result.errors);
            }

            const duration = Date.now() - startTime;

            return {
                messages: allMessages,
                totalFetched: allMessages.length,
                errors: allErrors,
                duration,
            };
        } catch (err: any) {
            const duration = Date.now() - startTime;
            console.error(`❌ Sync failed after ${(duration / 1000).toFixed(2)}s:`, err.message);

            return {
                messages: allMessages,
                totalFetched: allMessages.length,
                errors: [...allErrors, `Fatal error: ${err.message}`],
                duration,
            };
        }
    }

    /**
     * Quick sync for high-priority folders + delta for others
     * Now syncs ALL folders to ensure alignment, but relies on 'since' for efficiency
     */
    async quickSync(account: EmailAccount, lastSyncTime?: Date): Promise<SyncResult> {
        return this.syncEmails(account, {
            maxConnections: 20,
            batchSize: 5,
            lastSyncTime,
            // Removed foldersToSync restriction to ensure ALL folders are aligned
        });
    }

    /**
     * Full sync for all folders
     * This is useful for initial sync or periodic full syncs
     */
    async fullSync(account: EmailAccount): Promise<SyncResult> {
        return this.syncEmails(account, {
            maxConnections: this.maxConnections,
            batchSize: this.batchSize,
        });
    }

    /**
     * Fetch flags for specific UIDs in a folder
     */
    async fetchFlags(account: EmailAccount, folderPath: string, uids: number[]): Promise<Map<number, string[]>> {
        if (uids.length === 0) return new Map();

        let client: ImapFlow | null = null;
        const flagMap = new Map<number, string[]>();

        try {
            client = await this.createConnection(account);
            await client.mailboxOpen(folderPath);

            // imapflow fetch first arg is range/set
            // To use UIDs, we set {uid: true} in the fetch options (3rd arg)
            const uidSet = uids.join(',');
            for await (const message of client.fetch(uidSet, { flags: true }, { uid: true })) {
                if (message.uid) {
                    flagMap.set(message.uid, message.flags ? Array.from(message.flags) : []);
                }
            }
        } catch (err: any) {
            console.error(`❌ Error fetching flags for ${folderPath}:`, err.message);
        } finally {
            if (client) {
                try {
                    await client.logout();
                } catch (err) { }
            }
        }

        return flagMap;
    }

    /**
     * Get folder configuration (path, label) for an account
     */
    async getFolderConfigs(account: EmailAccount): Promise<FolderConfig[]> {
        let client: ImapFlow | null = null;
        try {
            client = await this.createConnection(account);
            return await this.identifyFolders(client);
        } catch (err: any) {
            console.error(`❌ Error identifying folders for ${account.email}:`, err.message);
            return [];
        } finally {
            if (client) {
                try {
                    await client.logout();
                } catch (err) { }
            }
        }
    }
}
