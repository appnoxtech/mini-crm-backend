import { Request, Response } from 'express';
import { EmailService } from '../services/emailService';
import { OAuthService } from '../services/oauthService';
import { EmailQueueService } from '../services/emailQueueService';
import { RealTimeNotificationService } from '../services/realTimeNotificationService';
import { AuthenticatedRequest } from '../../../shared/types';
import { EmailAccount } from '../models/types';

export class EmailController {
  private emailService: EmailService;
  private oauthService: OAuthService;
  private queueService: EmailQueueService | undefined;
  private notificationService: RealTimeNotificationService | undefined;

  constructor(
    emailService: EmailService, 
    oauthService: OAuthService,
    queueService?: EmailQueueService,
    notificationService?: RealTimeNotificationService
  ) {
    this.emailService = emailService;
    this.oauthService = oauthService;
    this.queueService = queueService;
    this.notificationService = notificationService;
  }

  async sendEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { to, subject, body, htmlBody, attachments } = req.body as any || {};

      if (!to || !subject || !body) {
        res.status(400).json({ error: 'Missing required fields: to, subject, body' });
        return;
      }

      // Get user's email account from database
      const emailAccount = await this.emailService.getEmailAccountByUserId(req.user.id.toString());
      if (!emailAccount) {
        res.status(400).json({ 
          error: 'No email account configured',
          details: 'Please connect your email account first' 
        });
        return;
      }

      // Validate and refresh OAuth tokens if needed
      if (emailAccount.accessToken && (emailAccount.provider === 'gmail' || emailAccount.provider === 'outlook')) {
        try {
          await this.validateAndRefreshTokens(emailAccount);
        } catch (error: any) {
          console.error('Token validation failed:', error);
          res.status(401).json({ 
            error: 'Email account needs re-authorization',
            details: `Your ${emailAccount.provider} account needs to be re-connected. Please go to email settings and reconnect your account.`
          });
          return;
        }
      }

      const messageId = await this.emailService.sendEmail(emailAccount.id, {
        to: Array.isArray(to) ? to : [to],
        subject,
        body,
        htmlBody,
        attachments
      });

