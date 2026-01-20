import { EmailAttachment } from './types';
/**
 * Draft Email Type
 * Represents an email that has been composed but not yet sent
 */
export interface EmailDraft {
    id: string;
    accountId: string;
    userId: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    htmlBody?: string;
    attachments?: EmailAttachment[];
    replyToMessageId?: string;
    forwardFromMessageId?: string;
    threadId?: string;
    contactIds?: string[];
    dealIds?: string[];
    accountEntityIds?: string[];
    enableTracking?: boolean;
    createdAt: Date;
    updatedAt: Date;
    isScheduled?: boolean;
    scheduledFor?: Date;
}
/**
 * Input type for creating a new draft
 */
export interface CreateDraftInput {
    accountId: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    htmlBody?: string;
    attachments?: EmailAttachment[];
    replyToMessageId?: string;
    forwardFromMessageId?: string;
    threadId?: string;
    contactIds?: string[];
    dealIds?: string[];
    accountEntityIds?: string[];
    enableTracking?: boolean;
    isScheduled?: boolean;
    scheduledFor?: Date;
}
/**
 * Input type for updating an existing draft
 */
export interface UpdateDraftInput {
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    body?: string;
    htmlBody?: string;
    attachments?: EmailAttachment[];
    contactIds?: string[];
    dealIds?: string[];
    accountEntityIds?: string[];
    enableTracking?: boolean;
    isScheduled?: boolean;
    scheduledFor?: Date;
}
/**
 * Options for listing drafts
 */
export interface ListDraftsOptions {
    limit?: number;
    offset?: number;
    search?: string;
    accountId?: string;
    scheduledOnly?: boolean;
}
//# sourceMappingURL=draftTypes.d.ts.map