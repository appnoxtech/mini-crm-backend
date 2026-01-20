import { EmailModel } from "../models/emailModel";
import { EmailConnectorService } from "./emailConnectorService";
import { Email, EmailAccount, EmailAttachment } from "../models/types";
import { RealTimeNotificationService } from "./realTimeNotificationService";
import { DealActivityModel } from "../../pipelines/models/DealActivity";
export declare class EmailService {
    private emailModel;
    private connectorService;
    private notificationService?;
    private activityModel?;
    constructor(emailModel: EmailModel, connectorService: EmailConnectorService, notificationService?: RealTimeNotificationService, activityModel?: DealActivityModel);
    getEmailModel(): EmailModel;
    /**
     * Test SMTP connection with provided configuration
     */
    testSmtpConnection(smtpConfig: {
        host: string;
        port: number;
        secure: boolean;
        username: string;
        password: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Test IMAP connection with provided configuration
     */
    testImapConnection(imapConfig: {
        host: string;
        port: number;
        secure: boolean;
        username: string;
        password: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    sendEmail(accountOrId: string | EmailAccount, emailData: {
        to: string[];
        cc?: string[];
        bcc?: string[];
        subject: string;
        body: string;
        htmlBody?: string;
        attachments?: EmailAttachment[];
        dealId?: number;
    }): Promise<string>;
    processIncomingEmails(account: EmailAccount): Promise<{
        processed: number;
        errors: number;
    }>;
    private processSingleEmail;
    private parseRawEmail;
    private determineEmailDirection;
    private determineGmailEmailDirection;
    private determineOutlookEmailDirection;
    private determineIMAPEmailDirection;
    private extractEmailFromAddress;
    private parseGmailMessage;
    private parseOutlookMessage;
    private parseIMAPMessage;
    private extractTextFromGmailPayload;
    private extractHtmlFromGmailPayload;
    private matchEmailWithCRMEntities;
    getEmailsForContact(contactId: string): Promise<Email[]>;
    getEmailsForDeal(dealId: string): Promise<Email[]>;
    getEmailAccountByUserId(userId: string): Promise<EmailAccount | null>;
    getEmailAccountByEmail(email: string): Promise<EmailAccount | null>;
    getEmailAccountById(accountId: string): Promise<EmailAccount | null>;
    createEmailAccount(account: EmailAccount): Promise<EmailAccount>;
    updateEmailAccount(accountId: string, updates: Partial<EmailAccount>): Promise<void>;
    getEmailAccounts(userId: string): Promise<EmailAccount[]>;
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
    getAllEmails(options?: {
        limit?: number;
    }): Promise<{
        emails: Email[];
        total: number;
    }>;
    getEmailById(emailId: string, userId: string): Promise<Email | null>;
    markEmailAsRead(emailId: string, userId: string, isRead: boolean): Promise<boolean>;
}
//# sourceMappingURL=emailService.d.ts.map