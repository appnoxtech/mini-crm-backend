import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { google } from 'googleapis';
import { EmailAccount, EmailAttachment } from '../models/types';

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

  async fetchGmailEmails(account: EmailAccount, lastSyncTime?: Date, maxResults: number = 50): Promise<any[]> {
    try {
      await this.connectGmail(account);
      let query = 'in:inbox OR in:sent OR in:spam OR in:trash OR in:drafts OR in:all';
      
      if (lastSyncTime) {
        const timestamp = Math.floor(lastSyncTime.getTime() / 1000);
        query += ` after:${timestamp}`;
      }
      
      console.log(`Fetching Gmail emails with query: ${query}`);
      
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
          const fullMessage = await this.gmailClient.users.messages.get({ 
            userId: 'me', 
            id: message.id, 
            format: 'full' 
          });
          messages.push({
            ...fullMessage.data,
            provider: 'gmail',
            accountId: account.id
          });
        } catch (error: any) {
          console.error(`Failed to fetch Gmail message ${message.id}:`, error);
          // Continue with other messages
        }
      }
      
      console.log(`Successfully fetched ${messages.length} Gmail messages`);
      return messages;
    } catch (error: any) {
      console.error('Failed to fetch Gmail emails:', error);
      throw new Error(`Gmail email fetch failed: ${error.message}`);
    }
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
    await client.mailboxOpen('INBOX');
    
    const searchCriteria: any = lastSyncTime ? { since: lastSyncTime } : { all: true };
    const messages: any[] = [];
    
    for await (const message of client.fetch(searchCriteria, { 
      envelope: true, 
      bodyStructure: true, 
      source: true 
    })) {
      messages.push(message);
    }
    
    await client.logout();
    return messages;
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
    
    const transporter = nodemailer.createTransport({
      host: account.smtpConfig.host,
      port: account.smtpConfig.port,
      secure: account.smtpConfig.secure,
      auth: {
        user: account.smtpConfig.username,
        pass: account.smtpConfig.password
      },
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
