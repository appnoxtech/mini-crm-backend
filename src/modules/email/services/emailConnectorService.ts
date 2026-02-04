import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer';
import { ImapFlow } from 'imapflow';
import { google } from 'googleapis';
import { EmailAccount, EmailAttachment } from '../models/types';
import { ParallelImapSyncService } from './parallelImapSyncService';
import { EmailModel } from '../models/emailModel';

export class EmailConnectorService {
  private gmailClient: any;
  private outlookClient: any;
  private oauthService: any;

  constructor(oauthService?: any) {
    this.gmailClient = null;
    this.outlookClient = null;
    this.oauthService = oauthService;
  }

  async connectGmail(account: EmailAccount): Promise<void> {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const creds: any = {};
    if (account.accessToken) {
      // Decrypt token if it's encrypted
      creds.access_token = this.decryptTokenIfNeeded(account.accessToken);
    }
    if (account.refreshToken !== undefined) {
      // Decrypt token if it's encrypted
      creds.refresh_token = account.refreshToken ? this.decryptTokenIfNeeded(account.refreshToken) : null;
    }
    auth.setCredentials(creds);
    this.gmailClient = google.gmail({ version: 'v1', auth });
  }

  async connectOutlook(account: EmailAccount): Promise<void> {
    // @ts-ignore types may not be present; runtime is sufficient
    const { Client } = await import('@microsoft/microsoft-graph-client');
    this.outlookClient = Client.init({
      authProvider: ({ scopes }: any) => Promise.resolve(account.accessToken as string)
    } as any);
  }

  async connectIMAP(account: EmailAccount): Promise<ImapFlow> {
    if (!account.imapConfig) {
      throw new Error('IMAP configuration is missing');
    }

    const client = new ImapFlow({
      host: account.imapConfig.host,
      port: account.imapConfig.port,
      secure: account.imapConfig.secure,
      auth: {
        user: account.imapConfig.username,
        pass: account.imapConfig.password
      }
    });

    await client.connect();
    return client;
  }