      res.json({ 
        success: true, 
        message: 'Email sent successfully',
        messageId 
      });
    } catch (error: any) {
      console.error('Email send failed:', error);
      
      // Check for specific error types and provide appropriate responses
      if (error.message.includes('re-authenticate') || 
          error.message.includes('re-authorize') ||
          error.message.includes('expired or revoked') ||
          error.message.includes('invalid_grant')) {
        res.status(401).json({ 
          error: 'Email account needs re-authorization',
          details: error.message,
          requiresReauth: true,
          action: 'Please go to the email setup page and reconnect your email account.'
        });
      } else {
        res.status(500).json({ 
          error: 'Failed to send email',
          details: error.message 
        });
      }
    }
  }

  // New method to validate and refresh OAuth tokens
  private async validateAndRefreshTokens(emailAccount: any): Promise<void> {
    if (!emailAccount.accessToken || !emailAccount.refreshToken) {
      throw new Error('No OAuth tokens available');
    }

    // For now, we'll skip automatic token refresh and just validate the account exists
    // This is a simpler approach that will work even without OAuth credentials configured
    console.log(`Validating OAuth account: ${emailAccount.provider} - ${emailAccount.email}`);
    
    // Check if the account is properly configured
    if (!emailAccount.isActive) {
      throw new Error('Email account is not active');
    }
    
    // If we have OAuth credentials configured, we can try to refresh
    // Otherwise, we'll assume the tokens are valid and let the email sending process handle errors
    const hasOAuthConfig = (emailAccount.provider === 'gmail' && process.env.GOOGLE_CLIENT_ID) ||
                          (emailAccount.provider === 'outlook' && process.env.MICROSOFT_CLIENT_ID);
    
    if (hasOAuthConfig) {
      try {
        const refreshResult = await this.oauthService.refreshTokenIfNeeded(emailAccount);
        
        if (refreshResult) {
          // Update the account with new tokens
          await this.emailService.updateEmailAccount(emailAccount.id, {
            accessToken: refreshResult.accessToken,
            refreshToken: refreshResult.refreshToken || emailAccount.refreshToken,
            updatedAt: new Date()
          });
          
          console.log(`Successfully refreshed tokens for ${emailAccount.provider} account: ${emailAccount.email}`);
        }
      } catch (error: any) {
        console.error(`Token refresh failed for ${emailAccount.provider} account:`, error);
        // Don't throw here - let the email sending process handle the error
        // This way, if the token is still valid, email sending might still work
      }
    } else {
      console.log(`OAuth credentials not configured for ${emailAccount.provider}, skipping token refresh`);
    }
  }

  // Debug endpoint to check current token status
  async debugTokenStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const emailAccount = await this.emailService.getEmailAccountByUserId(req.user.id.toString());
      if (!emailAccount) {
        res.status(404).json({ error: 'No email account found' });
        return;
      }

      // Decrypt tokens for debugging (don't expose full tokens in production)
      const decryptedAccessToken = this.oauthService.decryptToken(emailAccount.accessToken || '');
      const decryptedRefreshToken = this.oauthService.decryptToken(emailAccount.refreshToken || '');

      res.json({
        account: {
          id: emailAccount.id,
          email: emailAccount.email,
          provider: emailAccount.provider,
          isActive: emailAccount.isActive,
          createdAt: emailAccount.createdAt,
          updatedAt: emailAccount.updatedAt
        },
        tokens: {
          hasAccessToken: !!emailAccount.accessToken,
          hasRefreshToken: !!emailAccount.refreshToken,
          accessTokenLength: decryptedAccessToken?.length || 0,
          refreshTokenLength: decryptedRefreshToken?.length || 0,
          accessTokenStart: decryptedAccessToken?.substring(0, 20) + '...',
          refreshTokenStart: decryptedRefreshToken?.substring(0, 20) + '...'
        }
      });
    } catch (error: any) {
      console.error('Debug token status failed:', error);
      res.status(500).json({ error: 'Failed to get token status', details: error.message });
    }
  }

  // New endpoint to validate email account tokens
  async validateEmailAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Get user's email account from database
      const emailAccount = await this.emailService.getEmailAccountByUserId(req.user.id.toString());
      if (!emailAccount) {
        res.status(404).json({ 
          error: 'No email account found',
          details: 'Please connect your email account first' 
        });
        return;
      }

      // For OAuth accounts, validate and refresh tokens
      if (emailAccount.accessToken && (emailAccount.provider === 'gmail' || emailAccount.provider === 'outlook')) {
        try {
          await this.validateAndRefreshTokens(emailAccount);
          
          res.json({ 
            success: true, 
            message: 'Email account is valid and ready to use',
            account: {
              id: emailAccount.id,
              email: emailAccount.email,
              provider: emailAccount.provider,
              isActive: emailAccount.isActive
            }
          });
        } catch (error: any) {
          res.status(401).json({ 
            error: 'Email account needs re-authorization',
            details: `Your ${emailAccount.provider} account needs to be re-connected. Please go to email settings and reconnect your account.`,
            requiresReauth: true
          });
        }
      } else {
        // For SMTP accounts, just return success
        res.json({ 
          success: true, 
          message: 'Email account is valid and ready to use',
          account: {
            id: emailAccount.id,
            email: emailAccount.email,
            provider: emailAccount.provider,
            isActive: emailAccount.isActive
          }
        });
      }
    } catch (error: any) {
      console.error('Email account validation failed:', error);
      res.status(500).json({ 
        error: 'Failed to validate email account',
        details: error.message 
      });
    }
  }

  async sendTestEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { to, subject, body, htmlBody } = req.body as any || {};
      
      if (!to || !subject || !body) {
        res.status(400).json({ 
          error: 'Missing required fields: to, subject, body' 
        });
        return;
      }

      // Get user's email account from database
      const emailAccount = await this.emailService.getEmailAccountByUserId(req.user.id.toString());
      if (!emailAccount) {
        res.status(400).json({ 
          error: 'No email account configured',
          details: 'Please connect your email account first' 
        });
        return;
      }

      console.log('Testing direct email send with:', { accountId: emailAccount.id, to, subject });

      const messageId = await this.emailService.sendEmail(emailAccount.id, {
        to: Array.isArray(to) ? to : [to],
        subject,
        body,
        htmlBody
      });

      res.json({ 
        success: true, 
        message: 'Test email sent successfully',
        messageId 
      });
    } catch (error: any) {
      console.error('Test email send failed:', error);
      res.status(500).json({ 
        error: 'Failed to send test email',
        details: error.message 
      });
    }
  }

  async getEmailsForContact(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { contactId } = (req as any).params;
      const emails = await this.emailService.getEmailsForContact(contactId);
      res.json(emails);
    } catch (error: any) {
      console.error('Error fetching emails for contact:', error);
      res.status(500).json({ error: 'Failed to fetch emails' });
    }
  }

  async getEmailsForDeal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { dealId } = (req as any).params;
      const emails = await this.emailService.getEmailsForDeal(dealId);
      res.json(emails);
    } catch (error: any) {
      console.error('Error fetching emails for deal:', error);
      res.status(500).json({ error: 'Failed to fetch emails' });
    }
  }

  async handleEmailOpen(req: Request, res: Response): Promise<void> {
    try {
      const { trackingId } = req.params;
      
      // TODO: Implement tracking logic
      console.log('Email opened:', trackingId);
      
      const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
      res.writeHead(200, { 
        'Content-Type': 'image/png', 
        'Content-Length': pixel.length, 
        'Cache-Control': 'no-cache' 
      });
      res.end(pixel);
    } catch (error: any) {
      console.error('Error handling email open:', error);
      res.status(500).json({ error: 'Tracking failed' });
    }
  }

  async handleLinkClick(req: Request, res: Response): Promise<void> {
    try {
      const { trackingId } = req.params;
      const { url } = req.query;
      
      // TODO: Implement tracking logic
      console.log('Link clicked:', trackingId, url);
      
      const originalUrl = url as string || '/';
      res.redirect(originalUrl);
    } catch (error: any) {
      console.error('Error handling link click:', error);
      res.status(500).json({ error: 'Tracking failed' });
    }
  }

  // OAuth Authorization Endpoints
  async oauthGmailAuthorize(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.query as any;
      
      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      const authUrl = this.oauthService.generateGoogleAuthUrl(userId);
      res.json({ authUrl });
    } catch (error: any) {
      console.error('Gmail OAuth authorize error:', error);
      res.status(500).json({ error: 'Failed to generate auth URL' });
    }
  }
  

  async oauthOutlookAuthorize(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.query as any;
      
      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      const authUrl = await this.oauthService.generateMicrosoftAuthUrl(userId);
      res.json({ authUrl });
    } catch (error: any) {
      console.error('Outlook OAuth authorize error:', error);
      res.status(500).json({ error: 'Failed to generate auth URL' });
    }
  }

  // OAuth Status Check Endpoints
  async oauthGmailStatus(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.query as any;
      
      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      // Check if user has a connected Gmail account
      const emailAccount = await this.emailService.getEmailAccountByUserId(userId);
      const connected = !!(emailAccount && emailAccount.provider === 'gmail' && emailAccount.accessToken);
      
      res.json({ connected });
    } catch (error: any) {
      console.error('Gmail OAuth status check error:', error);
      res.status(500).json({ error: 'Failed to check OAuth status' });
    }
  }

  async oauthOutlookStatus(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.query as any;
      
      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      // Check if user has a connected Outlook account
      const emailAccount = await this.emailService.getEmailAccountByUserId(userId);
      const connected = !!(emailAccount && emailAccount.provider === 'outlook' && emailAccount.accessToken);
      
      res.json({ connected });
    } catch (error: any) {
      console.error('Outlook OAuth status check error:', error);
      res.status(500).json({ error: 'Failed to check OAuth status' });
    }
  }

  // OAuth Callback Endpoints
  async oauthGmailCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state } = req.query as any;
      
      if (!code || !state) {
        res.status(400).json({ error: 'Authorization code and state are required' });
        return;
      }

      const oauthResult = await this.oauthService.handleGoogleCallback(code, state);
      
      console.log('OAuth callback result:', {
        userId: oauthResult.userId,
        email: oauthResult.email,
        hasAccessToken: !!oauthResult.accessToken,
        hasRefreshToken: !!oauthResult.refreshToken,
        accessTokenLength: oauthResult.accessToken?.length || 0,
        refreshTokenLength: oauthResult.refreshToken?.length || 0
      });
      
      // Check if user already has an email account
      const existingAccount = await this.emailService.getEmailAccountByUserId(oauthResult.userId);
      
      if (existingAccount) {
        // Update existing account with new tokens (encrypt them before storing)
        console.log('Updating existing Gmail account with new tokens:', {
          accountId: existingAccount.id,
          email: existingAccount.email,
          provider: existingAccount.provider
        });
        
        await this.emailService.updateEmailAccount(existingAccount.id, {
          accessToken: this.oauthService.encryptToken(oauthResult.accessToken),
          refreshToken: this.oauthService.encryptToken(oauthResult.refreshToken),
          updatedAt: new Date()
        });
        
        console.log('Gmail account updated successfully with new tokens');
      } else {
        // Create new email account from OAuth result
        console.log('Creating new Gmail account from OAuth result');
        const emailAccount = this.oauthService.createEmailAccountFromOAuth(
          oauthResult.userId,
          oauthResult.email,
          'gmail',
          oauthResult.accessToken,
          oauthResult.refreshToken
        );

        // Save to database
        await this.emailService.createEmailAccount(emailAccount);
      }

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      console.log('Redirecting to frontend with success:', {
        frontendUrl,
        email: oauthResult.email,
        userId: oauthResult.userId
      });
      res.redirect(`${frontendUrl}/auth/callback?success=true&provider=gmail&email=${oauthResult.email}&userId=${oauthResult.userId}`);
    } catch (error: any) {
      console.error('Gmail OAuth callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?success=false&error=${encodeURIComponent(error.message)}`);
    }
  }

  async oauthOutlookCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state } = req.query as any;
      
      if (!code || !state) {
        res.status(400).json({ error: 'Authorization code and state are required' });
        return;
      }

      const oauthResult = await this.oauthService.handleMicrosoftCallback(code, state);
      
      // Check if user already has an email account
      const existingAccount = await this.emailService.getEmailAccountByUserId(oauthResult.userId);
      
      if (existingAccount) {
        // Update existing account with new tokens (encrypt them before storing)
        await this.emailService.updateEmailAccount(existingAccount.id, {
          accessToken: this.oauthService.encryptToken(oauthResult.accessToken),
          refreshToken: this.oauthService.encryptToken(oauthResult.refreshToken),
          updatedAt: new Date()
        });
      } else {
        // Create new email account from OAuth result
        const emailAccount = this.oauthService.createEmailAccountFromOAuth(
          oauthResult.userId,
          oauthResult.email,
          'outlook',
          oauthResult.accessToken,
          oauthResult.refreshToken
        );

        // Save to database
        await this.emailService.createEmailAccount(emailAccount);
      }

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?success=true&provider=outlook&email=${oauthResult.email}&userId=${oauthResult.userId}`);
    } catch (error: any) {
      console.error('Outlook OAuth callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?success=false&error=${encodeURIComponent(error.message)}`);
    }
  }

  // Email account management endpoints
  async getEmailAccounts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const accounts = await this.emailService.getEmailAccounts(req.user.id.toString());
      console.log('📧 Email accounts for user', req.user.id, ':', accounts);
      res.json({
        success: true,
        data: accounts
      });
    } catch (error: any) {
      console.error('Error fetching email accounts:', error);
      res.status(500).json({ error: 'Failed to fetch email accounts' });
    }
  }

  async connectEmailAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { email, provider, smtpConfig } = req.body as any;

      if (!email || !provider || !smtpConfig) {
        res.status(400).json({ error: 'Missing required fields: email, provider, smtpConfig' });
        return;
      }

      const account: EmailAccount = {
        id: `${req.user.id}-${email}`,
        userId: req.user.id.toString(),
        email,
        provider,
        smtpConfig,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdAccount = await this.emailService.createEmailAccount(account);
      res.status(201).json(createdAccount);
    } catch (error: any) {
      console.error('Error connecting email account:', error);
      res.status(500).json({ error: 'Failed to connect email account' });
    }
  }

  async updateEmailAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { accountId } = (req as any).params;
      const updates = req.body as any;

      await this.emailService.updateEmailAccount(accountId, updates);
      res.json({ message: 'Email account updated successfully' });
    } catch (error: any) {
      console.error('Error updating email account:', error);
      res.status(500).json({ error: 'Failed to update email account' });
    }
  }

  // Test email account connection
  async testEmailAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { email, provider, smtpConfig } = req.body as any;

      if (!email || !provider || !smtpConfig) {
        res.status(400).json({ error: 'Missing required fields: email, provider, smtpConfig' });
        return;
      }

      // Test the connection by sending a test email
      const testAccount: EmailAccount = {
        id: 'test-account',
        userId: req.user.id.toString(),
        email,
        provider,
        smtpConfig,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      try {
        await this.emailService.sendEmail(testAccount.id, {
          to: [email], // Send test email to the account itself
          subject: 'CRM Email Connection Test',
          body: 'This is a test email to verify your email account connection is working properly.'
        });

        res.json({ 
          success: true, 
          message: 'Email account connection test successful' 
        });
      } catch (sendError: any) {
        res.status(400).json({ 
          success: false,
          error: 'Email account connection test failed',
          details: sendError.message 
        });
      }
    } catch (error: any) {
      console.error('Error testing email account:', error);
      res.status(500).json({ error: 'Failed to test email account' });
    }
  }

  // New endpoint to test email account connection
  async testEmailConnection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Get user's email account from database
      const emailAccount = await this.emailService.getEmailAccountByUserId(req.user.id.toString());
      if (!emailAccount) {
        res.status(404).json({ 
          error: 'No email account found',
          details: 'Please connect your email account first' 
        });
        return;
      }

      // Basic account validation
      const accountInfo = {
        id: emailAccount.id,
        email: emailAccount.email,
        provider: emailAccount.provider,
        isActive: emailAccount.isActive,
        hasAccessToken: !!emailAccount.accessToken,
        hasRefreshToken: !!emailAccount.refreshToken,
        hasSmtpConfig: !!emailAccount.smtpConfig,
        lastSyncAt: emailAccount.lastSyncAt,
        createdAt: emailAccount.createdAt,
        updatedAt: emailAccount.updatedAt
      };

      // Check OAuth configuration
      const hasOAuthConfig = (emailAccount.provider === 'gmail' && process.env.GOOGLE_CLIENT_ID) ||
                            (emailAccount.provider === 'outlook' && process.env.MICROSOFT_CLIENT_ID);

      res.json({ 
        success: true, 
        message: 'Email account connection test completed',
        account: accountInfo,
        oauthConfigured: hasOAuthConfig,
        recommendations: []
      });

    } catch (error: any) {
      console.error('Email connection test failed:', error);
      res.status(500).json({ 
        error: 'Failed to test email connection',
        details: error.message 
      });
    }
  }

  // Email sync management endpoints
  async triggerEmailSync(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { accountId } = req.params;
      if (!accountId) {
        res.status(400).json({ error: 'Account ID is required' });
        return;
      }

      // Get user's email account
      const accounts = await this.emailService.getEmailAccounts(req.user.id.toString());
      const account = accounts.find(acc => acc.id === accountId);
      
      if (!account) {
        res.status(404).json({ error: 'Email account not found' });
        return;
      }

      if (this.queueService) {
        // Queue the sync with high priority for manual triggers
        this.queueService.queueEmailSync(accountId, req.user.id.toString(), 'high');
        
        if (this.notificationService) {
          this.notificationService.notifySyncStatus(req.user.id.toString(), accountId, 'starting');
        }

        res.json({ 
          success: true, 
          message: 'Email sync queued successfully',
          accountId 
        });
      } else {
        // Fallback to direct processing if queue service not available
        const result = await this.emailService.processIncomingEmails(account);
        
        res.json({ 
          success: true, 
          message: 'Email sync completed',
          result 
        });
      }
    } catch (error: any) {
      console.error('Error triggering email sync:', error);
      res.status(500).json({ 
        error: 'Failed to trigger email sync',
        details: error.message 
      });
    }
  }

  async getQueueStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!this.queueService) {
        res.status(503).json({ error: 'Queue service not available' });
        return;
      }

      const status = this.queueService.getQueueStatus();
      res.json({ 
        success: true, 
        data: status 
      });
    } catch (error: any) {
      console.error('Error getting queue status:', error);
      res.status(500).json({ error: 'Failed to get queue status' });
    }
  }

  async getNotificationStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!this.notificationService) {
        res.status(503).json({ error: 'Notification service not available' });
        return;
      }

      const stats = this.notificationService.getConnectionStats();
      const isConnected = this.notificationService.isUserConnected(req.user.id.toString());

      res.json({ 
        success: true, 
        data: {
          ...stats,
          currentUserConnected: isConnected
        }
      });
    } catch (error: any) {
      console.error('Error getting notification stats:', error);
      res.status(500).json({ error: 'Failed to get notification stats' });
    }
  }

  // Test endpoint to manually trigger WebSocket notification
  async testWebSocketNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (this.notificationService) {
        const testEmail = {
          id: 'test-email-' + Date.now(),
          messageId: 'test-message-id',
          accountId: 'test-account',
          from: 'test@example.com',
          to: ['user@example.com'],
          subject: 'Test WebSocket Notification',
          body: 'This is a test email to verify WebSocket notifications are working',
          isRead: false,
          isIncoming: true,
          sentAt: new Date(),
          receivedAt: new Date(),
          contactIds: [],
          dealIds: [],
          accountEntityIds: [],
          opens: 0,
          clicks: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        this.notificationService.notifyNewEmail(req.user.id.toString(), testEmail);
        
        res.json({
          success: true,
          message: 'Test WebSocket notification sent',
          userId: req.user.id.toString()
        });
      } else {
        res.status(500).json({ error: 'Notification service not available' });
      }
    } catch (error: any) {
      console.error('Error sending test notification:', error);
      res.status(500).json({ 
        error: 'Failed to send test notification',
        details: error.message 
      });
    }
  }

  // Get emails for the user's inbox
  async getEmails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { 
        limit, 
        offset, 
        folder,
        search,
        unreadOnly 
      } = req.query;

      const emails = await this.emailService.getEmailsForUser(
        req.user.id.toString(),
        {
          limit: limit ? parseInt(limit as string) : 50,
          offset: offset ? parseInt(offset as string) : 0,
          folder: folder as string || 'inbox',
          search: search as string,
          unreadOnly: unreadOnly === 'true'
        }
      );

      res.json({
        success: true,
        data: emails
      });
    } catch (error: any) {
      console.error('Error getting emails:', error);
      res.status(500).json({ 
        error: 'Failed to get emails',
        details: error.message 
      });
    }
  }

  // Get a specific email by ID
  async getEmailById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { emailId } = req.params;
      if (!emailId) {
        res.status(400).json({ error: 'Email ID is required' });
        return;
      }

      const email = await this.emailService.getEmailById(emailId, req.user.id.toString());
      if (!email) {
        res.status(404).json({ error: 'Email not found' });
        return;
      }

      res.json({
        success: true,
        data: email
      });
    } catch (error: any) {
      console.error('Error getting email:', error);
      res.status(500).json({ 
        error: 'Failed to get email',
        details: error.message 
      });
    }
  }

  // Mark email as read/unread
  async markEmailAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { emailId } = req.params;
      const { isRead = true } = req.body;

      if (!emailId) {
        res.status(400).json({ error: 'Email ID is required' });
        return;
      }

      const success = await this.emailService.markEmailAsRead(emailId, req.user.id.toString(), isRead);
      if (!success) {
        res.status(404).json({ error: 'Email not found' });
        return;
      }

      // Notify user about email read status change
      if (this.notificationService) {
        this.notificationService.notifyUser(req.user.id.toString(), {
          type: 'email_status_changed',
          data: {
            emailId,
            isRead,
            timestamp: new Date()
          },
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        message: `Email marked as ${isRead ? 'read' : 'unread'}`
      });
    } catch (error: any) {
      console.error('Error marking email as read:', error);
      res.status(500).json({ 
        error: 'Failed to mark email as read',
        details: error.message 
      });
    }
  }
}
