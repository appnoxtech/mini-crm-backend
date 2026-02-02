import { prisma } from '../../../shared/prisma';
import {
    EmailDraft,
    CreateDraftInput,
    UpdateDraftInput,
    ListDraftsOptions,
} from './draftTypes';
import { Prisma } from '@prisma/client';

/**
 * Draft Model - Handles all database operations for email drafts using Prisma
 */
export class DraftModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    /**
     * Initialize drafts table
     * Design: Store drafts separately from emails for clear separation of concerns
     */
    initialize(): void {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS email_drafts (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        
        -- Provider Sync
        provider_draft_id TEXT,
        
        -- Recipients (stored as JSON arrays)
        to_recipients TEXT NOT NULL,
        cc_recipients TEXT,
        bcc_recipients TEXT,
        
        -- Content
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        html_body TEXT,
        
        -- Attachments (stored as JSON)
        attachments TEXT,
        
        -- Email threading
        reply_to_message_id TEXT,
        forward_from_message_id TEXT,
        thread_id TEXT,
        
        -- CRM associations (stored as JSON arrays)
        contact_ids TEXT,
        deal_ids TEXT,
        account_entity_ids TEXT,
        
        -- Tracking
        enable_tracking INTEGER DEFAULT 0,
        
        -- Scheduling
        is_scheduled INTEGER DEFAULT 0,
        scheduled_for TEXT,
        
        -- Timestamps
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        
        FOREIGN KEY (account_id) REFERENCES email_accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Indexes for efficient querying
      CREATE INDEX IF NOT EXISTS idx_email_drafts_user ON email_drafts(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_drafts_account ON email_drafts(account_id);
      CREATE INDEX IF NOT EXISTS idx_email_drafts_created ON email_drafts(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_email_drafts_scheduled ON email_drafts(is_scheduled, scheduled_for);
    `);
    }

    /**
     * Create a new draft
     */
    async createDraft(userId: string, input: CreateDraftInput): Promise<EmailDraft> {
        const id = uuidv4();
        const now = new Date().toISOString();

        const stmt = this.db.prepare(`
      INSERT INTO email_drafts (
        id, account_id, user_id, provider_draft_id,
        to_recipients, cc_recipients, bcc_recipients,
        subject, body, html_body,
        attachments,
        reply_to_message_id, forward_from_message_id, thread_id,
        contact_ids, deal_ids, account_entity_ids,
        enable_tracking,
        is_scheduled, scheduled_for,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?,
        ?, ?, ?,
        ?, ?, ?,
        ?,
        ?, ?,
        ?, ?
      )
    `);

        stmt.run(
            id,
            input.accountId,
            userId,
            input.providerDraftId || null,
            JSON.stringify(input.to),
            input.cc ? JSON.stringify(input.cc) : null,
            input.bcc ? JSON.stringify(input.bcc) : null,
            input.subject,
            input.body,
            input.htmlBody || null,
            input.attachments ? JSON.stringify(input.attachments) : null,
            input.replyToMessageId || null,
            input.forwardFromMessageId || null,
            input.threadId || null,
            input.contactIds ? JSON.stringify(input.contactIds) : null,
            input.dealIds ? JSON.stringify(input.dealIds) : null,
            input.accountEntityIds ? JSON.stringify(input.accountEntityIds) : null,
            input.enableTracking ? 1 : 0,
            input.isScheduled ? 1 : 0,
            input.scheduledFor ? input.scheduledFor.toISOString() : null,
            now,
            now
        );

        // Return the created draft
        return this.getDraftById(id, userId) as Promise<EmailDraft>;
    }

    /**
     * Get a draft by ID
     */
    async getDraftById(draftId: string, userId: string): Promise<EmailDraft | null> {
        const row = await prisma.emailDraft.findFirst({
            where: {
                id: draftId,
                userId: parseInt(userId)
            }
        });

        if (!row) return null;
        return this.mapRowToDraft(row);
    }

    /**
     * List drafts with filtering and pagination
     */
    async listDrafts(
        userId: string,
        options: ListDraftsOptions = {}
    ): Promise<{ drafts: EmailDraft[]; total: number }> {
        const {
            limit = 50,
            offset = 0,
            search,
            accountId,
            scheduledOnly = false,
            includeTrashed = false,
        } = options;

        const where: any = {
            userId: parseInt(userId)
        };

        // Exclude trashed drafts by default
        if (!includeTrashed) {
            where.isTrashed = false;
        }

        if (accountId) {
            where.accountId = accountId;
        }

        if (scheduledOnly) {
            where.isScheduled = true;
        }

        if (search) {
            where.OR = [
                { subject: { contains: search, mode: 'insensitive' } },
                { body: { contains: search, mode: 'insensitive' } }
            ];
        }

        const [drafts, total] = await Promise.all([
            prisma.emailDraft.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset
            }),
            prisma.emailDraft.count({ where })
        ]);

        return {
            drafts: drafts.map((row: any) => this.mapRowToDraft(row)),
            total
        };
    }

    /**
     * Update an existing draft
     */
    async updateDraft(
        draftId: string,
        userId: string,
        updates: UpdateDraftInput
    ): Promise<EmailDraft | null> {
        const data: any = {};

        if (updates.from !== undefined) data.from = updates.from || null;
        if (updates.to !== undefined) data.toRecipients = updates.to as any;
        if (updates.cc !== undefined) data.ccRecipients = (updates.cc as any) || null;
        if (updates.bcc !== undefined) data.bccRecipients = (updates.bcc as any) || null;
        if (updates.subject !== undefined) data.subject = updates.subject;
        if (updates.body !== undefined) data.body = updates.body;
        if (updates.htmlBody !== undefined) data.htmlBody = updates.htmlBody;
        if (updates.attachments !== undefined) data.attachments = (updates.attachments as any) || null;
        if (updates.contactIds !== undefined) data.contactIds = (updates.contactIds as any) || null;
        if (updates.dealIds !== undefined) data.dealIds = (updates.dealIds as any) || null;
        if (updates.accountEntityIds !== undefined) data.accountEntityIds = (updates.accountEntityIds as any) || null;
        if (updates.isScheduled !== undefined) data.isScheduled = updates.isScheduled;
        if (updates.scheduledFor !== undefined) data.scheduledFor = updates.scheduledFor;
        if ((updates as any).providerId !== undefined) data.providerId = (updates as any).providerId;
        if ((updates as any).remoteUid !== undefined) data.remoteUid = (updates as any).remoteUid;

        try {
            const row = await prisma.emailDraft.update({
                where: {
                    id: draftId,
                    userId: parseInt(userId)
                },
                data
            });
            return this.mapRowToDraft(row);
        } catch (err) {
            return null;
        }
        if (updates.attachments !== undefined) {
            updateFields.push('attachments = ?');
            params.push(updates.attachments ? JSON.stringify(updates.attachments) : null);
        }
        if (updates.contactIds !== undefined) {
            updateFields.push('contact_ids = ?');
            params.push(updates.contactIds ? JSON.stringify(updates.contactIds) : null);
        }
        if (updates.dealIds !== undefined) {
            updateFields.push('deal_ids = ?');
            params.push(updates.dealIds ? JSON.stringify(updates.dealIds) : null);
        }
        if (updates.accountEntityIds !== undefined) {
            updateFields.push('account_entity_ids = ?');
            params.push(updates.accountEntityIds ? JSON.stringify(updates.accountEntityIds) : null);
        }
        if (updates.enableTracking !== undefined) {
            updateFields.push('enable_tracking = ?');
            params.push(updates.enableTracking ? 1 : 0);
        }
        if (updates.isScheduled !== undefined) {
            updateFields.push('is_scheduled = ?');
            params.push(updates.isScheduled ? 1 : 0);
        }
        if (updates.scheduledFor !== undefined) {
            updateFields.push('scheduled_for = ?');
            params.push(updates.scheduledFor ? updates.scheduledFor.toISOString() : null);
        }
        if (updates.providerDraftId !== undefined) {
            updateFields.push('provider_draft_id = ?');
            params.push(updates.providerDraftId);
        }

        // Always update the updated_at timestamp
        updateFields.push('updated_at = ?');
        params.push(new Date().toISOString());

        // Add WHERE clause params
        params.push(draftId, userId);

        const stmt = this.db.prepare(`
      UPDATE email_drafts
      SET ${updateFields.join(', ')}
      WHERE id = ? AND user_id = ?
    `);

        stmt.run(...params);

        // Return the updated draft
        return this.getDraftById(draftId, userId);
    }

    /**
     * Delete a draft
     * Principle: Hard delete since drafts are not historical records
     */
    async deleteTrashedDraft(draftId: string, userId: string): Promise<boolean> {
        try {
            await prisma.emailDraft.delete({
                where: {
                    id: draftId,
                    userId: parseInt(userId),
                    isTrashed: true
                }
            });
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * Permanently delete all trashed drafts for a user
     */
    async deleteAllTrashedDrafts(userId: string): Promise<{ deleted: number }> {
        try {
            const result = await prisma.emailDraft.deleteMany({
                where: {
                    userId: parseInt(userId),
                    isTrashed: true
                }
            });
            return { deleted: result.count };
        } catch (err) {
            return { deleted: 0 };
        }
    }

    /**
     * Get scheduled drafts that are ready to send
     */
    async getScheduledDraftsReadyToSend(): Promise<EmailDraft[]> {
        const now = new Date();

        const rows = await prisma.emailDraft.findMany({
            where: {
                isScheduled: true,
                scheduledFor: {
                    lte: now
                }
            },
            orderBy: { scheduledFor: 'asc' }
        });

        return rows.map((row: any) => this.mapRowToDraft(row));
    }

    /**
     * Helper: Map Prisma row to EmailDraft object
     */
    private mapRowToDraft(row: any): EmailDraft {
        return {
            id: row.id,
            accountId: row.accountId,
            from: row.from || undefined,
            userId: row.userId.toString(),
            to: (row.toRecipients as string[]) || [],
            cc: (row.ccRecipients as string[]) || undefined,
            bcc: (row.bccRecipients as string[]) || undefined,
            subject: row.subject,
            body: row.body,
            htmlBody: row.html_body || undefined,
            attachments: row.attachments ? JSON.parse(row.attachments) : undefined,
            replyToMessageId: row.reply_to_message_id || undefined,
            forwardFromMessageId: row.forward_from_message_id || undefined,
            threadId: row.thread_id || undefined,
            contactIds: row.contact_ids ? JSON.parse(row.contact_ids) : undefined,
            dealIds: row.deal_ids ? JSON.parse(row.deal_ids) : undefined,
            accountEntityIds: row.account_entity_ids ? JSON.parse(row.account_entity_ids) : undefined,
            enableTracking: row.enable_tracking === 1,
            isScheduled: row.is_scheduled === 1,
            scheduledFor: row.scheduled_for ? new Date(row.scheduled_for) : undefined,
            providerDraftId: row.provider_draft_id || undefined,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
        };
    }
}
