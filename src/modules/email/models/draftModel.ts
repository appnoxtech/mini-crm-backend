import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
    EmailDraft,
    CreateDraftInput,
    UpdateDraftInput,
    ListDraftsOptions,
} from './draftTypes';

/**
 * Draft Model - Handles all database operations for email drafts
 * Following first principles: CRUD operations with proper data validation
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
     * Principle: Generate ID at creation, validate required fields, set timestamps
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
     * Principle: User can only access their own drafts
     */
    async getDraftById(draftId: string, userId: string): Promise<EmailDraft | null> {
        const stmt = this.db.prepare(`
      SELECT * FROM email_drafts
      WHERE id = ? AND user_id = ?
    `);

        const row = stmt.get(draftId, userId) as any;
        if (!row) return null;

        return this.mapRowToDraft(row);
    }

    /**
     * List drafts with filtering and pagination
     * Principle: Support common query patterns (search, filter by account, scheduled)
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
        } = options;

        // Build WHERE clause dynamically
        const conditions: string[] = ['user_id = ?'];
        const params: any[] = [userId];

        if (accountId) {
            conditions.push('account_id = ?');
            params.push(accountId);
        }

        if (scheduledOnly) {
            conditions.push('is_scheduled = 1');
        }

        if (search) {
            conditions.push('(subject LIKE ? OR body LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        const whereClause = conditions.join(' AND ');

        // Get total count
        const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total FROM email_drafts
      WHERE ${whereClause}
    `);
        const { total } = countStmt.get(...params) as { total: number };

        // Get drafts
        const stmt = this.db.prepare(`
      SELECT * FROM email_drafts
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

        const rows = stmt.all(...params, limit, offset) as any[];
        const drafts = rows.map(row => this.mapRowToDraft(row));

        return { drafts, total };
    }

    /**
     * Update an existing draft
     * Principle: Only update provided fields, maintain updated_at timestamp
     */
    async updateDraft(
        draftId: string,
        userId: string,
        updates: UpdateDraftInput
    ): Promise<EmailDraft | null> {
        // First verify the draft exists and belongs to the user
        const existing = await this.getDraftById(draftId, userId);
        if (!existing) return null;

        const updateFields: string[] = [];
        const params: any[] = [];

        // Build dynamic UPDATE clause
        if (updates.to !== undefined) {
            updateFields.push('to_recipients = ?');
            params.push(JSON.stringify(updates.to));
        }
        if (updates.cc !== undefined) {
            updateFields.push('cc_recipients = ?');
            params.push(updates.cc ? JSON.stringify(updates.cc) : null);
        }
        if (updates.bcc !== undefined) {
            updateFields.push('bcc_recipients = ?');
            params.push(updates.bcc ? JSON.stringify(updates.bcc) : null);
        }
        if (updates.subject !== undefined) {
            updateFields.push('subject = ?');
            params.push(updates.subject);
        }
        if (updates.body !== undefined) {
            updateFields.push('body = ?');
            params.push(updates.body);
        }
        if (updates.htmlBody !== undefined) {
            updateFields.push('html_body = ?');
            params.push(updates.htmlBody);
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
    async deleteDraft(draftId: string, userId: string): Promise<boolean> {
        const stmt = this.db.prepare(`
      DELETE FROM email_drafts
      WHERE id = ? AND user_id = ?
    `);

        const result = stmt.run(draftId, userId);
        return result.changes > 0;
    }

    /**
     * Get scheduled drafts that are ready to send
     * Principle: Support scheduled sending feature
     */
    async getScheduledDraftsReadyToSend(): Promise<EmailDraft[]> {
        const now = new Date().toISOString();

        const stmt = this.db.prepare(`
      SELECT * FROM email_drafts
      WHERE is_scheduled = 1
        AND scheduled_for IS NOT NULL
        AND scheduled_for <= ?
      ORDER BY scheduled_for ASC
    `);

        const rows = stmt.all(now) as any[];
        return rows.map(row => this.mapRowToDraft(row));
    }

    /**
     * Helper: Map database row to EmailDraft object
     * Principle: Parse JSON fields and convert types appropriately
     */
    private mapRowToDraft(row: any): EmailDraft {
        return {
            id: row.id,
            accountId: row.account_id,
            userId: row.user_id,
            to: JSON.parse(row.to_recipients),
            cc: row.cc_recipients ? JSON.parse(row.cc_recipients) : undefined,
            bcc: row.bcc_recipients ? JSON.parse(row.bcc_recipients) : undefined,
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
