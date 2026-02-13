import { prisma } from '../../../shared/prisma';
import {
    EmailDraft,
    CreateDraftInput,
    UpdateDraftInput,
    ListDraftsOptions,
} from './draftTypes';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Draft Model - Handles all database operations for email drafts using Prisma
 */
export class DraftModel {
    constructor() { }

    /**
     * Initialize drafts table - No-op with Prisma
     */
    initialize(): void { }

    /**
     * Create a new draft
     */
    async createDraft(userId: string, input: CreateDraftInput): Promise<EmailDraft> {
        const id = uuidv4();

        const draftData: any = {
            id,
            accountId: input.accountId,
            userId: parseInt(userId),
            companyId: input.companyId,
            from: input.from || null,
            toRecipients: (input.to as any) || [],
            ccRecipients: (input.cc as any) || null,
            bccRecipients: (input.bcc as any) || null,
            subject: input.subject,
            body: input.body,
            htmlBody: input.htmlBody || null,
            attachments: (input.attachments as any) || null,
            replyToMessageId: input.replyToMessageId || null,
            forwardFromMessageId: input.forwardFromMessageId || null,
            threadId: input.threadId || null,
            contactIds: (input.contactIds as any) || null,
            dealIds: (input.dealIds as any) || null,
            accountEntityIds: (input.accountEntityIds as any) || null,
            isScheduled: input.isScheduled || false,
            scheduledFor: input.scheduledFor || null,
        };

        const draft = await prisma.emailDraft.create({
            data: draftData
        });

        return this.mapRowToDraft(draft);
    }

    /**
     * Get a draft by ID
     */
    async getDraftById(draftId: string, userId: string, companyId: number): Promise<EmailDraft | null> {
        const row = await prisma.emailDraft.findFirst({
            where: {
                id: draftId,
                userId: parseInt(userId),
                companyId
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
        companyId: number,
        options: ListDraftsOptions = {}
    ): Promise<{ drafts: EmailDraft[]; total: number }> {
        const {
            limit = 50,
            offset = 0,
            search,
            accountId,
            scheduledOnly = false,
            includeTrashed = false,
            trashedOnly = false,
        } = options;

        const where: any = {
            userId: parseInt(userId),
            companyId
        };

        // Filter by trash status
        if (trashedOnly) {
            where.isTrashed = true;
        } else if (!includeTrashed) {
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
        companyId: number,
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
        if (updates.providerDraftId !== undefined) data.providerId = updates.providerDraftId; // Map to providerId in schema

        try {
            const row = await prisma.emailDraft.update({
                where: {
                    id: draftId,
                    userId: parseInt(userId),
                    companyId
                },
                data
            });
            return this.mapRowToDraft(row);
        } catch (err) {
            console.error('Error updating draft:', err);
            return null;
        }
    }

    /**
     * Delete a draft permanently
     */
    async deleteDraft(draftId: string, userId: string, companyId: number): Promise<boolean> {
        try {
            await prisma.emailDraft.delete({
                where: {
                    id: draftId,
                    userId: parseInt(userId),
                    companyId
                }
            });
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * Move a draft to trash
     */
    async trashDraft(draftId: string, userId: string, companyId: number): Promise<EmailDraft | null> {
        try {
            const row = await prisma.emailDraft.update({
                where: {
                    id: draftId,
                    userId: parseInt(userId),
                    companyId
                },
                data: {
                    isTrashed: true
                }
            });
            return this.mapRowToDraft(row);
        } catch (err) {
            return null;
        }
    }

    /**
     * Trash multiple drafts (batch operation)
     */
    async trashDraftsBatch(draftIds: string[], userId: string, companyId: number): Promise<{ trashed: number; failed: number }> {
        const results = await Promise.all(draftIds.map(async (id) => {
            const success = await this.trashDraft(id, userId, companyId);
            return success ? 'trashed' : 'failed';
        }));

        return {
            trashed: results.filter(r => r === 'trashed').length,
            failed: results.filter(r => r === 'failed').length
        };
    }

    /**
     * Restore a draft from trash
     */
    async restoreDraftFromTrash(draftId: string, userId: string, companyId: number): Promise<EmailDraft | null> {
        try {
            const row = await prisma.emailDraft.update({
                where: {
                    id: draftId,
                    userId: parseInt(userId),
                    companyId
                },
                data: {
                    isTrashed: false
                }
            });
            return this.mapRowToDraft(row);
        } catch (err) {
            return null;
        }
    }

    /**
     * Get all trashed drafts
     */
    async getTrashedDrafts(userId: string, companyId: number, limit = 50, offset = 0): Promise<{ drafts: EmailDraft[]; total: number }> {
        return this.listDrafts(userId, companyId, { limit, offset, trashedOnly: true, scheduledOnly: false });
    }

    /**
     * Delete a trashed draft permanently (redundant with deleteDraft but kept for naming consistency)
     */
    async deleteTrashedDraft(draftId: string, userId: string, companyId: number): Promise<boolean> {
        return this.deleteDraft(draftId, userId, companyId);
    }

    /**
     * Permanently delete all trashed drafts for a user
     */
    async deleteAllTrashedDrafts(userId: string, companyId: number): Promise<{ deleted: number }> {
        try {
            const result = await prisma.emailDraft.deleteMany({
                where: {
                    userId: parseInt(userId),
                    companyId,
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
                },
                isTrashed: false
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
            companyId: row.companyId,
            to: (row.toRecipients as string[]) || [],
            cc: (row.ccRecipients as string[]) || undefined,
            bcc: (row.bccRecipients as string[]) || undefined,
            subject: row.subject,
            body: row.body,
            htmlBody: row.htmlBody || undefined,
            attachments: (row.attachments as any) || undefined,
            replyToMessageId: row.replyToMessageId || undefined,
            forwardFromMessageId: row.forwardFromMessageId || undefined,
            threadId: row.threadId || undefined,
            contactIds: (row.contactIds as any) || undefined,
            dealIds: (row.dealIds as any) || undefined,
            accountEntityIds: (row.accountEntityIds as any) || undefined,
            enableTracking: false,
            isScheduled: row.isScheduled,
            scheduledFor: row.scheduledFor ? new Date(row.scheduledFor) : undefined,
            providerDraftId: row.providerId || undefined,
            providerId: row.providerId || undefined,
            remoteUid: row.remoteUid || undefined,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
        };
    }
}
