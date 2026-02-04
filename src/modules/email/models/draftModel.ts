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
    constructor(_db?: any) { }

    /**
     * Create a new draft
     */
    async createDraft(userId: string, input: CreateDraftInput): Promise<EmailDraft> {
        const row = await prisma.emailDraft.create({
            data: {
                accountId: input.accountId,
                userId: parseInt(userId),
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
                providerId: null,
                remoteUid: null,
            } as any
        });

        return this.mapRowToDraft(row);
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
    }

    /**
     * Delete a draft
     */
    async deleteDraft(draftId: string, userId: string): Promise<boolean> {
        try {
            await prisma.emailDraft.delete({
                where: {
                    id: draftId,
                    userId: parseInt(userId)
                }
            });
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * Trash a draft (soft delete)
     */
    async trashDraft(draftId: string, userId: string): Promise<EmailDraft | null> {
        try {
            const row = await prisma.emailDraft.update({
                where: {
                    id: draftId,
                    userId: parseInt(userId)
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
    async trashDraftsBatch(draftIds: string[], userId: string): Promise<{ trashed: number; failed: number }> {
        try {
            const result = await prisma.emailDraft.updateMany({
                where: {
                    id: {
                        in: draftIds
                    },
                    userId: parseInt(userId)
                },
                data: {
                    isTrashed: true
                }
            });

            return {
                trashed: result.count,
                failed: draftIds.length - result.count
            };
        } catch (err) {
            return {
                trashed: 0,
                failed: draftIds.length
            };
        }
    }

    /**
     * Restore a draft from trash
     */
    async restoreDraftFromTrash(draftId: string, userId: string): Promise<EmailDraft | null> {
        try {
            const row = await prisma.emailDraft.update({
                where: {
                    id: draftId,
                    userId: parseInt(userId)
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
     * Get all trashed drafts for a user
     */
    async getTrashedDrafts(userId: string, limit = 50, offset = 0): Promise<{ drafts: EmailDraft[]; total: number }> {
        const [drafts, total] = await Promise.all([
            prisma.emailDraft.findMany({
                where: {
                    userId: parseInt(userId),
                    isTrashed: true
                },
                orderBy: { updatedAt: 'desc' },
                take: limit,
                skip: offset
            }),
            prisma.emailDraft.count({
                where: {
                    userId: parseInt(userId),
                    isTrashed: true
                }
            })
        ]);

        return {
            drafts: drafts.map((row: any) => this.mapRowToDraft(row)),
            total
        };
    }

    /**
     * Permanently delete trashed drafts
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
            htmlBody: row.htmlBody || undefined,
            attachments: (row.attachments as any) || undefined,
            replyToMessageId: row.replyToMessageId || undefined,
            forwardFromMessageId: row.forwardFromMessageId || undefined,
            threadId: row.threadId || undefined,
            contactIds: (row.contactIds as string[]) || undefined,
            dealIds: (row.dealIds as string[]) || undefined,
            accountEntityIds: (row.accountEntityIds as string[]) || undefined,
            isScheduled: row.isScheduled,
            scheduledFor: row.scheduledFor || undefined,
            providerId: row.providerId || undefined,
            remoteUid: row.remoteUid || undefined,
            isTrashed: row.isTrashed || false,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
}
