import Database from 'better-sqlite3';
import { EmailDraft, CreateDraftInput, UpdateDraftInput, ListDraftsOptions } from './draftTypes';
/**
 * Draft Model - Handles all database operations for email drafts
 * Following first principles: CRUD operations with proper data validation
 */
export declare class DraftModel {
    private db;
    constructor(db: Database.Database);
    /**
     * Initialize drafts table
     * Design: Store drafts separately from emails for clear separation of concerns
     */
    initialize(): void;
    /**
     * Create a new draft
     * Principle: Generate ID at creation, validate required fields, set timestamps
     */
    createDraft(userId: string, input: CreateDraftInput): Promise<EmailDraft>;
    /**
     * Get a draft by ID
     * Principle: User can only access their own drafts
     */
    getDraftById(draftId: string, userId: string): Promise<EmailDraft | null>;
    /**
     * List drafts with filtering and pagination
     * Principle: Support common query patterns (search, filter by account, scheduled)
     */
    listDrafts(userId: string, options?: ListDraftsOptions): Promise<{
        drafts: EmailDraft[];
        total: number;
    }>;
    /**
     * Update an existing draft
     * Principle: Only update provided fields, maintain updated_at timestamp
     */
    updateDraft(draftId: string, userId: string, updates: UpdateDraftInput): Promise<EmailDraft | null>;
    /**
     * Delete a draft
     * Principle: Hard delete since drafts are not historical records
     */
    deleteDraft(draftId: string, userId: string): Promise<boolean>;
    /**
     * Get scheduled drafts that are ready to send
     * Principle: Support scheduled sending feature
     */
    getScheduledDraftsReadyToSend(): Promise<EmailDraft[]>;
    /**
     * Helper: Map database row to EmailDraft object
     * Principle: Parse JSON fields and convert types appropriately
     */
    private mapRowToDraft;
}
//# sourceMappingURL=draftModel.d.ts.map