  /**
   * Test SMTP connection with provided configuration
   * Used to validate credentials before saving an email account
   */
  async testSmtpConnection(smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  }): Promise<{ success: boolean; message: string }> {
    try {


      const finalSmtpConfig = { ...smtpConfig };
      if (finalSmtpConfig.port === 465) {
        finalSmtpConfig.secure = true;
      }

      const transporter = nodemailer.createTransport({
        host: finalSmtpConfig.host,
        port: finalSmtpConfig.port,
        secure: finalSmtpConfig.secure,
        auth: {
          user: finalSmtpConfig.username,
          pass: finalSmtpConfig.password
        },
        connectionTimeout: 10000, // 10 second timeout
        greetingTimeout: 10000,
        socketTimeout: 10000
      });

      await transporter.verify();


      return {
        success: true,
        message: 'SMTP connection successful'
      };
    } catch (error: any) {
      console.error('SMTP connection test failed:', error);

      let message = 'SMTP connection failed';
      if (error.code === 'EAUTH') {
        message = 'Authentication failed. Please check your username and password.';
      } else if (error.code === 'ECONNREFUSED') {
        message = 'Connection refused. Please check the host and port.';
      } else if (error.code === 'ETIMEDOUT') {
        message = 'Connection timed out. Please check the host and port.';
      } else if (error.message) {
        message = error.message;
      }

      return {
        success: false,
        message
      };
    }
  }

  /**
   * Test IMAP connection with provided configuration
   * Used to validate credentials before saving an email account
   */
  async testImapConnection(imapConfig: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  }): Promise<{ success: boolean; message: string }> {
    let client: ImapFlow | null = null;

    try {


      client = new ImapFlow({
        host: imapConfig.host,
        port: imapConfig.port,
        secure: imapConfig.secure,
        auth: {
          user: imapConfig.username,
          pass: imapConfig.password
        },
        logger: false // Disable verbose logging for test
      });

      await client.connect();


      // Logout cleanly
      await client.logout();

      return {
        success: true,
        message: 'IMAP connection successful'
      };
    } catch (error: any) {
      console.error('IMAP connection test failed:', error);

      let message = 'IMAP connection failed';
      if (error.authenticationFailed) {
        message = 'Authentication failed. Please check your username and password.';
      } else if (error.code === 'ECONNREFUSED') {
        message = 'Connection refused. Please check the host and port.';
      } else if (error.code === 'ETIMEDOUT') {
        message = 'Connection timed out. Please check the host and port.';
      } else if (error.message) {
        message = error.message;
      }

      return {
        success: false,
        message
      };
    } finally {
      // Ensure cleanup
      if (client) {
        try {
          await client.logout();
        } catch {
          // Ignore logout errors during cleanup
        }
      }
    }
  }

  async fetchGmailEmails(account: EmailAccount, lastSyncTime?: Date, maxResults: number = 50): Promise<any[]> {
    try {
      await this.connectGmail(account);

      // Build query with proper boolean logic
      // Note: Gmail search uses AND by default between terms, OR must be explicit
      // The after: filter applies to ALL results, so we need proper grouping
      let query: string;

      if (lastSyncTime) {
        const timestamp = Math.floor(lastSyncTime.getTime() / 1000);
        // Use after: with is:anywhere to get all emails after the timestamp
        // This is more reliable than trying to OR multiple folders with a date filter
        query = `after:${timestamp}`;
      } else {
        // On initial sync, get emails from the last 30 days to avoid overwhelming the system
        const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
        query = `after:${thirtyDaysAgo}`;
      }



      const response = await this.gmailClient.users.messages.list({
        userId: 'me',
        q: query,
        maxResults
      });

      const messages: any[] = [];
      const messageIds = response.data.messages || [];

      // Batch fetch messages for better performance
      for (const message of messageIds) {
        try {
          const fullMessage = await this.fetchGmailMessageDetails(account.id, message.id);
          messages.push(fullMessage);
        } catch (error: any) {
          console.error(`Failed to fetch Gmail message ${message.id}:`, error);
          // Continue with other messages
        }
      }


      return messages;
    } catch (error: any) {
      console.error('Failed to fetch Gmail emails:', error);

      // Check for invalid_grant error (expired or revoked tokens)
      if (error.message?.includes('invalid_grant') ||
        error.response?.data?.error === 'invalid_grant') {
        throw new Error('Gmail authentication has expired. Please re-connect your Gmail account in settings.');
      }

      throw new Error(`Gmail email fetch failed: ${error.message}`);
    }
  }

  /**
   * Fetch specific archived emails (NOT INBOX, SPAM, TRASH)
   * This is used for initial sync or full resync of archives
   */
  async fetchArchivedGmailEmails(account: EmailAccount, maxResults: number = 50, pageToken?: string): Promise<{ messages: any[], nextPageToken?: string, newHistoryId?: string }> {
    try {
      await this.connectGmail(account);

      // Query for archived emails: Not in Inbox, Spam, or Trash
      const query = '-in:inbox -in:spam -in:trash';



      const response = await this.gmailClient.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
        pageToken
      });

      const messages: any[] = [];
      const messageList = response.data.messages || [];
      // Capture the current history ID from the list response to use for future incremental syncs
      // Getting it from list response is an approximation; ideally, we get profile, but this is often enough
      // To be safer, we can get profile history ID separate if needed, but list response usually doesn't return historyId directly
      // So let's get profile to be sure about the current state/checkpoint
      const profile = await this.gmailClient.users.getProfile({ userId: 'me' });
      const newHistoryId = profile.data.historyId;

      // Batch fetch messages
      for (const message of messageList) {
        try {
          const fullMessage = await this.fetchGmailMessageDetails(account.id, message.id);

          // Double check locally that it doesn't have INBOX label (API q should handle it, but good to be safe)
          const labelIds = fullMessage.labelIds || [];
          if (!labelIds.includes('INBOX') && !labelIds.includes('SPAM') && !labelIds.includes('TRASH')) {
            messages.push(fullMessage);
          }
        } catch (error: any) {
          console.error(`Failed to fetch Archived Gmail message ${message.id}:`, error);
        }
      }



      return {
        messages,
        nextPageToken: response.data.nextPageToken,
        newHistoryId
      };
    } catch (error: any) {
      console.error('Failed to fetch Archived Gmail emails:', error);
      throw error;
    }
  }

  /**
   * Fetch Gmail History (Incremental Sync)
   * Returns list of changes (added messages, label changes) since startHistoryId
   */
  async fetchGmailHistory(account: EmailAccount, startHistoryId: string): Promise<any> {
    try {
      await this.connectGmail(account);



      const response = await this.gmailClient.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded', 'labelAdded', 'labelRemoved']
      });

      const history = response.data.history || [];
      const newHistoryId = response.data.historyId; // The ID of the most recent change in this list



      return {
        history,
        newHistoryId
      };
    } catch (error: any) {
      // 404 error for historyId means it's too old -> requires full sync
      if (error.code === 404 || (error.message && error.message.includes('historyId'))) {
        throw new Error('HISTORY_EXPIRED');
      }
      console.error('Failed to fetch Gmail history:', error);
      throw error;
    }
  }

  async fetchGmailMessageDetails(accountId: string, messageId: string): Promise<any> {
    const fullMessage = await this.gmailClient.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    return {
      ...fullMessage.data,
      provider: 'gmail',
      accountId: accountId
    };
  }

  /**
   * Find Gmail message internal ID by RFC Message-ID
   */
  async findGmailMessageByRfcId(account: EmailAccount, messageId: string): Promise<string | null> {
    await this.connectGmail(account);
    const q = `rfc822msgid:${messageId}`;
    const response = await this.gmailClient.users.messages.list({
      userId: 'me',
      q,
      maxResults: 1
    });

    return response.data.messages?.[0]?.id || null;
  }

  /**
   * Find Outlook message internal ID by Internet Message-ID
   */
  async findOutlookMessageByRfcId(account: EmailAccount, messageId: string): Promise<string | null> {
    await this.connectOutlook(account);
    const response = await this.outlookClient.api('/me/messages')
      .filter(`internetMessageId eq '${messageId}'`)
      .select('id')
      .get();

    return response.value?.[0]?.id || null;
  }

  async fetchOutlookEmails(account: EmailAccount, lastSyncTime?: Date, maxResults: number = 50): Promise<any[]> {
    try {
      await this.connectOutlook(account);
      let filter = '';

      if (lastSyncTime) {
        filter = `receivedDateTime ge ${lastSyncTime.toISOString()}`;
      }



      let query = this.outlookClient.api('/me/messages').top(maxResults);
      if (filter) {
        query = query.filter(filter);
      }

      const response = await query.get();
      const messages = response.value.map((message: any) => ({
        ...message,
        provider: 'outlook',
        accountId: account.id
      }));


      return messages;
    } catch (error: any) {
      console.error('Failed to fetch Outlook emails:', error);
      throw new Error(`Outlook email fetch failed: ${error.message}`);
    }
  }

  async fetchIMAPEmails(account: EmailAccount, lastSyncTime?: Date): Promise<any[]> {
    const client = await this.connectIMAP(account);
    const messages: any[] = [];
    const searchCriteria: any = lastSyncTime ? { since: lastSyncTime } : { all: true };

    try {
      // 1. Fetch from INBOX
      await client.mailboxOpen('INBOX');
      for await (const message of client.fetch(searchCriteria, {
        envelope: true,
        bodyStructure: true,
        source: true
      })) {
        messages.push({ ...message, folder: 'INBOX' });
      }

      // 2. Identify and Fetch from Sent Folder
      let sentFolder = 'Sent'; // Default guess
      const mailboxes = await client.list();

      const sentBox = mailboxes.find((box: any) =>
        (box.specialUse === '\\Sent' || box.name === 'Sent' || box.name === 'Sent Items' || box.name === 'Sent Mail')
      );

      if (sentBox) {
        sentFolder = sentBox.path;


        try {
          await client.mailboxOpen(sentFolder);
          for await (const message of client.fetch(searchCriteria, {
            envelope: true,
            bodyStructure: true,
            source: true
          })) {
            messages.push({ ...message, folder: 'SENT' });
          }
        } catch (err) {
          console.warn(`Failed to fetch from Sent folder (${sentFolder}):`, err);
        }
      } else {
        console.warn('Could not identify Sent folder via IMAP list.');
        // Try common fallback
        try {
          await client.mailboxOpen('Sent Items');
          for await (const message of client.fetch(searchCriteria, {
            envelope: true,
            bodyStructure: true,
            source: true
          })) {
            messages.push({ ...message, folder: 'SENT' });
          }
        } catch (e) {
          // Ignore fallback error
        }
      }

      // 3. Identify and Fetch from Drafts Folder
      const draftBox = mailboxes.find((box: any) =>
        (box.specialUse === '\\Drafts' || box.name.toLowerCase().includes('draft'))
      );
      if (draftBox) {
        try {
          await client.mailboxOpen(draftBox.path);
          for await (const message of client.fetch(searchCriteria, {
            envelope: true,
            bodyStructure: true,
            source: true
          })) {
            messages.push({ ...message, folder: 'DRAFT' });
          }
        } catch (err) {
          console.warn(`Failed to fetch from Drafts folder (${draftBox.path}):`, err);
        }
      }

      // 4. Identify and Fetch from Junk/Spam Folder
      const spamBox = mailboxes.find((box: any) =>
        (box.specialUse === '\\Junk' || box.name.toLowerCase().includes('spam') || box.name.toLowerCase().includes('junk'))
      );
      if (spamBox) {
        try {
          await client.mailboxOpen(spamBox.path);
          for await (const message of client.fetch(searchCriteria, {
            envelope: true,
            bodyStructure: true,
            source: true
          })) {
            messages.push({ ...message, folder: 'SPAM' });
          }
        } catch (err) {
          console.warn(`Failed to fetch from Spam folder (${spamBox.path}):`, err);
        }
      }

      // 5. Identify and Fetch from Trash Folder
      const trashBox = mailboxes.find((box: any) =>
        (box.specialUse === '\\Trash' || box.name.toLowerCase().includes('trash') || box.name.toLowerCase().includes('delete'))
      );
      if (trashBox) {
        try {
          await client.mailboxOpen(trashBox.path);
          for await (const message of client.fetch(searchCriteria, {
            envelope: true,
            bodyStructure: true,
            source: true
          })) {
            messages.push({ ...message, folder: 'TRASH' });
          }
        } catch (err) {
          console.warn(`Failed to fetch from Trash folder (${trashBox.path}):`, err);
        }
      }

      // 6. Identify and Fetch from Archive Folder
      const archiveBox = mailboxes.find((box: any) =>
        (box.specialUse === '\\Archive' || box.name.toLowerCase() === 'archive' || box.name.toLowerCase() === 'archived' || box.name.toLowerCase() === 'archives')
      );
      if (archiveBox) {
        try {
          await client.mailboxOpen(archiveBox.path);
          for await (const message of client.fetch(searchCriteria, {
            envelope: true,
            bodyStructure: true,
            source: true
          })) {
            messages.push({ ...message, folder: 'ARCHIVE' });
          }
        } catch (err) {
          console.warn(`Failed to fetch from Archive folder (${archiveBox.path}):`, err);
        }
      }

    } catch (err) {
      console.error('Error during IMAP fetch:', err);
      throw err;
    } finally {
      await client.logout();
    }

    return messages;
  }

  /**
   * Fetch IMAP emails using parallel connections for better performance
   * This method uses multiple IMAP connections to fetch emails from different folders concurrently
   * 
   * @param account - Email account with IMAP configuration
   * @param lastSyncTime - Optional timestamp to fetch only emails since last sync
   * @param useQuickSync - If true, only syncs INBOX and SENT folders (default: false)
   * @returns Array of email messages with folder labels
   */
  async fetchIMAPEmailsParallel(
    account: EmailAccount,
    lastSyncTime?: Date,
    useQuickSync: boolean = false
  ): Promise<any[]> {
    const parallelSync = new ParallelImapSyncService(
      5,  // Max 3 parallel connections
      50 // Batch size of 100 emails
    );

    try {
      let result;

      if (useQuickSync) {
        // Quick sync: only INBOX and SENT folders

        result = await parallelSync.quickSync(account, lastSyncTime);
      } else {
        // Full sync: all folders

        result = await parallelSync.syncEmails(account, {
          maxConnections: 3,
          batchSize: 100,
          lastSyncTime,
        });
      }

      if (result.errors.length > 0) {
        console.warn(`⚠️ Parallel sync completed with ${result.errors.length} errors:`, result);
      }



      return result.messages;
    } catch (error: any) {
      console.error('Parallel IMAP sync failed:', error);
      throw new Error(`Parallel IMAP sync failed: ${error.message}`);
    }
  }

  // Validate OAuth tokens before sending email
  private async validateOAuthTokens(account: EmailAccount): Promise<boolean> {
    if (account.provider === 'gmail') {
      try {
        // Try to refresh tokens to validate they're still valid
        if (!this.oauthService) {
          const { OAuthService } = require('./oauthService');
          this.oauthService = new OAuthService();
        }

        const refreshResult = await this.oauthService.refreshTokenIfNeeded(account);
        if (refreshResult) {

          return true;
        }
        return false;
      } catch (error) {
        console.error('OAuth token validation failed:', error);
        return false;
      }
    }
    return true; // For non-OAuth providers, assume valid
  }

  // Verify OAuth tokens by making a test API call
  private async verifyOAuthTokens(account: EmailAccount): Promise<boolean> {
    if (account.provider === 'gmail') {
      try {
        const auth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );

        const decryptedAccessToken = this.decryptTokenIfNeeded(account.accessToken || '');
        const decryptedRefreshToken = this.decryptTokenIfNeeded(account.refreshToken || '');

        auth.setCredentials({
          access_token: decryptedAccessToken,
          refresh_token: decryptedRefreshToken
        });

        // Make a simple API call to verify the token
        const gmail = google.gmail({ version: 'v1', auth });
        await gmail.users.getProfile({ userId: 'me' });


        return true;
      } catch (error) {
        console.error('OAuth token verification failed:', error);
        return false;
      }
    }
    return true; // For non-OAuth providers, assume valid
  }

  async sendEmail(account: EmailAccount, emailData: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    htmlBody?: string;
    attachments?: EmailAttachment[];
    enableTracking?: boolean;
    emailId?: string;
  }): Promise<string> {
    // Inject tracking if enabled - convert to HTML if needed
    if (emailData.enableTracking && emailData.emailId) {
      // If no htmlBody is provided, create one from the text body
      if (!emailData.htmlBody && emailData.body) {
        emailData.htmlBody = `<div style="font-family: Arial, sans-serif;"><div>${emailData.body.replace(/\n/g, '<br />')}</div></div>`;
      }

      // Now inject tracking into the HTML body
      if (emailData.htmlBody) {
        emailData.htmlBody = this.injectTracking(emailData.htmlBody, emailData.emailId);
      }
    }
    // Validate required fields
    if (!emailData.to || emailData.to.length === 0) {
      throw new Error('At least one recipient is required');
    }

    // Validate and verify OAuth tokens before attempting to send
    try {
      const tokensValid = await this.validateOAuthTokens(account);
      if (!tokensValid) {
        throw new Error('OAuth tokens are invalid or expired. Please re-authenticate your email account.');
      }

      // Additional verification for Gmail accounts
      if (account.provider === 'gmail') {
        const tokensVerified = await this.verifyOAuthTokens(account);
        if (!tokensVerified) {
          throw new Error('OAuth tokens could not be verified. Please re-authenticate your Gmail account.');
        }
      }
    } catch (error: any) {
      // If token validation fails, provide specific guidance
      if (error.message.includes('Token has been expired or revoked') ||
        error.message.includes('invalid_grant') ||
        error.message.includes('re-authorize')) {
        throw new Error(`Your ${account.provider} account needs to be re-authenticated. Please go to the email setup page and reconnect your account. The previous authorization has expired or been revoked.`);
      }
      throw error;
    }

    if (!emailData.subject || !emailData.body) {
      throw new Error('Subject and body are required');
    }

    // Handle OAuth accounts with SMTP and API fallback
    if (account.accessToken) {
      if (account.provider === 'gmail') {
        return await this.sendGmailEmailViaSMTP(account, emailData);
      } else if (account.provider === 'outlook') {
        return await this.sendOutlookEmailViaSMTP(account, emailData);
      }
    }

    // Handle SMTP accounts
    if (!account.smtpConfig) {
      throw new Error('SMTP configuration is missing for this email account');
    }



    const smtpConfig = { ...account.smtpConfig };

    // Smart detection: port 465 is almost always SMTPS (secure: true)
    if (smtpConfig.port === 465) {
      smtpConfig.secure = true;
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.username,
        pass: smtpConfig.password
      },
      connectionTimeout: 10000, // 10 second timeout
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false // Only for development/testing
      }
    });

    // Verify SMTP connection
    try {
      await transporter.verify();

    } catch (error: any) {
      console.error('SMTP connection verification failed:', error);
      throw new Error(`SMTP connection failed: ${error.message}`);
    }

    const mailOptions: any = {
      from: account.email,
      to: emailData.to.join(', '),
      cc: emailData.cc?.join(', '),
      bcc: emailData.bcc?.join(', '),
      subject: emailData.subject,
      text: emailData.body,
      html: emailData.htmlBody,
      attachments: emailData.attachments?.map(att => {
        // Common properties
        const attachment: any = {
          filename: att.filename,
          contentType: att.contentType
        };

        // Only add CID if it is explicitly provided and not empty
        if (att.contentId && att.contentId.trim().length > 0) {
          attachment.cid = att.contentId;
        }

        // Support both URL-based and base64-encoded attachments
        if (att.content) {
          // Base64 encoded content
          attachment.content = att.content;
          attachment.encoding = att.encoding || 'base64';
        } else if (att.url) {
          // URL-based attachment (fetch from S3, etc.)
          attachment.path = att.url;
        } else {
          // Skip invalid attachments
          return undefined;
        }

        return attachment;
      }).filter((att): att is NonNullable<typeof att> => att !== undefined)
    };



    try {
      const result = await transporter.sendMail(mailOptions);

      // For custom IMAP/SMTP accounts, we need to manually append the sent email to the "Sent" folder
      if (account.provider === 'custom' || (!['gmail', 'outlook'].includes(account.provider) && account.imapConfig)) {
        try {
          const composer = new MailComposer(mailOptions);
          const messageBuffer = await composer.compile().build();

          const client = await this.connectIMAP(account);

          // Prevent crash on error
          client.on('error', (err) => {
            console.error('IMAP Client Error during append:', err);
          });

          if (!client.usable) {
            await client.connect();
          }

          // Try to find the Sent folder
          let sentPath = 'Sent';
          const specialUse = (client.mailbox as any)?.specialUse || {};
          // ImapFlow might map special use folders

          // Simple heuristic for now: try standard names if special use isn't clear
          // Or just default to 'Sent' and handle error/fallback?
          // Let's try to list folders to find a "Sent" one if we want to be fancy, 
          // but for now, 'Sent' is safe for most. 'INBOX.Sent' is another. 
          // Better: use ImapFlow's capability if available, otherwise default 'Sent'.

          // Actually, ImapFlow doesn't explicitly expose a simple "getSentFolder" helper without listing.
          // We'll try 'Sent' first.

          const lock = await client.getMailboxLock(sentPath);
          try {
            await client.append(sentPath, messageBuffer, ['\\Seen']);
          } finally {
            lock.release();
          }

          await client.logout();
        } catch (appendError) {
          console.error('Failed to append sent email to IMAP Sent folder:', appendError);
          // We intentionally don't throw here to avoid failing the send operation 
          // just because sync failed. The email was sent successfully via SMTP.
        }
      }

      return result.messageId as string;
    } catch (error: any) {
      console.error('Failed to send email:', error);
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  private async sendGmailEmailViaSMTP(account: EmailAccount, emailData: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    htmlBody?: string;
    attachments?: EmailAttachment[];
  }): Promise<string> {


    try {
      // Debug token information
      const decryptedRefreshToken = this.decryptTokenIfNeeded(account.refreshToken || '');
      const decryptedAccessToken = this.decryptTokenIfNeeded(account.accessToken || '');




      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: account.email,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: decryptedRefreshToken,
          accessToken: decryptedAccessToken
        }
      });

      // Test the SMTP connection before sending

      try {
        await transporter.verify();

      } catch (verifyError: any) {
        console.error('SMTP connection verification failed:', verifyError);
        throw new Error(`SMTP connection failed: ${verifyError.message}`);
      }

      const mailOptions: any = {
        from: account.email,
        to: emailData.to.join(', '),
        cc: emailData.cc?.join(', '),
        bcc: emailData.bcc?.join(', '),
        subject: emailData.subject,
        text: emailData.body,
        html: emailData.htmlBody,
        attachments: emailData.attachments?.map(att => {
          // Common properties
          const attachment: any = {
            filename: att.filename,
            contentType: att.contentType
          };

          // Only add CID if it is explicitly provided and not empty
          if (att.contentId && att.contentId.trim().length > 0) {
            attachment.cid = att.contentId;
          }

          // Support both URL-based and base64-encoded attachments (same as Gmail API)
          if (att.content) {
            attachment.content = att.content;
            attachment.encoding = att.encoding || 'base64';
          } else if (att.url) {
            attachment.path = att.url;
          } else {
            return undefined;
          }

          return attachment;
        }).filter((att): att is NonNullable<typeof att> => att !== undefined)
      };

      const result = await transporter.sendMail(mailOptions);

      return result.messageId as string;
    } catch (error: any) {
      console.error('Failed to send Gmail SMTP email:', error);

      // Check if it's a token-related error
      if (error.message.includes('invalid_request') ||
        error.message.includes('invalid_grant') ||
        error.message.includes('token') ||
        error.code === 'EAUTH') {

        // Try to refresh tokens before giving up
        try {

          if (!this.oauthService) {
            const { OAuthService } = require('./oauthService');
            this.oauthService = new OAuthService();
          }

          const refreshResult = await this.oauthService.refreshTokenIfNeeded(account);
          if (refreshResult) {


            const emailModel = new EmailModel();

            await emailModel.updateEmailAccount(account.id, {
              accessToken: refreshResult.accessToken,
              refreshToken: refreshResult.refreshToken || account.refreshToken,
              updatedAt: new Date()
            });

            // Retry with new tokens - create a new transporter with fresh tokens

            const updatedAccount = {
              ...account,
              accessToken: refreshResult.accessToken,
              refreshToken: refreshResult.refreshToken || account.refreshToken
            };

            // Create a new transporter with the refreshed tokens
            const refreshedTransporter = nodemailer.createTransport({
              service: 'gmail',
              auth: {
                type: 'OAuth2',
                user: updatedAccount.email,
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                refreshToken: this.decryptTokenIfNeeded(updatedAccount.refreshToken || ''),
                accessToken: this.decryptTokenIfNeeded(updatedAccount.accessToken || '')
              }
            });

            // Test the refreshed SMTP connection

            try {
              await refreshedTransporter.verify();

            } catch (verifyError: any) {
              console.error('Refreshed SMTP connection verification failed:', verifyError);
              throw new Error(`Refreshed SMTP connection failed: ${verifyError.message}`);
            }

            const mailOptions = {
              from: updatedAccount.email,
              to: emailData.to.join(', '),
              cc: emailData.cc?.join(', '),
              bcc: emailData.bcc?.join(', '),
              subject: emailData.subject,
              text: emailData.body,
              html: emailData.htmlBody,
              attachments: emailData.attachments?.map(att => ({
                filename: att.filename,
                path: att.url
              }))
            };

            const result = await refreshedTransporter.sendMail(mailOptions);

            return result.messageId as string;
          }
        } catch (refreshError: any) {
          console.error('Token refresh failed:', refreshError);
          // If refresh fails, the user needs to re-authenticate
          throw new Error('OAuth tokens are invalid or expired. Please re-authenticate your Gmail account by going to the email setup page.');
        }

        throw new Error('OAuth tokens are invalid or expired. Please re-authenticate your Gmail account.');
      }

      // Fallback to API method
      return await this.sendGmailEmailViaAPI(account, emailData);
    }
  }

  private async sendOutlookEmailViaSMTP(account: EmailAccount, emailData: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    htmlBody?: string;
    attachments?: EmailAttachment[];
  }): Promise<string> {


    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        auth: {
          type: 'OAuth2',
          user: account.email,
          clientId: process.env.MICROSOFT_CLIENT_ID,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
          refreshToken: this.decryptTokenIfNeeded(account.refreshToken || ''),
          accessToken: this.decryptTokenIfNeeded(account.accessToken || '')
        }
      });

      const mailOptions = {
        from: account.email,
        to: emailData.to.join(', '),
        cc: emailData.cc?.join(', '),
        bcc: emailData.bcc?.join(', '),
        subject: emailData.subject,
        text: emailData.body,
        html: emailData.htmlBody,
        attachments: emailData.attachments?.map(att => ({
          filename: att.filename,
          path: att.url
        }))
      };

      const result = await transporter.sendMail(mailOptions);

      return result.messageId as string;
    } catch (error: any) {
      console.error('Failed to send Outlook SMTP email:', error);
      // Fallback to API method
      return await this.sendOutlookEmailViaAPI(account, emailData);
    }
  }

  private async sendGmailEmailViaAPI(account: EmailAccount, emailData: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    htmlBody?: string;
    attachments?: EmailAttachment[];
  }): Promise<string> {
    await this.connectGmail(account);

    // Create RFC 2822 formatted email message
    const emailLines = [
      `From: ${account.email}`,
      `To: ${emailData.to.join(', ')}`,
      ...(emailData.cc ? [`Cc: ${emailData.cc.join(', ')}`] : []),
      ...(emailData.bcc ? [`Bcc: ${emailData.bcc.join(', ')}`] : []),
      `Subject: ${emailData.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: ${emailData.htmlBody ? 'text/html' : 'text/plain'}; charset=utf-8`,
      '',
      emailData.htmlBody || emailData.body
    ];

    const rawMessage = emailLines.join('\r\n');
    const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

    try {
      const response = await this.gmailClient.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });


      return response.data.id;
    } catch (error: any) {
      console.error('Failed to send Gmail email:', error);

      // Check if it's a token-related error
      if (error.message.includes('invalid_request') ||
        error.message.includes('invalid_grant') ||
        error.message.includes('token') ||
        error.code === 401) {

        // Try to refresh tokens before giving up
        try {

          if (!this.oauthService) {
            const { OAuthService } = require('./oauthService');
            this.oauthService = new OAuthService();
          }

          const refreshResult = await this.oauthService.refreshTokenIfNeeded(account);
          if (refreshResult) {


            const emailModel = new EmailModel();

            await emailModel.updateEmailAccount(account.id, {
              accessToken: refreshResult.accessToken,
              refreshToken: refreshResult.refreshToken || account.refreshToken,
              updatedAt: new Date()
            });

            // Retry with new tokens
            const updatedAccount = { ...account, accessToken: refreshResult.accessToken };
            return await this.sendGmailEmailViaAPI(updatedAccount, emailData);
          }
        } catch (refreshError: any) {
          console.error('Token refresh failed for Gmail API:', refreshError);
        }

        throw new Error('OAuth tokens are invalid or expired. Please re-authenticate your Gmail account.');
      }

      throw new Error(`Gmail email sending failed: ${error.message}`);
    }
  }

  private async sendOutlookEmailViaAPI(account: EmailAccount, emailData: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    htmlBody?: string;
    attachments?: EmailAttachment[];
  }): Promise<string> {
    await this.connectOutlook(account);

    const message = {
      subject: emailData.subject,
      body: {
        contentType: emailData.htmlBody ? 'HTML' : 'Text',
        content: emailData.htmlBody || emailData.body
      },
      toRecipients: emailData.to.map(email => ({ emailAddress: { address: email } })),
      ccRecipients: emailData.cc?.map(email => ({ emailAddress: { address: email } })),
      bccRecipients: emailData.bcc?.map(email => ({ emailAddress: { address: email } }))
    };

    try {
      const response = await this.outlookClient.api('/me/sendMail').post({
        message,
        saveToSentItems: true
      });


      return `outlook-${Date.now()}`; // Outlook doesn't return message ID in this endpoint
    } catch (error: any) {
      console.error('Failed to send Outlook email:', error);
      throw new Error(`Outlook email sending failed: ${error.message}`);
    }
  }

  // Helper method to decrypt tokens if they are encrypted
  private decryptTokenIfNeeded(token: string): string {
    if (!token) return token;

    // Check if token is encrypted (contains colon separator)
    if (token.includes(':') && token.length > 50) {
      try {
        // Try to decrypt using OAuth service if available
        if (this.oauthService && typeof this.oauthService.decryptToken === 'function') {
          return this.oauthService.decryptToken(token);
        }

        // If OAuth service is not available, try to create one
        if (!this.oauthService) {
          try {
            const { OAuthService } = require('./oauthService');
            this.oauthService = new OAuthService();
            return this.oauthService.decryptToken(token);
          } catch (importError) {
            console.warn('Could not import OAuthService for token decryption:', importError);
          }
        }

        // If all else fails, return as is
        return token;
      } catch (error) {
        console.warn('Failed to decrypt token, using as is:', error);
        return token;
      }
    }

    // Token is not encrypted, return as is
    return token;
  }

  // ========== NEW METHODS FOR HISTORICAL SYNC ==========

  /**
   * Get the highest UID for a given mailbox folder
   */
  async getHighestUid(account: EmailAccount, folder: string): Promise<number> {
    const client = await this.connectIMAP(account);
    try {
      const status = await client.mailboxOpen(folder);
      return status.exists > 0 ? status.uidNext - 1 : 0;
    } finally {
      await client.logout();
    }
  }

  /**
   * Fetch emails in a specific UID range from a folder
   */
  async fetchEmailsByUidRange(
    account: EmailAccount,
    folder: string,
    startUid: number,
    endUid: number
  ): Promise<any[]> {
    const client = await this.connectIMAP(account);
    const messages: any[] = [];
    try {
      await client.mailboxOpen(folder);

      const range = `${startUid}:${endUid}`;
      for await (const message of client.fetch(range, {
        envelope: true,
        source: true,
        flags: true,
        uid: true
      }, { uid: true })) {
        messages.push({ ...message, folder: folder.toUpperCase() });
      }
      return messages.reverse(); // Newest first
    } finally {
      await client.logout();
    }
  }

  /**
   * Fetch incremental emails since a last known UID
   */
  async fetchEmailsIncrementalByUid(
    account: EmailAccount,
    folder: string,
    lastUid: number
  ): Promise<any[]> {
    const client = await this.connectIMAP(account);
    const messages: any[] = [];
    try {
      await client.mailboxOpen(folder);

      // Fetch everything from lastUid + 1 to the end
      const range = `${lastUid + 1}:*`;
      for await (const message of client.fetch(range, {
        envelope: true,
        source: true,
        flags: true,
        uid: true
      }, { uid: true })) {
        if (message.uid > lastUid) {
          messages.push({ ...message, folder: folder.toUpperCase() });
        }
      }
      return messages;
    } finally {
      await client.logout();
    }
  }

  /**
   * Set IMAP flags (e.g. \Seen) for a message
   */
  async setImapFlag(
    account: EmailAccount,
    folder: string,
    uid: number,
    opt: { add?: string[]; remove?: string[]; set?: string[] }
  ): Promise<void> {
    const client = await this.connectIMAP(account);
    try {
      await client.mailboxOpen(folder);

      if (opt.add && opt.add.length > 0) {
        await client.messageFlagsAdd(`${uid}`, opt.add, { uid: true });
      }
      if (opt.remove && opt.remove.length > 0) {
        await client.messageFlagsRemove(`${uid}`, opt.remove, { uid: true });
      }
      if (opt.set && opt.set.length > 0) {
        await client.messageFlagsSet(`${uid}`, opt.set, { uid: true });
      }
    } catch (error: any) {
      // If folder open failed, try resolving it if it looks like a label
      if (error.message?.includes('NONEXISTENT') || error.message?.includes('does not exist')) {
        try {
          const mailboxes = await client.list();
          let resolvedPath: string | null = null;

          if (folder === 'DRAFT') {
            resolvedPath = mailboxes.find((m: any) => m.specialUse === '\\Drafts' || m.path.toLowerCase().includes('draft'))?.path || null;
          } else if (folder === 'SENT') {
            resolvedPath = mailboxes.find((m: any) => m.specialUse === '\\Sent' || m.path.toLowerCase().includes('sent'))?.path || null;
          } else if (folder === 'TRASH') {
            resolvedPath = mailboxes.find((m: any) => m.specialUse === '\\Trash' || m.path.toLowerCase().includes('trash'))?.path || null;
          } else if (folder === 'SPAM') {
            resolvedPath = mailboxes.find((m: any) => m.specialUse === '\\Junk' || m.path.toLowerCase().includes('spam') || m.path.toLowerCase().includes('junk'))?.path || null;
          }

          if (resolvedPath && resolvedPath !== folder) {
            console.log(`[IMAP] Resolved label ${folder} to path ${resolvedPath} for flag update`);
            await client.mailboxOpen(resolvedPath);
            // Retry operations
            if (opt.add && opt.add.length > 0) await client.messageFlagsAdd(`${uid}`, opt.add, { uid: true });
            if (opt.remove && opt.remove.length > 0) await client.messageFlagsRemove(`${uid}`, opt.remove, { uid: true });
            if (opt.set && opt.set.length > 0) await client.messageFlagsSet(`${uid}`, opt.set, { uid: true });
            return;
          }
        } catch (resolveErr) {
          console.error(`[IMAP] Failed to resolve folder label ${folder}:`, resolveErr);
        }
      }
      console.error(`Failed to set IMAP flags for UID ${uid} in ${folder}:`, error);
      throw error;
    } finally {
      await client.logout();
    }
  }

  /**
   * Set Gmail flags (using Labels: UNREAD, STARRED, etc)
   */
  async setGmailLabel(
    account: EmailAccount,
    messageId: string,
    opt: { add?: string[]; remove?: string[] }
  ): Promise<void> {
    await this.connectGmail(account);
    try {
      await this.gmailClient.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: opt.add,
          removeLabelIds: opt.remove
        }
      });
    } catch (error) {
      console.error(`Failed to set Gmail labels for ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Set Outlook flags (isRead)
   */
  async setOutlookFlag(
    account: EmailAccount,
    messageId: string,
    updates: { isRead?: boolean }
  ): Promise<void> {
    await this.connectOutlook(account);
    try {
      const payload: any = {};
      if (updates.isRead !== undefined) {
        payload.isRead = updates.isRead;
      }

      await this.outlookClient.api(`/me/messages/${messageId}`).update(payload);
    } catch (error) {
      console.error(`Failed to set Outlook flag for ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Refresh flags for specific UIDs in an IMAP folder
   */
  async refreshIMAPFlags(
    account: EmailAccount,
    folderPath: string,
    uids: number[]
  ): Promise<Map<number, string[]>> {
    const parallelSync = new ParallelImapSyncService(
      3,  // Max 3 parallel connections
      100 // Batch size of 100 emails
    );
    return await parallelSync.fetchFlags(account, folderPath, uids);
  }

  /**
   * Get folder configurations for an IMAP account
   */
  async getIMAPFolderConfigs(account: EmailAccount): Promise<any[]> {
    const parallelSync = new ParallelImapSyncService();
    return await parallelSync.getFolderConfigs(account);
  }

  /**
   * Fetch status (isRead) for a specific Outlook message
   */
  async fetchOutlookMessageStatus(account: EmailAccount, messageId: string): Promise<boolean> {
    await this.connectOutlook(account);
    try {
      const response = await this.outlookClient.api(`/me/messages/${messageId}`).select('isRead').get();
      return !!response.isRead;
    } catch (error) {
      console.error(`Failed to fetch Outlook status for ${messageId}:`, error);
      throw error;
    }
  }

  // ========== TRASH AND DELETE METHODS ==========

  /**
   * Move Gmail email to trash
   */
  async trashGmailEmail(account: EmailAccount, messageId: string): Promise<void> {
    await this.connectGmail(account);
    try {
      await this.gmailClient.users.messages.trash({
        userId: 'me',
        id: messageId
      });
      console.log(`[Gmail] Moved message ${messageId} to trash`);
    } catch (error) {
      console.error(`Failed to trash Gmail message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Restore Gmail email from trash
   */
  async untrashGmailEmail(account: EmailAccount, messageId: string): Promise<void> {
    await this.connectGmail(account);
    try {
      await this.gmailClient.users.messages.untrash({
        userId: 'me',
        id: messageId
      });
      console.log(`[Gmail] Restored message ${messageId} from trash`);
    } catch (error) {
      console.error(`Failed to untrash Gmail message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Permanently delete Gmail email
   */
  async deleteGmailEmailPermanently(account: EmailAccount, messageId: string): Promise<void> {
    await this.connectGmail(account);
    try {
      await this.gmailClient.users.messages.delete({
        userId: 'me',
        id: messageId
      });
      console.log(`[Gmail] Permanently deleted message ${messageId}`);
    } catch (error) {
      console.error(`Failed to permanently delete Gmail message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Search for an email by Message-ID in a specific IMAP folder
   * Returns the UID if found, null otherwise
   */
  async searchImapEmailByMessageId(account: EmailAccount, folderPath: string, messageId: string): Promise<{ uid: number } | null> {
    const client = await this.connectIMAP(account);
    try {
      // Try to open the folder
      try {
        await client.mailboxOpen(folderPath);
      } catch (err) {
        // Folder might not exist or be named differently (e.g., INBOX vs INBOX.Trash)
        // Try common variations
        const variations = [folderPath, `INBOX.${folderPath}`, folderPath.toUpperCase()];
        let opened = false;
        for (const variant of variations) {
          try {
            await client.mailboxOpen(variant);
            opened = true;
            break;
          } catch (e) { /* ignore */ }
        }
        if (!opened) return null;
      }

      const cleanMessageId = messageId.replace(/[<>]/g, '');
      const searchResults = await client.search({
        header: { 'Message-ID': cleanMessageId }
      }, { uid: true });

      if (searchResults && searchResults.length > 0 && searchResults[0] !== undefined) {
        return { uid: searchResults[0] };
      }
      return null;
    } catch (error) {
      console.error(`Failed to search for email by Message-ID in ${folderPath}:`, error);
      return null;
    } finally {
      await client.logout();
    }
  }

  /**
 * Move IMAP email to Trash folder
 * Accepts messageId to handle cases where source folder might have changed or is invalid
 */
  async moveImapEmailToTrash(account: EmailAccount, sourceFolder: string, uid: number, messageId?: string): Promise<void> {
    const client = await this.connectIMAP(account);
    try {
      let trashFolder = 'Trash';
      let folders: any[] = [];
      try {
        folders = await client.list();
        for (const folder of folders) {
          const lowerName = folder.path.toLowerCase();
          if (lowerName.includes('trash') || lowerName.includes('deleted') ||
            folder.specialUse === '\\Trash') {
            trashFolder = folder.path;
            break;
          }
        }
      } catch (listError) {
        console.warn('Could not list folders, using default Trash folder');
      }

      let realSourceFolder = sourceFolder;
      let sourceOpened = false;

      // 2. Try to open source folder
      try {
        await client.mailboxOpen(realSourceFolder);
        sourceOpened = true;
      } catch (err: any) {
        // If it's a label (e.g. DRAFT), try to resolve it from the list we fetched
        const label = sourceFolder.toUpperCase();
        let resolved = folders.find((f: any) => {
          if (label === 'DRAFT') return f.specialUse === '\\Drafts' || f.path.toLowerCase().includes('draft');
          if (label === 'SENT') return f.specialUse === '\\Sent' || f.path.toLowerCase().includes('sent');
          if (label === 'TRASH') return f.specialUse === '\\Trash' || f.path.toLowerCase().includes('trash');
          if (label === 'SPAM') return f.specialUse === '\\Junk' || f.path.toLowerCase().includes('spam') || f.path.toLowerCase().includes('junk');
          return false;
        });

        if (resolved) {
          try {
            realSourceFolder = resolved.path;
            await client.mailboxOpen(realSourceFolder);
            sourceOpened = true;
            console.log(`[IMAP] Resolved source label ${sourceFolder} to path ${realSourceFolder}`);
          } catch (retryErr) {
            console.warn(`[IMAP] Failed to open resolved folder ${realSourceFolder}`);
          }
        } else {
          console.warn(`[IMAP] Could not open source folder ${sourceFolder}: ${err.message}`);
        }
      }

      if (sourceOpened) {
        // Normal path: Move using UID
        try {
          await client.messageMove(`${uid}`, trashFolder, { uid: true });
          console.log(`[IMAP] Moved UID ${uid} from ${realSourceFolder} to ${trashFolder}`);
          return;
        } catch (moveErr) {
          console.warn(`[IMAP] Failed to move UID ${uid} from ${realSourceFolder}:`, moveErr);
          // Fallthrough to recovery if messageId is present
        }
      }

      // Recovery path: If source open failed or move failed, try finding by Message-ID
      if (messageId) {
        console.log(`[IMAP] Attempting to find message ${messageId} in other folders...`);
        const cleanMessageId = messageId.replace(/[<>]/g, '');

        // Generate list of folders to check, prioritizing common ones
        const commonFolders = ['INBOX', 'Drafts', 'Sent', 'Archive', 'Junk', 'Spam', 'Trash', 'Sent Items', 'Deleted Items'];
        const hostingerFolders = ['INBOX.Drafts', 'INBOX.Sent', 'INBOX.Archive', 'INBOX.Spam', 'INBOX.Junk', 'INBOX.Trash'];

        // Use actually existing folders from the list we fetched earlier
        const foldersToCheck = new Set<string>();

        // 1. Add explicitly known common names if they exist
        const allPaths = folders.map((f: any) => f.path);
        for (const f of [...commonFolders, ...hostingerFolders]) {
          if (allPaths.includes(f)) foldersToCheck.add(f);
        }

        // 2. Add all existing folders as fallback
        for (const p of allPaths) foldersToCheck.add(p);

        // 3. Remove the target trash folder
        foldersToCheck.delete(trashFolder);

        for (const checkFolder of foldersToCheck) {
          try {
            if (checkFolder === trashFolder) continue;

            const mailbox = await client.mailboxOpen(checkFolder);
            if (!mailbox) continue;

            const searchResults = await client.search({
              header: { 'Message-ID': cleanMessageId }
            }, { uid: true });

            if (searchResults && searchResults.length > 0) {
              const foundUid = searchResults[0];
              await client.messageMove(`${foundUid}`, trashFolder, { uid: true });
              console.log(`[IMAP] Recovered: Moved UID ${foundUid} from ${checkFolder} to ${trashFolder}`);
              return;
            }
          } catch (e) {
            // Ignore folder access errors during search
          }
        }
        console.warn(`[IMAP] Could not find message ${messageId} to trash.`);
      }

    } catch (error) {
      console.error(`Failed to move IMAP message to trash:`, error);
      // Don't throw if we can't find it - it's effectively "gone" or inaccessible, 
      // and we don't want to crash the sync for other items.
      // throw error; 
    } finally {
      await client.logout();
    }
  }
  /**
 * Move IMAP email from Trash back to Inbox
 * Searches by Message-ID since UIDs change after moving between folders
 */
  async moveImapEmailFromTrash(account: EmailAccount, uid: number, messageId?: string, targetFolder: string = 'INBOX'): Promise<void> {
    const client = await this.connectIMAP(account);
    try {
      // Resolve target folder if it's a label
      let realTargetFolder = targetFolder;
      const folders = await client.list();

      if (['INBOX', 'TRASH', 'DRAFT', 'SENT', 'SPAM'].includes(targetFolder.toUpperCase())) {
        const label = targetFolder.toUpperCase();
        const resolved = folders.find(f => {
          if (label === 'DRAFT') return f.specialUse === '\\Drafts' || f.path.toLowerCase().includes('draft');
          if (label === 'SENT') return f.specialUse === '\\Sent' || f.path.toLowerCase().includes('sent');
          if (label === 'TRASH') return f.specialUse === '\\Trash' || f.path.toLowerCase().includes('trash');
          if (label === 'SPAM') return f.specialUse === '\\Junk' || f.path.toLowerCase().includes('spam') || f.path.toLowerCase().includes('junk');
          return f.path.toUpperCase() === 'INBOX'; // INBOX is usually just INBOX
        });
        if (resolved) {
          realTargetFolder = resolved.path;
        }
      }

      // Common trash folder names
      const potentialTrashNames = ['Trash', 'INBOX.Trash', 'Deleted', 'Deleted Items', 'Deleted Messages', '[Gmail]/Trash'];

      // Get actual folders from server
      const existingFolders = folders; // reused from above
      const validTrashFolders: string[] = [];

      // 1. Add any folder with \Trash special use
      const specialTrash = existingFolders.find(f => f.specialUse === '\\Trash');
      if (specialTrash) {
        validTrashFolders.push(specialTrash.path);
      }

      // 2. Add matching names from our list
      for (const name of potentialTrashNames) {
        const exists = existingFolders.find(f => f.path === name || f.path === `INBOX.${name}` || f.name === name);
        if (exists && !validTrashFolders.includes(exists.path)) {
          validTrashFolders.push(exists.path);
        }
      }

      // 3. Fallback: Check existing folders that look like trash
      if (validTrashFolders.length === 0) {
        for (const folder of existingFolders) {
          const lower = folder.path.toLowerCase();
          if ((lower.includes('trash') || lower.includes('deleted')) && !validTrashFolders.includes(folder.path)) {
            validTrashFolders.push(folder.path);
          }
        }
      }

      let restored = false;
      // Use the first valid trash folder found as the primary one, or default to 'Trash' if none
      // Explicitly checking for length to satisfy TS
      let trashFolder: string = (validTrashFolders.length > 0 && validTrashFolders[0]) ? validTrashFolders[0] : 'Trash';

      // If we have a Message-ID, search for the email in all valid trash folders
      if (messageId) {
        const cleanMessageId = messageId.replace(/[<>]/g, '');

        for (const folder of validTrashFolders) {
          try {
            await client.mailboxOpen(folder);

            const searchResults = await client.search({
              header: { 'Message-ID': cleanMessageId }
            }, { uid: true });

            if (searchResults && searchResults.length > 0) {
              const foundUid = searchResults[0];
              console.log(`[IMAP] Found message in ${folder} with UID ${foundUid}`);

              await client.messageMove(`${foundUid}`, realTargetFolder, { uid: true });
              console.log(`[IMAP] Moved UID ${foundUid} from ${folder} to ${realTargetFolder}`);
              restored = true;
              break;
            }
          } catch (folderErr: any) {
            if (!folderErr.message?.includes('NONEXISTENT') && !folderErr.message?.includes('does not exist')) {
              console.log(`[IMAP] Could not check folder ${folder}: ${folderErr.message}`);
            }
          }
        }
      }

      // Fallback: try with original UID in detected trash folder
      if (!restored) {
        try {
          await client.mailboxOpen(trashFolder);
          await client.messageMove(`${uid}`, 'INBOX', { uid: true });
          console.log(`[IMAP] Moved UID ${uid} from ${trashFolder} to INBOX`);
          restored = true;
        } catch (fallbackErr: any) {
          console.log(`[IMAP] Fallback restore from ${trashFolder} failed: ${fallbackErr.message}`);
        }
      }

      if (!restored) {
        console.warn(`[IMAP] Could not find message to restore (Message-ID: ${messageId}, Original UID: ${uid})`);
      }
    } catch (error) {
      console.error(`Failed to restore IMAP message from trash:`, error);
      throw error;
    } finally {
      await client.logout();
    }
  }
  /**
 * Permanently delete IMAP email by Message-ID
 * Searches in Trash folder first (since moved emails get new UIDs), then falls back to provided folder
 */
  async deleteImapEmailPermanently(account: EmailAccount, folder: string, uid: number, messageId?: string): Promise<void> {
    const client = await this.connectIMAP(account);
    try {
      // Common trash folder names across different email providers
      const potentialTrashNames = ['Trash', 'INBOX.Trash', 'Deleted', 'Deleted Items', 'Deleted Messages', '[Gmail]/Trash'];

      // Get actual folders from server to avoid "Mailbox doesn't exist" errors
      const existingFolders = await client.list();
      const validTrashFolders: string[] = [];

      // 1. Add any folder with \Trash special use
      const specialTrash = existingFolders.find(f => f.specialUse === '\\Trash');
      if (specialTrash) {
        validTrashFolders.push(specialTrash.path);
      }

      // 2. Add matching names from our list if they exist, avoiding duplicates
      for (const name of potentialTrashNames) {
        // Check if this potential name exists in the folders list
        const exists = existingFolders.find(f => f.path === name || f.path === `INBOX.${name}` || f.name === name);
        if (exists && !validTrashFolders.includes(exists.path)) {
          validTrashFolders.push(exists.path);
        }
      }

      // 3. If we found nothing, fall back to checking strict paths from our list that match by suffix
      if (validTrashFolders.length === 0) {
        // Fallback: Check existing folders that *look* like trash
        for (const folder of existingFolders) {
          const lower = folder.path.toLowerCase();
          if ((lower.includes('trash') || lower.includes('deleted')) && !validTrashFolders.includes(folder.path)) {
            validTrashFolders.push(folder.path);
          }
        }
      }

      let realFolder = folder;
      let deleted = false;

      // Try with original folder/UID first
      try {
        await client.mailboxOpen(realFolder);
        await client.messageFlagsAdd(`${uid}`, ['\\Deleted'], { uid: true });
        await client.messageDelete(`${uid}`, { uid: true });
        console.log(`[IMAP] Permanently deleted UID ${uid} from ${realFolder}`);
        deleted = true;
      } catch (err: any) {
        // Try resolving label if it failed
        const label = folder.toUpperCase();
        const resolved = existingFolders.find((f: any) => {
          if (label === 'DRAFT') return f.specialUse === '\\Drafts' || f.path.toLowerCase().includes('draft');
          if (label === 'SENT') return f.specialUse === '\\Sent' || f.path.toLowerCase().includes('sent');
          if (label === 'TRASH') return f.specialUse === '\\Trash' || f.path.toLowerCase().includes('trash');
          if (label === 'SPAM') return f.specialUse === '\\Junk' || f.path.toLowerCase().includes('spam') || f.path.toLowerCase().includes('junk');
          return false;
        });

        if (resolved) {
          try {
            realFolder = resolved.path;
            await client.mailboxOpen(realFolder);
            await client.messageFlagsAdd(`${uid}`, ['\\Deleted'], { uid: true });
            await client.messageDelete(`${uid}`, { uid: true });
            console.log(`[IMAP] Resolved label ${folder} and deleted UID ${uid} from ${realFolder}`);
            deleted = true;
          } catch (retryErr) { /* ignore */ }
        }
      }

      // If still not deleted and we have a Message-ID, search for it in Trash folders
      if (!deleted && messageId) {
        // Clean Message-ID (remove < > if present)
        const cleanMessageId = messageId.replace(/[<>]/g, '');

        for (const trashFolder of validTrashFolders) {
          try {
            const mailbox = await client.mailboxOpen(trashFolder);
            if (!mailbox) continue;

            // Search by Message-ID header
            const searchResults = await client.search({
              header: { 'Message-ID': cleanMessageId }
            }, { uid: true });

            if (searchResults && searchResults.length > 0) {
              // Found the message in this trash folder
              const foundUid = searchResults[0];
              console.log(`[IMAP] Found message in ${trashFolder} with UID ${foundUid}`);

              await client.messageFlagsAdd(`${foundUid}`, ['\\Deleted'], { uid: true });
              await client.messageDelete(`${foundUid}`, { uid: true });

              console.log(`[IMAP] Permanently deleted UID ${foundUid} from ${trashFolder}`);
              deleted = true;
              break;
            }
          } catch (folderErr: any) {
            // Folder doesn't exist or access denied, try next
            if (!folderErr.message?.includes('NONEXISTENT') && !folderErr.message?.includes('does not exist')) {
              console.log(`[IMAP] Could not check folder ${trashFolder}: ${folderErr.message}`);
            }
          }
        }
      }

      // Fallback: try original folder with original UID
      if (!deleted) {
        try {
          await client.mailboxOpen(folder);
          await client.messageFlagsAdd(`${uid}`, ['\\Deleted'], { uid: true });
          await client.messageDelete(`${uid}`, { uid: true });
          console.log(`[IMAP] Permanently deleted UID ${uid} from ${folder}`);
          deleted = true;
        } catch (fallbackErr: any) {
          console.log(`[IMAP] Fallback delete from ${folder} failed: ${fallbackErr.message}`);
        }
      }

      if (!deleted) {
        console.warn(`[IMAP] Could not find message to delete (Message-ID: ${messageId}, Original: ${folder}/${uid})`);
      }
    } catch (error) {
      console.error(`Failed to permanently delete IMAP message:`, error);
      throw error;
    } finally {
      await client.logout();
    }
  }
  /**
   * Move Outlook email to trash (Deleted Items folder)
   */
  async trashOutlookEmail(account: EmailAccount, messageId: string): Promise<void> {
    await this.connectOutlook(account);
    try {
      // Move to deletedItems folder
      await this.outlookClient.api(`/me/messages/${messageId}/move`).post({
        destinationId: 'deleteditems'
      });
      console.log(`[Outlook] Moved message ${messageId} to Deleted Items`);
    } catch (error) {
      console.error(`Failed to trash Outlook message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Restore Outlook email from Deleted Items to Inbox
   */
  async untrashOutlookEmail(account: EmailAccount, messageId: string): Promise<void> {
    await this.connectOutlook(account);
    try {
      // Move back to inbox
      await this.outlookClient.api(`/me/messages/${messageId}/move`).post({
        destinationId: 'inbox'
      });
      console.log(`[Outlook] Restored message ${messageId} to Inbox`);
    } catch (error) {
      console.error(`Failed to restore Outlook message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Permanently delete Outlook email
   */
  async deleteOutlookEmailPermanently(account: EmailAccount, messageId: string): Promise<void> {
    await this.connectOutlook(account);
    try {
      await this.outlookClient.api(`/me/messages/${messageId}`).delete();
      console.log(`[Outlook] Permanently deleted message ${messageId}`);
    } catch (error) {
      console.error(`Failed to permanently delete Outlook message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Save a draft to IMAP server
   */
  async saveDraftToIMAP(account: EmailAccount, emailData: any): Promise<string | null> {
    const client = await this.connectIMAP(account);
    try {
      const mailboxes = await client.list();
      const draftBox = mailboxes.find((box: any) =>
        box.specialUse === '\\Drafts' || box.name.toLowerCase().includes('draft')
      );

      const draftFolder = draftBox ? draftBox.path : 'Drafts';

      const composer = new MailComposer({
        from: account.email,
        to: emailData.to?.join(', '),
        cc: emailData.cc?.join(', '),
        bcc: emailData.bcc?.join(', '),
        subject: emailData.subject,
        text: emailData.body,
        html: emailData.htmlBody,
        attachments: emailData.attachments?.map((att: any) => ({
          filename: att.filename,
          content: att.content,
          encoding: att.encoding || 'base64',
          contentType: att.contentType,
          cid: att.contentId
        }))
      });

      const messageBuffer = await composer.compile().build();
      // Use \Draft flag to mark as draft
      const result = await client.append(draftFolder, messageBuffer, ['\\Draft']);
      return (result && typeof result !== 'boolean') ? result.uid?.toString() || null : null;
    } catch (error) {
      console.error(`Failed to save IMAP draft:`, error);
      return null;
    } finally {
      await client.logout();
    }
  }

  /**
   * Save a draft to Gmail
   */
  async saveDraftToGmail(account: EmailAccount, emailData: any): Promise<string | null> {
    await this.connectGmail(account);
    try {
      const composer = new MailComposer({
        from: account.email,
        to: emailData.to?.join(', '),
        cc: emailData.cc?.join(', '),
        bcc: emailData.bcc?.join(', '),
        subject: emailData.subject,
        text: emailData.body,
        html: emailData.htmlBody,
        attachments: emailData.attachments?.map((att: any) => ({
          filename: att.filename,
          content: att.content,
          encoding: att.encoding || 'base64',
          contentType: att.contentType,
          cid: att.contentId
        }))
      });

      const messageBuffer = await composer.compile().build();
      const encodedMessage = messageBuffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const response = await this.gmailClient.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: encodedMessage
          }
        }
      });

      return response.data.id;
    } catch (error) {
      console.error(`Failed to save Gmail draft:`, error);
      return null;
    }
  }

  /**
   * Save a draft to Outlook
   */
  async saveDraftToOutlook(account: EmailAccount, emailData: any): Promise<string | null> {
    await this.connectOutlook(account);
    try {
      const response = await this.outlookClient.api('/me/messages').post({
        subject: emailData.subject,
        body: {
          contentType: emailData.htmlBody ? 'html' : 'text',
          content: emailData.htmlBody || emailData.body
        },
        toRecipients: emailData.to?.map((email: string) => ({ emailAddress: { address: email } })),
        ccRecipients: emailData.cc?.map((email: string) => ({ emailAddress: { address: email } })),
        bccRecipients: emailData.bcc?.map((email: string) => ({ emailAddress: { address: email } })),
        isDraft: true
      });

      return response.id;
    } catch (error) {
      console.error(`Failed to save Outlook draft:`, error);
      return null;
    }
  }

  /**
   * Mark Gmail email as spam
   */
  async markGmailAsSpam(account: EmailAccount, messageId: string): Promise<void> {
    await this.connectGmail(account);
    try {
      await this.gmailClient.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: ['SPAM'],
          removeLabelIds: ['INBOX']
        }
      });
      console.log(`[Gmail] Marked message ${messageId} as SPAM`);
    } catch (error) {
      console.error(`Failed to mark Gmail message ${messageId} as spam:`, error);
      throw error;
    }
  }

  /**
   * Mark Outlook email as spam
   */
  async markOutlookAsSpam(account: EmailAccount, messageId: string): Promise<void> {
    await this.connectOutlook(account);
    try {
      await this.outlookClient.api(`/me/messages/${messageId}/move`).post({
        destinationId: 'junkemail'
      });
      console.log(`[Outlook] Marked message ${messageId} as SPAM (moved to Junk Email)`);
    } catch (error) {
      console.error(`Failed to mark Outlook message ${messageId} as spam:`, error);
      throw error;
    }
  }

  /**
   * Mark IMAP email as spam
   */
  async markImapAsSpam(account: EmailAccount, sourceFolder: string, uid: number): Promise<void> {
    const client = await this.connectIMAP(account);
    try {
      const folders = await client.list();
      const spamFolder = folders.find((f: any) =>
        f.specialUse === '\\Junk' ||
        f.path.toLowerCase().includes('spam') ||
        f.path.toLowerCase().includes('junk')
      )?.path || 'Spam';

      await client.mailboxOpen(sourceFolder);
      await client.messageMove(`${uid}`, spamFolder, { uid: true });
      console.log(`[IMAP] Moved message ${uid} from ${sourceFolder} to ${spamFolder}`);
    } catch (error) {
      console.error(`Failed to mark IMAP message ${uid} as spam:`, error);
      throw error;
    } finally {
      await client.logout();
    }
  }

  private injectTracking(html: string, emailId: string): string {
    const baseUrl = process.env.TRACKING_BASE_URL || 'http://localhost:4000';

    // 1. Inject pixel
    const pixelUrl = `${baseUrl}/api/emails/track/open/${emailId}`;
    console.log(`📸 [TRACKING] Injecting pixel URL: ${pixelUrl}`);

    const pixelTag = `<img src="${pixelUrl}" width="1" height="1" style="display:none !important;" alt="" />`;
    let processedHtml = html.includes('</body>')
      ? html.replace('</body>', `${pixelTag}</body>`)
      : html + pixelTag;

    // 2. Wrap links
    const linkRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])([^"']*)\1/gi;
    processedHtml = processedHtml.replace(linkRegex, (match, quote, url) => {
      if (url.startsWith('mailto:') || url.startsWith('#') || url.includes(baseUrl)) {
        return match;
      }
      const encodedUrl = Buffer.from(url).toString('base64');
      const trackingUrl = `${baseUrl}/api/emails/track/click/${emailId}?url=${encodedUrl}`;
      console.log(`🔗 [TRACKING] Wrapping link: ${url} -> ${trackingUrl}`);
      return match.replace(url, trackingUrl);
    });

    return processedHtml;
  }
}
