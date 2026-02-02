import { EmailAttachment } from './types';

/**
 * Draft Email Type
 * Represents an email that has been composed but not yet sent
 */
export interface EmailDraft {
    id: string;
    accountId: string;
    userId: string;

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

    // Tracking
    enableTracking?: boolean;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;

    // Metadata
    isScheduled?: boolean;
    scheduledFor?: Date;

    // Provider sync
    providerDraftId?: string;
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
    // Provider sync
    providerDraftId?: string;
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
    // Provider sync
    providerDraftId?: string;
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
