import { ImapFlow } from 'imapflow';
import { EmailAccount, EmailAttachment } from '../models/types';
export declare class EmailConnectorService {
    private gmailClient;
    private outlookClient;
    private oauthService;
    constructor(oauthService?: any);
    connectGmail(account: EmailAccount): Promise<void>;
    connectOutlook(account: EmailAccount): Promise<void>;
    connectIMAP(account: EmailAccount): Promise<ImapFlow>;
    /**
     * Test SMTP connection with provided configuration
     * Used to validate credentials before saving an email account
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
     * Used to validate credentials before saving an email account
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
    fetchGmailEmails(account: EmailAccount, lastSyncTime?: Date, maxResults?: number): Promise<any[]>;
    fetchOutlookEmails(account: EmailAccount, lastSyncTime?: Date, maxResults?: number): Promise<any[]>;
    fetchIMAPEmails(account: EmailAccount, lastSyncTime?: Date): Promise<any[]>;
    private validateOAuthTokens;
    private verifyOAuthTokens;
    sendEmail(account: EmailAccount, emailData: {
        to: string[];
        cc?: string[];
        bcc?: string[];
        subject: string;
        body: string;
        htmlBody?: string;
        attachments?: EmailAttachment[];
    }): Promise<string>;
    private sendGmailEmailViaSMTP;
    private sendOutlookEmailViaSMTP;
    private sendGmailEmailViaAPI;
    private sendOutlookEmailViaAPI;
    private decryptTokenIfNeeded;
}
//# sourceMappingURL=emailConnectorService.d.ts.map