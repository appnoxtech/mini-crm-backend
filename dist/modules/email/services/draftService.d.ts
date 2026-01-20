import { DraftModel } from '../models/draftModel';
import { EmailService } from './emailService';
import { EmailDraft, CreateDraftInput, UpdateDraftInput, ListDraftsOptions } from '../models/draftTypes';
/**
 * Draft Service - Business logic layer for draft operations
 * Following first principles: Single responsibility, clear business rules
 */
export declare class DraftService {
    private draftModel;
    private emailService;
    constructor(draftModel: DraftModel, emailService: EmailService);
    /**
     * Create a new draft
     * Business rule: Validate email addresses and required fields
     */
    createDraft(userId: string, input: CreateDraftInput): Promise<EmailDraft>;
    /**
     * Get a draft by ID
     */
    getDraftById(draftId: string, userId: string): Promise<EmailDraft | null>;
    /**
     * List drafts with filtering
     */
    listDrafts(userId: string, options?: ListDraftsOptions): Promise<{
        drafts: EmailDraft[];
        total: number;
    }>;
    /**
     * Update an existing draft
     * Business rule: Validate changes before applying
     */
    updateDraft(draftId: string, userId: string, updates: UpdateDraftInput): Promise<EmailDraft | null>;
    /**
     * Delete a draft
     */
    deleteDraft(draftId: string, userId: string): Promise<boolean>;
    /**
     * Send a draft
     * Business rule: Convert draft to email and send it
     */
    sendDraft(draftId: string, userId: string): Promise<{
        success: boolean;
        emailId?: string;
        error?: string;
    }>;
    /**
     * Process scheduled drafts
     * Business rule: Check for scheduled drafts ready to send and send them
     */
    processScheduledDrafts(): Promise<{
        processed: number;
        errors: number;
    }>;
    /**
     * Helper: Validate email addresses
     */
    private validateEmailAddresses;
    /**
     * Duplicate a draft (create a copy)
     * Business rule: Create a new draft based on an existing one
     */
    duplicateDraft(draftId: string, userId: string): Promise<EmailDraft | null>;
}
//# sourceMappingURL=draftService.d.ts.map