import Database from "better-sqlite3";
import { Email, EmailAccount, Contact, Deal } from "./types";
export declare class EmailModel {
    private db;
    constructor(db: Database.Database);
    initialize(): void;
    createEmail(email: Email): Promise<Email>;
    findEmailByMessageId(messageId: string): Promise<Email | null>;
    getEmailAccountById(accountId: string): Promise<EmailAccount | null>;
    getEmailAccountByUserId(userId: string): Promise<EmailAccount | null>;
    getEmailAccountByEmail(email: string): Promise<EmailAccount | null>;
    createEmailAccount(account: EmailAccount): Promise<EmailAccount>;
    updateEmailAccount(accountId: string, updates: Partial<EmailAccount>): Promise<void>;
    getAllActiveAccounts(): Promise<EmailAccount[]>;
    getEmailAccounts(userId: string): Promise<EmailAccount[]>;
    findContactsByEmails(emails: string[]): Promise<Contact[]>;
    saveThreadSummary(threadId: string, summary: string): Promise<void>;
    getThreadSummary(threadId: string): Promise<{
        summary: string;
        lastSummarizedAt: Date;
    } | null>;
    getThreadsNeedingSummary(): Promise<string[]>;
    findDealsByContactIds(contactIds: string[]): Promise<Deal[]>;
    getEmailsForContact(contactId: string): Promise<Email[]>;
    getEmailsForDeal(dealId: string): Promise<Email[]>;
    getAllEmails(options?: {
        limit?: number;
    }): Promise<{
        emails: Email[];
        total: number;
    }>;
    getEmailsForUser(userId: string, options?: {
        limit?: number;
        offset?: number;
        folder?: string;
        search?: string;
        unreadOnly?: boolean;
        accountId?: string;
    }): Promise<{
        emails: Email[];
        total: number;
    }>;
    getEmailById(emailId: string, userId: string): Promise<Email | null>;
    markEmailAsRead(emailId: string, userId: string, isRead: boolean): Promise<boolean>;
}
//# sourceMappingURL=emailModel.d.ts.map