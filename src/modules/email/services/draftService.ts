import { DraftModel } from '../models/draftModel';
import { EmailService } from './emailService';
import {
    EmailDraft,
    CreateDraftInput,
    UpdateDraftInput,
    ListDraftsOptions,
} from '../models/draftTypes';

/**
 * Draft Service - Business logic layer for draft operations
 * Following first principles: Single responsibility, clear business rules
 */
export class DraftService {
    constructor(
        private draftModel: DraftModel,
        private emailService: EmailService
    ) { }

    /**
     * Create a new draft
     * Business rule: Validate email addresses and required fields
     */
    async createDraft(userId: string, input: CreateDraftInput): Promise<EmailDraft> {
        // Validate required fields
        if (!input.to || input.to.length === 0) {
            throw new Error('At least one recipient is required');
        }

        if (!input.subject || input.subject.trim() === '') {
            throw new Error('Subject is required');
        }

        // Validate email addresses
        this.validateEmailAddresses(input.to, 'to');
        if (input.cc) this.validateEmailAddresses(input.cc, 'cc');
        if (input.bcc) this.validateEmailAddresses(input.bcc, 'bcc');

        // Validate scheduled date if provided
        if (input.isScheduled && input.scheduledFor) {
            const scheduledDate = new Date(input.scheduledFor);
            const now = new Date();

            if (scheduledDate <= now) {
                throw new Error('Scheduled time must be in the future');
            }
        }

        return this.draftModel.createDraft(userId, input);
    }

    /**
     * Get a draft by ID
     */
    async getDraftById(draftId: string, userId: string): Promise<EmailDraft | null> {
        return this.draftModel.getDraftById(draftId, userId);
    }

    /**
     * List drafts with filtering
     */
    async listDrafts(
        userId: string,
        options: ListDraftsOptions = {}
    ): Promise<{ drafts: EmailDraft[]; total: number }> {
        return this.draftModel.listDrafts(userId, options);
    }

    /**
     * Update an existing draft
     * Business rule: Validate changes before applying
     */
    async updateDraft(
        draftId: string,
        userId: string,
        updates: UpdateDraftInput
    ): Promise<EmailDraft | null> {
        // Validate email addresses if being updated
        if (updates.to) {
            if (updates.to.length === 0) {
                throw new Error('At least one recipient is required');
            }
            this.validateEmailAddresses(updates.to, 'to');
        }
        if (updates.cc) this.validateEmailAddresses(updates.cc, 'cc');
        if (updates.bcc) this.validateEmailAddresses(updates.bcc, 'bcc');

        // Validate subject if being updated
        if (updates.subject !== undefined && updates.subject.trim() === '') {
            throw new Error('Subject cannot be empty');
        }

        // Validate scheduled date if being updated
        if (updates.isScheduled && updates.scheduledFor) {
            const scheduledDate = new Date(updates.scheduledFor);
            const now = new Date();

            if (scheduledDate <= now) {
                throw new Error('Scheduled time must be in the future');
            }
        }

        return this.draftModel.updateDraft(draftId, userId, updates);
    }

    /**
     * Delete a draft
     */
    async deleteDraft(draftId: string, userId: string): Promise<boolean> {
        return this.draftModel.deleteDraft(draftId, userId);
    }

    /**
     * Send a draft
     * Business rule: Convert draft to email and send it
     */
    async sendDraft(draftId: string, userId: string): Promise<{ success: boolean; emailId?: string; error?: string }> {
        // Get the draft
        const draft = await this.draftModel.getDraftById(draftId, userId);
        if (!draft) {
            return { success: false, error: 'Draft not found' };
        }

        try {
            // Send the email using the email service
            const messageId = await this.emailService.sendEmail(
                draft.accountId,
                {
                    to: draft.to,
                    cc: draft.cc,
                    bcc: draft.bcc,
                    subject: draft.subject,
                    body: draft.body,
                    htmlBody: draft.htmlBody,
                    attachments: draft.attachments,
                }
            );

            // Delete the draft after successful send
            await this.draftModel.deleteDraft(draftId, userId);

            return { success: true, emailId: messageId };
        } catch (error: any) {
            return { success: false, error: error.message || 'Failed to send email' };
        }
    }

    /**
     * Process scheduled drafts
     * Business rule: Check for scheduled drafts ready to send and send them
     */
    async processScheduledDrafts(): Promise<{ processed: number; errors: number }> {
        const drafts = await this.draftModel.getScheduledDraftsReadyToSend();

        let processed = 0;
        let errors = 0;

        for (const draft of drafts) {
            const result = await this.sendDraft(draft.id, draft.userId);
            if (result.success) {
                processed++;
            } else {
                errors++;
                console.error(`Failed to send scheduled draft ${draft.id}:`, result.error);
            }
        }

        return { processed, errors };
    }

    /**
     * Helper: Validate email addresses
     */
    private validateEmailAddresses(emails: string[], field: string): void {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        for (const email of emails) {
            if (!emailRegex.test(email)) {
                throw new Error(`Invalid email address in ${field}: ${email}`);
            }
        }
    }

    /**
     * Duplicate a draft (create a copy)
     * Business rule: Create a new draft based on an existing one
     */
    async duplicateDraft(draftId: string, userId: string): Promise<EmailDraft | null> {
        const original = await this.draftModel.getDraftById(draftId, userId);
        if (!original) return null;

        const input: CreateDraftInput = {
            accountId: original.accountId,
            to: [...original.to],
            cc: original.cc ? [...original.cc] : undefined,
            bcc: original.bcc ? [...original.bcc] : undefined,
            subject: original.subject,
            body: original.body,
            htmlBody: original.htmlBody,
            attachments: original.attachments,
            contactIds: original.contactIds,
            dealIds: original.dealIds,
            accountEntityIds: original.accountEntityIds,
            enableTracking: original.enableTracking,
            // Don't copy scheduling info
            isScheduled: false,
            scheduledFor: undefined,
        };

        return this.draftModel.createDraft(userId, input);
    }
}
