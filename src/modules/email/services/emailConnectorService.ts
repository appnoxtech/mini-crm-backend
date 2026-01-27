import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { google } from 'googleapis';
import { EmailAccount, EmailAttachment } from '../models/types';
import { ParallelImapSyncService } from './parallelImapSyncService';

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
      console.log(`Testing SMTP connection to ${smtpConfig.host}:${smtpConfig.port}`);

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
      console.log('SMTP connection test successful');

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
      console.log(`Testing IMAP connection to ${imapConfig.host}:${imapConfig.port}`);

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
      console.log('IMAP connection test successful');

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

      console.log(`Fetching Gmail emails with query: ${query}, maxResults: ${maxResults}`);

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

      console.log(`Successfully fetched ${messages.length} Gmail messages`);
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

      console.log(`Fetching Archived Gmail emails with query: ${query}, maxResults: ${maxResults}`);

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

      console.log(`Successfully fetched ${messages.length} archived Gmail messages`);

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

      console.log(`Fetching Gmail history starting from ${startHistoryId}`);

      const response = await this.gmailClient.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded', 'labelAdded', 'labelRemoved']
      });

      const history = response.data.history || [];
      const newHistoryId = response.data.historyId; // The ID of the most recent change in this list

      console.log(`Fetched ${history.length} history records. New History ID: ${newHistoryId}`);

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

  /**
   * Helper to fetch full details of a single Gmail message
   */
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

  async fetchOutlookEmails(account: EmailAccount, lastSyncTime?: Date, maxResults: number = 50): Promise<any[]> {
    try {
      await this.connectOutlook(account);
      let filter = '';

      if (lastSyncTime) {
        filter = `receivedDateTime ge ${lastSyncTime.toISOString()}`;
      }

      console.log(`Fetching Outlook emails with filter: ${filter || 'none'}`);

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

      console.log(`Successfully fetched ${messages.length} Outlook messages`);
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
        console.log(`Identified Sent folder as: ${sentFolder}`);

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
      3,  // Max 3 parallel connections
      100 // Batch size of 100 emails
    );

    try {
      let result;

      if (useQuickSync) {
        // Quick sync: only INBOX and SENT folders
        console.log(`🚀 Starting quick parallel IMAP sync for ${account.email}`);
        result = await parallelSync.quickSync(account, lastSyncTime);
      } else {
        // Full sync: all folders
        console.log(`🚀 Starting full parallel IMAP sync for ${account.email}`);
        result = await parallelSync.syncEmails(account, {
          maxConnections: 3,
          batchSize: 100,
          lastSyncTime,
        });
      }

      if (result.errors.length > 0) {
        console.warn(`⚠️ Parallel sync completed with ${result.errors.length} errors:`, result.errors);
      }

      console.log(`✅ Parallel sync completed: ${result.totalFetched} emails in ${(result.duration / 1000).toFixed(2)}s`);

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
          console.log('OAuth tokens validated successfully');
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

        console.log('OAuth tokens verified successfully via API call');
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
  }): Promise<string> {
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

    console.log(`Attempting to send email via ${account.smtpConfig.host}:${account.smtpConfig.port}`);

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
      console.log('SMTP connection verified successfully');
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

    console.log('Sending email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    try {
      const result = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
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
    console.log('Sending Gmail email via SMTP with OAuth2...');

    try {
      // Debug token information
      const decryptedRefreshToken = this.decryptTokenIfNeeded(account.refreshToken || '');
      const decryptedAccessToken = this.decryptTokenIfNeeded(account.accessToken || '');

      console.log('Token debug info:', {
        hasRefreshToken: !!account.refreshToken,
        hasAccessToken: !!account.accessToken,
        refreshTokenLength: decryptedRefreshToken?.length || 0,
        accessTokenLength: decryptedAccessToken?.length || 0,
        refreshTokenStart: decryptedRefreshToken?.substring(0, 10) + '...',
        accessTokenStart: decryptedAccessToken?.substring(0, 10) + '...'
      });

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
      console.log('Testing SMTP connection...');
      try {
        await transporter.verify();
        console.log('SMTP connection verified successfully');
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
      console.log('Gmail SMTP email sent successfully:', result.messageId);
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
          console.log('Attempting to refresh OAuth tokens...');
          if (!this.oauthService) {
            const { OAuthService } = require('./oauthService');
            this.oauthService = new OAuthService();
          }

          const refreshResult = await this.oauthService.refreshTokenIfNeeded(account);
          if (refreshResult) {
            console.log('Tokens refreshed successfully, retrying email send...');

            // Update account with new tokens
            const { EmailService } = require('./emailService');
            const { EmailModel } = require('../models/emailModel');
            // Get database instance from global context or pass it properly
            const Database = require('better-sqlite3');
            const db = new Database('data.db');
            const emailModel = new EmailModel(db);
            const emailService = new EmailService(emailModel, this);

            await emailService.updateEmailAccount(account.id, {
              accessToken: refreshResult.accessToken,
              refreshToken: refreshResult.refreshToken || account.refreshToken,
              updatedAt: new Date()
            });

            // Retry with new tokens - create a new transporter with fresh tokens
            console.log('Retrying with refreshed tokens...');
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
            console.log('Testing refreshed SMTP connection...');
            try {
              await refreshedTransporter.verify();
              console.log('Refreshed SMTP connection verified successfully');
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
            console.log('Gmail SMTP email sent successfully with refreshed tokens:', result.messageId);
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
    console.log('Sending Outlook email via SMTP with OAuth2...');

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
      console.log('Outlook SMTP email sent successfully:', result.messageId);
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

      console.log('Gmail email sent successfully:', response.data.id);
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
          console.log('Attempting to refresh OAuth tokens for Gmail API...');
          if (!this.oauthService) {
            const { OAuthService } = require('./oauthService');
            this.oauthService = new OAuthService();
          }

          const refreshResult = await this.oauthService.refreshTokenIfNeeded(account);
          if (refreshResult) {
            console.log('Tokens refreshed successfully, retrying Gmail API send...');

            // Update account with new tokens
            const { EmailService } = require('./emailService');
            const { EmailModel } = require('../models/emailModel');
            // Get database instance from global context or pass it properly
            const Database = require('better-sqlite3');
            const db = new Database('data.db');
            const emailModel = new EmailModel(db);
            const emailService = new EmailService(emailModel, this);

            await emailService.updateEmailAccount(account.id, {
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

      console.log('Outlook email sent successfully');
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
}
