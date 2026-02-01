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

        const draft = await this.draftModel.createDraft(userId, input);
        console.log("DB Draft", draft);


        // Sync to provider
        try {
            const providerDraftId = await this.emailService.saveDraft(userId, input);
            if (providerDraftId) {
                await this.draftModel.updateDraft(draft.id, userId, { providerDraftId });
                // Update local object to return correct data
                draft.providerDraftId = providerDraftId;
            }
        } catch (error) {
            console.warn('Failed to sync draft to provider during creation:', error);
            // We continue even if sync fails, user still has local draft
        }

        return draft;
    }

    /**
     * Get a draft by ID
     */
    async getDraftById(draftId: string, userId: string): Promise<EmailDraft | null> {
        const draft = await this.draftModel.getDraftById(draftId, userId);
        if (draft) return draft;

        // Fallback: check if it's a synced draft in the Email table
        const email = await this.emailService.getEmailById(draftId, userId);
        if (email && (email.folder === 'DRAFT' || email.labelIds?.includes('SPAM'))) {
            // Map Email to EmailDraft structure
            return {
                id: email.id,
                accountId: email.accountId,
                userId: userId.toString(),
                to: email.to,
                cc: email.cc || [],
                bcc: email.bcc || [],
                subject: email.subject,
                body: email.body || '',
                htmlBody: email.htmlBody || undefined,
                attachments: email.attachments as any,
                replyToMessageId: undefined,
                forwardFromMessageId: undefined,
                threadId: email.threadId || undefined,
                contactIds: email.contactIds as any,
                dealIds: email.dealIds as any,
                accountEntityIds: email.accountEntityIds as any,
                isScheduled: false,
                scheduledFor: undefined,
                createdAt: new Date(email.createdAt),
                updatedAt: new Date(email.updatedAt),
                providerId: (email as any).providerId || undefined,
                remoteUid: (email as any).uid?.toString() || undefined
            };
        }

        return null;
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

        // Sync to provider
        try {
            // Need identifying info from original or updates
            // Need identifying info from original or updates
            // We need to pass the complete state to saveDraft usually, or at least enough to construct the email
            // We need to pass the complete state to saveDraft usually, or at least enough to construct the email
            // But emailService.saveDraft expects a specific shape. 
            // Let's refetch the draft after local update (or before) to get full data?
            // Actually, we haven't updated local yet. Let's update local first for consistency, 
            // then sync, then update providerId if changed.

            // Wait, if we update local first, then sync fails, we are fine (local is ahead).
            // But to sync, we need the merged data.

            // Let's optimize: Update local first.
            const localUpdated = await this.draftModel.updateDraft(draftId, userId, updates);
            if (!localUpdated) return null; // Should not happen as we checked existence

            // Now sync using the fresh local data
            // We need to construct the input expected by saveDraft
            const syncInput = {
                accountId: localUpdated.accountId,
                to: localUpdated.to,
                cc: localUpdated.cc,
                bcc: localUpdated.bcc,
                subject: localUpdated.subject,
                body: localUpdated.body,
                htmlBody: localUpdated.htmlBody,
                attachments: localUpdated.attachments
            };

            const providerDraftId = await this.emailService.saveDraft(
                userId,
                syncInput,
                localUpdated.providerDraftId
            );

            if (providerDraftId && providerDraftId !== localUpdated.providerDraftId) {
                await this.draftModel.updateDraft(draftId, userId, { providerDraftId });
                localUpdated.providerDraftId = providerDraftId;
            }

            return localUpdated;

        } catch (error) {
            console.warn('Failed to sync draft update to provider:', error);
            // Fallback: return the local update even if sync failed
            return this.draftModel.updateDraft(draftId, userId, updates);
        }
    }

    /**
     * Delete a draft
     */
    async deleteDraft(draftId: string, userId: string): Promise<boolean> {
        // Get draft first to find provider ID
        const draft = await this.draftModel.getDraftById(draftId, userId);

        if (draft && draft.providerDraftId) {
            try {
                await this.emailService.deleteDraftProvider(userId, draft.accountId, draft.providerDraftId);
            } catch (error) {
                console.warn('Failed to delete provider draft:', error);
                // Continue to delete local
            }
        }

        return this.draftModel.deleteDraft(draftId, userId);
    }

    /**
     * Trash a draft (soft delete)
     */
    async trashDraft(draftId: string, userId: string): Promise<EmailDraft | null> {
        const draft = await this.draftModel.trashDraft(draftId, userId);
        if (draft && (draft.remoteUid || draft.providerId)) {
            this.emailService.syncDraftTrashToProvider(draft, userId, true).catch(err => {
                console.error(`Failed to sync draft ${draftId} trash status to server:`, err);
            });
        }
        return draft;
    }

    /**
     * Trash multiple drafts (batch operation)
     */
    async trashDraftsBatch(draftIds: string[], userId: string): Promise<{ trashed: number; failed: number }> {
        // Get the drafts first to know which ones need server sync
        const drafts = await Promise.all(draftIds.map(id => this.draftModel.getDraftById(id, userId)));

        const result = await this.draftModel.trashDraftsBatch(draftIds, userId);

        // Sync each successfully trashed draft that has a remote presence
        for (const draft of drafts) {
            if (draft && (draft.remoteUid || draft.providerId)) {
                this.emailService.syncDraftTrashToProvider(draft, userId, true).catch(err => {
                    console.error(`Failed to sync batch draft ${draft.id} trash status to server:`, err);
                });
            }
        }

        return result;
    }

    /**
     * Restore a draft from trash
     */
    async restoreDraftFromTrash(draftId: string, userId: string): Promise<EmailDraft | null> {
        const draft = await this.draftModel.restoreDraftFromTrash(draftId, userId);
        if (draft && (draft.remoteUid || draft.providerId)) {
            this.emailService.syncDraftTrashToProvider(draft, userId, false).catch(err => {
                console.error(`Failed to sync draft ${draftId} restore status to server:`, err);
            });
        }
        return draft;
    }

    /**
     * Get all trashed drafts for a user
     */
    async getTrashedDrafts(userId: string, limit = 50, offset = 0): Promise<{ drafts: EmailDraft[]; total: number }> {
        return this.draftModel.getTrashedDrafts(userId, limit, offset);
    }

    /**
     * Permanently delete a trashed draft
     */
    async deleteTrashedDraft(draftId: string, userId: string): Promise<boolean> {
        // Delete from server first
        await this.emailService.deleteDraftFromServer(userId, draftId).catch(err => {
            console.warn(`Failed to delete trashed draft ${draftId} from server:`, err);
        });

        return this.draftModel.deleteTrashedDraft(draftId, userId);
    }

    /**
     * Permanently delete all trashed drafts
     */
    async deleteAllTrashedDrafts(userId: string): Promise<{ deleted: number }> {
        // Get all trashed drafts to delete from server
        // Using a high limit to get most of them; for thousands, pagination would be better but this covers most cases
        const { drafts } = await this.draftModel.getTrashedDrafts(userId, 1000, 0);

        // Delete from server
        for (const draft of drafts) {
            if (draft.remoteUid || draft.providerId) {
                await this.emailService.deleteDraftFromServer(userId, draft.id).catch(err => {
                    console.warn(`Failed to delete trashed draft ${draft.id} from server during empty trash:`, err);
                });
            }
        }

        return this.draftModel.deleteAllTrashedDrafts(userId);
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

            // Delete the draft from provider if it exists there
            if (draft.providerDraftId) {
                try {
                    await this.emailService.deleteDraftProvider(userId, draft.accountId, draft.providerDraftId);
                } catch (cleanupError) {
                    console.warn('Failed to cleanup provider draft after sending:', cleanupError);
                }
            }

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
            // Don't copy scheduling info
            isScheduled: false,
            scheduledFor: undefined,
        };

        return this.draftModel.createDraft(userId, input);
    }
}
