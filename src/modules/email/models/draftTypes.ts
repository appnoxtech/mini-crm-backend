import { EmailAttachment } from './types';

/**
 * Draft Email Type
 * Represents an email that has been composed but not yet sent
 */
export interface EmailDraft {
    id: string;
    accountId: string;
    userId: string;
    from?: string;

    // Email content
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    htmlBody?: string;

    // Attachments
    attachments?: EmailAttachment[];

    // Metadata
    replyToMessageId?: string;  // If this draft is a reply
    forwardFromMessageId?: string;  // If this draft is a forward
    threadId?: string;  // Thread this draft belongs to

    // CRM associations
    contactIds?: string[];
    dealIds?: string[];
    accountEntityIds?: string[];

    // Timestamps
    createdAt: Date;
    updatedAt: Date;

    // Metadata
    isScheduled?: boolean;
    scheduledFor?: Date;
    providerId?: string; // For Gmail/Outlook
    remoteUid?: string;  // For IMAP
    isTrashed?: boolean; // Whether this draft is in trash
}

/**
 * Input type for creating a new draft
 */
export interface CreateDraftInput {
    accountId: string;
    from?: string;
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
    isScheduled?: boolean;
    scheduledFor?: Date;
}

/**
 * Input type for updating an existing draft
 */
export interface UpdateDraftInput {
    from?: string;
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
    includeTrashed?: boolean;  // Include trashed drafts in results
}
