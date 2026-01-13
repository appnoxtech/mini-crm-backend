import e, { Request, Response } from "express";
import { EmailService } from "../services/emailService";
import { OAuthService } from "../services/oauthService";
import { EmailQueueService } from "../services/emailQueueService";
import { RealTimeNotificationService } from "../services/realTimeNotificationService";
import { AuthenticatedRequest } from "../../../shared/types";
import { EmailAccount } from "../models/types";
import { EmailModel } from "../models/emailModel";
import { summarizeThreadWithVLLM } from "../../../shared/utils/summarizer";
import { ResponseHandler } from "../../../shared/responses/responses";

export class EmailController {
  private emailService: EmailService;
  private oauthService: OAuthService;
  private queueService: EmailQueueService | undefined;
  private notificationService: RealTimeNotificationService | undefined;

  constructor(
    emailService: EmailService,
    oauthService: OAuthService,
    queueService?: EmailQueueService,
    notificationService?: RealTimeNotificationService,
  ) {
    this.emailService = emailService;
    this.oauthService = oauthService;
    this.queueService = queueService;
    this.notificationService = notificationService;
  }

  // Manual trigger for summarizing a thread
  async summarizeThread(req: Request, res: Response) {
    try {
      const threadId = req.params.threadId;
      const emailModel: EmailModel = this.emailService.getEmailModel();

      const { emails } = await this.emailService.getAllEmails({ limit: 1000 });
      // console.log(emails);
      const threadEmails = emails.filter((e) => e.threadId === threadId);

      if (!threadEmails.length) {
        return ResponseHandler.error(res, "Thread not found", 404);

      }

      const threadText = threadEmails
        .map((e) => `${e.from}: ${e.body}`)
        .join("\n");

      const summary = await summarizeThreadWithVLLM(threadText);

      await emailModel.saveThreadSummary(threadId!, summary);

      return ResponseHandler.success(res, { threadId, summary }, "Successfully Summarizing a Thread");
    } catch (err: any) {
      console.error(err);
      return ResponseHandler.internalError(res, err.message);
    }
  }

  // Get summary for a thread
  async getThreadSummary(req: Request, res: Response) {
    try {
      const threadId = req.params.threadId;
      const emailModel: EmailModel = this.emailService.getEmailModel();

      const summaryData = await emailModel.getThreadSummary(threadId!);

      if (!summaryData) {
        return ResponseHandler.error(res, "No summary available", 404);
      }

      return ResponseHandler.success(res, summaryData, "Thread Summary Fetched Successfully");
    } catch (err: any) {
      console.error(err);
      return ResponseHandler.internalError(res, err.message);
    }
  }



  async sendEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");
      }

      const { to, subject, body, htmlBody, attachments } =
        (req.body as any) || {};

      if (!to || !subject || !body) {
        return ResponseHandler.notFound(res, "Missing required fields: to, subject, body");
      }

      // Get user's email account from database
      const emailAccount = await this.emailService.getEmailAccountByUserId(
        req.user.id.toString()
      );
      if (!emailAccount) {

        return ResponseHandler.notFound(res, "No email account configured OR Please connect your email account first");
      }

      // Validate and refresh OAuth tokens if needed
      if (
        emailAccount.accessToken &&
        (emailAccount.provider === "gmail" ||
          emailAccount.provider === "outlook")
      ) {
        try {
          await this.validateAndRefreshTokens(emailAccount);
        }
        catch (error: any) {
          console.error("Token validation failed:", error);


          return ResponseHandler.error(
            res,
            `Your ${emailAccount.provider} account needs to be re-connected. Please go to email settings and reconnect your account.`,
          );
        }
      }

      const messageId = await this.emailService.sendEmail(emailAccount.id, {
        to: Array.isArray(to) ? to : [to],
        subject,
        body,
        htmlBody,
        attachments,
      });

      return ResponseHandler.success(res, "Email sent successfully", messageId);

    } catch (error: any) {
      console.error("Email send failed:", error);

      // Check for specific error types and provide appropriate responses
      if (
        error.message.includes("re-authenticate") ||
        error.message.includes("re-authorize") ||
        error.message.includes("expired or revoked") ||
        error.message.includes("invalid_grant")
      ) {
        res.status(401).json({
          error: "Email account needs re-authorization",
          details: error.message,
          requiresReauth: true,
          action:
            "Please go to the email setup page and reconnect your email account.",
        });
      } else {
        return ResponseHandler.internalError(res, "Failed to send email");
      }
    }
  }

  // New method to validate and refresh OAuth tokens
  private async validateAndRefreshTokens(emailAccount: any): Promise<void> {
    if (!emailAccount.accessToken || !emailAccount.refreshToken) {
      throw new Error("No OAuth tokens available");
    }

    // For now, we'll skip automatic token refresh and just validate the account exists
    // This is a simpler approach that will work even without OAuth credentials configured
    console.log(
      `Validating OAuth account: ${emailAccount.provider} - ${emailAccount.email}`
    );

    // Check if the account is properly configured
    if (!emailAccount.isActive) {
      throw new Error("Email account is not active");
    }

    // If we have OAuth credentials configured, we can try to refresh
    // Otherwise, we'll assume the tokens are valid and let the email sending process handle errors
    const hasOAuthConfig =
      (emailAccount.provider === "gmail" && process.env.GOOGLE_CLIENT_ID) ||
      (emailAccount.provider === "outlook" && process.env.MICROSOFT_CLIENT_ID);

    if (hasOAuthConfig) {
      try {
        const refreshResult = await this.oauthService.refreshTokenIfNeeded(
          emailAccount
        );

        if (refreshResult) {
          // Update the account with new tokens
          await this.emailService.updateEmailAccount(emailAccount.id, {
            accessToken: refreshResult.accessToken,
            refreshToken:
              refreshResult.refreshToken || emailAccount.refreshToken,
            updatedAt: new Date(),
          });

          console.log(
            `Successfully refreshed tokens for ${emailAccount.provider} account: ${emailAccount.email}`
          );
        }
      } catch (error: any) {
        console.error(
          `Token refresh failed for ${emailAccount.provider} account:`,
          error
        );
        // Don't throw here - let the email sending process handle the error
        // This way, if the token is still valid, email sending might still work
      }
    } else {
      console.log(
        `OAuth credentials not configured for ${emailAccount.provider}, skipping token refresh`
      );
    }
  }

  // New endpoint to validate email account tokens
  async validateEmailAccount(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      // Get user's email account from database
      const emailAccount = await this.emailService.getEmailAccountByUserId(
        req.user.id.toString()
      );
      if (!emailAccount) {

        return ResponseHandler.notFound(res, "No email account found");

      }

      // For OAuth accounts, validate and refresh tokens
      if (
        emailAccount.accessToken &&
        (emailAccount.provider === "gmail" ||
          emailAccount.provider === "outlook")
      ) {
        try {
          await this.validateAndRefreshTokens(emailAccount);

          return ResponseHandler.success(res, emailAccount, "Email account is valid and ready to use");

        } catch (error: any) {

          return ResponseHandler.error(res, `Your ${emailAccount.provider} account needs to be re-connected. Please go to email settings and reconnect your account.`, 400);
        }

      } else {
        // For SMTP accounts, just return success

        return ResponseHandler.success(
          res,
          emailAccount,
          "Email account is valid and ready to use"
        );
      }
    } catch (error: any) {
      console.error("Email account validation failed:", error);

      return ResponseHandler.internalError(res, "Failed to validate email account");
    }
  }



  async getEmailsForContact(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");
      }

      const { contactId } = (req as any).params;

      const emails = await this.emailService.getEmailsForContact(contactId);
      return ResponseHandler.success(res, emails, "Data Fetched Successfully");

    } catch (error: any) {

      return ResponseHandler.internalError(res, "Failed to fetch emails");
    }
  }

  async getEmailsForDeal(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");
      }

      const { dealId } = (req as any).params;

      const emails = await this.emailService.getEmailsForDeal(dealId);


      return ResponseHandler.success(res, emails, "Data Fetched Successfully");


    } catch (error: any) {
      console.error("Error fetching emails for deal:", error);

      return ResponseHandler.internalError(res, "Failed to fetch emails");

    }
  }

  async handleEmailOpen(req: Request, res: Response): Promise<void> {
    try {
      const { trackingId } = req.params;

      // TODO: Implement tracking logic
      console.log("Email opened:", trackingId);

      const pixel = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
        "base64"
      );
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": pixel.length,
        "Cache-Control": "no-cache",
      });

      return ResponseHandler.success(res, pixel);

    } catch (error: any) {
      console.error("Error handling email open:", error);
      return ResponseHandler.internalError(res, "Tracking failed");
    }
  }

  async handleLinkClick(req: Request, res: Response): Promise<void> {
    try {
      const { trackingId } = req.params;
      const { url } = req.query;

      // TODO: Implement tracking logic
      console.log("Link clicked:", trackingId, url);

      const originalUrl = (url as string) || "/";
      res.redirect(originalUrl);
    } catch (error: any) {
      console.error("Error handling link click:", error);
      return ResponseHandler.internalError(res, "Tracking failed");
    }
  }

  // OAuth Authorization Endpoints
  async oauthGmailAuthorize(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.query as any;

      if (!userId) {
        return ResponseHandler.notFound(res, "User ID is required");
      }

      const authUrl = this.oauthService.generateGoogleAuthUrl(userId);

      return ResponseHandler.success(res, authUrl, "OAuth generate auth URL Successfully");

    } catch (error: any) {
      console.error("Gmail OAuth authorize error:", error);
      return ResponseHandler.internalError(res, "Failed to generate auth URL");
    }
  }

  async oauthOutlookAuthorize(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.query as any;

      if (!userId) {
        return ResponseHandler.notFound(res, "User ID is required");
      }

      const authUrl = await this.oauthService.generateMicrosoftAuthUrl(userId);

      return ResponseHandler.success(res, authUrl, 'Outlook generate auth URL Successfully');

    } catch (error: any) {
      console.error("Outlook OAuth authorize error:", error);
      return ResponseHandler.internalError(res, "Failed to generate auth URL");
    }
  }

  // OAuth Status Check Endpoints
  async oauthGmailStatus(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.query as any;

      if (!userId) {
        return ResponseHandler.notFound(res, "User ID is required");
      }

      // Check if user has a connected Gmail account
      const emailAccount = await this.emailService.getEmailAccountByUserId(
        userId
      );

      const connected = !!(
        emailAccount &&
        emailAccount.provider === "gmail" &&
        emailAccount.accessToken
      );

      return ResponseHandler.success(res, connected);
    } catch (error: any) {
      console.error("Gmail OAuth status check error:", error);
      return ResponseHandler.internalError(res, "Failed to check OAuth status");
    }
  }

  async oauthOutlookStatus(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.query as any;

      if (!userId) {
        return ResponseHandler.notFound(res, "User ID is required");
      }

      // Check if user has a connected Outlook account
      const emailAccount = await this.emailService.getEmailAccountByUserId(
        userId
      );
      const connected = !!(
        emailAccount &&
        emailAccount.provider === "outlook" &&
        emailAccount.accessToken
      );

      return ResponseHandler.success(res, connected);
    } catch (error: any) {
      console.error("Outlook OAuth status check error:", error);
      return ResponseHandler.error(res, "Failed to check OAuth status");
    }
  }

  // OAuth Callback Endpoints
  async oauthGmailCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state } = req.query as any;

      if (!code || !state) {

        return ResponseHandler.error(res, "Authorization code and state are required", 400);

      }

      const oauthResult = await this.oauthService.handleGoogleCallback(
        code,
        state
      );

      console.log("OAuth callback result:", {
        userId: oauthResult.userId,
        email: oauthResult.email,
        hasAccessToken: !!oauthResult.accessToken,
        hasRefreshToken: !!oauthResult.refreshToken,
        accessTokenLength: oauthResult.accessToken?.length || 0,
        refreshTokenLength: oauthResult.refreshToken?.length || 0,
      });

      // Check if user already has an email account
      const existingAccount = await this.emailService.getEmailAccountByUserId(
        oauthResult.userId
      );

      if (existingAccount) {
        // Update existing account with new tokens (encrypt them before storing)
        console.log("Updating existing Gmail account with new tokens:", {
          accountId: existingAccount.id,
          email: existingAccount.email,
          provider: existingAccount.provider,
        });

        await this.emailService.updateEmailAccount(existingAccount.id, {
          accessToken: this.oauthService.encryptToken(oauthResult.accessToken),
          refreshToken: this.oauthService.encryptToken(
            oauthResult.refreshToken
          ),
          updatedAt: new Date(),
        });

        console.log("Gmail account updated successfully with new tokens");
      } else {
        // Create new email account from OAuth result
        console.log("Creating new Gmail account from OAuth result");
        const emailAccount = this.oauthService.createEmailAccountFromOAuth(
          oauthResult.userId,
          oauthResult.email,
          "gmail",
          oauthResult.accessToken,
          oauthResult.refreshToken
        );

        // Save to database
        await this.emailService.createEmailAccount(emailAccount);
      }

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

      console.log("Redirecting to frontend with success:", {
        frontendUrl,
        email: oauthResult.email,
        userId: oauthResult.userId,
      });

      return res.redirect(
        `${frontendUrl}/auth/callback?success=true&provider=gmail&email=${oauthResult.email}&userId=${oauthResult.userId}`
      );
    } catch (error: any) {
      console.error("Gmail OAuth callback error:", error);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      return res.redirect(
        `${frontendUrl}/auth/callback?success=false&error=${encodeURIComponent(
          error.message
        )}`
      );
    }
  }

  async oauthOutlookCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state } = req.query as any;

      if (!code || !state) {
        return ResponseHandler.error(res, "Authorization code and state are required");
      }

      const oauthResult = await this.oauthService.handleMicrosoftCallback(
        code,
        state
      );

      // Check if user already has an email account
      const existingAccount = await this.emailService.getEmailAccountByUserId(
        oauthResult.userId
      );

      if (existingAccount) {
        // Update existing account with new tokens (encrypt them before storing)
        await this.emailService.updateEmailAccount(existingAccount.id, {
          accessToken: this.oauthService.encryptToken(oauthResult.accessToken),
          refreshToken: this.oauthService.encryptToken(
            oauthResult.refreshToken
          ),
          updatedAt: new Date(),
        });
      } else {
        // Create new email account from OAuth result
        const emailAccount = this.oauthService.createEmailAccountFromOAuth(
          oauthResult.userId,
          oauthResult.email,
          "outlook",
          oauthResult.accessToken,
          oauthResult.refreshToken
        );

        // Save to database
        await this.emailService.createEmailAccount(emailAccount);
      }

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      res.redirect(
        `${frontendUrl}/auth/callback?success=true&provider=outlook&email=${oauthResult.email}&userId=${oauthResult.userId}`
      );
    } catch (error: any) {
      console.error("Outlook OAuth callback error:", error);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      res.redirect(
        `${frontendUrl}/auth/callback?success=false&error=${encodeURIComponent(
          error.message
        )}`
      );
    }
  }

  // Email account management endpoints
  async getEmailAccounts(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");
      }

      const accounts = await this.emailService.getEmailAccounts(
        req.user.id.toString()
      );
      console.log("📧 Email accounts for user", req.user.id, ":", accounts);

      return ResponseHandler.success(res, accounts, "Fetched Email Accounts Successfully ");


    } catch (error: any) {
      console.error("Error fetching email accounts:", error);
      return ResponseHandler.internalError(res, "Failed to fetch email accounts");
    }
  }

  async connectEmailAccount(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");
      }

      const { email, provider, smtpConfig } = req.body as any;

      if (!email || !provider || !smtpConfig) {
        return ResponseHandler.validationError(res, "Missing required fields: email, provider, smtpConfig");
      }

      const account: EmailAccount = {
        id: `${req.user.id}-${email}`,
        userId: req.user.id.toString(),
        email,
        provider,
        smtpConfig,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const createdAccount = await this.emailService.createEmailAccount(
        account
      );

      return ResponseHandler.created(res, createdAccount, "Email connect successfully");

    } catch (error: any) {

      console.error("Error connecting email account:", error);
      return ResponseHandler.internalError(res, "Failed to connect email account");
    }
  }

  async updateEmailAccount(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");

      }

      const { accountId } = (req as any).params;
      const updates = req.body as any;

      await this.emailService.updateEmailAccount(accountId, updates);
      return ResponseHandler.success(res, [], "Email account updated successfully");
    } catch (error: any) {
      console.error("Error updating email account:", error);
      res.status(500).json({ error: "Failed to update email account" });
    }
  }





  // Email sync management endpoints
  async triggerEmailSync(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");
      }

      const { accountId } = req.params;

      if (!accountId) {
        return ResponseHandler.validationError(res, "Account ID is required");
      }

      // Get user's email account
      const accounts = await this.emailService.getEmailAccounts(
        req.user.id.toString()
      );
      const account = accounts.find((acc) => acc.id === accountId);

      if (!account) {
        return ResponseHandler.notFound(res, "Email account not found");
      }

      if (this.queueService) {
        // Queue the sync with high priority for manual triggers
        this.queueService.queueEmailSync(
          accountId,
          req.user.id.toString(),
          "high"
        );

        if (this.notificationService) {
          this.notificationService.notifySyncStatus(
            req.user.id.toString(),
            accountId,
            "starting"
          );
        }

        return ResponseHandler.success(res,
          accountId,
          "Email sync queued successfully");

      } else {
        // Fallback to direct processing if queue service not available
        const result = await this.emailService.processIncomingEmails(account);

        return ResponseHandler.success(
          res,
          result,
          "Email sync completed",
        );
      }
    } catch (error: any) {
      console.error("Error triggering email sync:", error);
      return ResponseHandler.internalError(res, "Failed to trigger email sync")
    }
  }

  async getQueueStatus(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");

      }

      if (!this.queueService) {
        return ResponseHandler.error(res, "Queue service not available", 503);

      }

      const status = this.queueService.getQueueStatus();

      return ResponseHandler.success(res, status);
    } catch (error: any) {
      console.error("Error getting queue status:", error);
      return ResponseHandler.internalError(res, "Failed to get queue status");
    }
  }

  async getNotificationStats(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");

      }

      if (!this.notificationService) {
        return ResponseHandler.error(res, "Notification service not available", 502);

      }

      const stats = this.notificationService.getConnectionStats();
      const isConnected = this.notificationService.isUserConnected(
        req.user.id.toString()
      );

      return ResponseHandler.success(res,
        {
          ...stats,
          currentUserConnected: isConnected,
        },
        "Notify Successfully!"
      )

    } catch (error: any) {
      console.error("Error getting notification stats:", error);
      return ResponseHandler.internalError(res, "Failed to get notification stats");
    }
  }


  // Get emails for the user's inbox
  async getEmails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");

      }

      const { limit, offset, folder, search, unreadOnly } = req.query;

      const emails = await this.emailService.getEmailsForUser(
        req.user.id.toString(),
        {
          limit: limit ? parseInt(limit as string) : 50,
          offset: offset ? parseInt(offset as string) : 0,
          folder: (folder as string) || "inbox",
          search: search as string,
          unreadOnly: unreadOnly === "true",
        }
      );

      return ResponseHandler.success(res, emails, "Emails Fetched Successfully");

    } catch (error: any) {
      console.error("Error ", error);
      return ResponseHandler.internalError(res, "Failed to get emails");
    }
  }

  // Get a specific email by ID
  async getEmailById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {

        return ResponseHandler.unauthorized(res, "User not authenticated");
      }

      const { emailId } = req.params;
      if (!emailId) {
        return ResponseHandler.error(res, "Email ID is required");
      }

      const email = await this.emailService.getEmailById(
        emailId,
        req.user.id.toString()
      );
      if (!email) {
        return ResponseHandler.notFound(res, "Email not found");

      }

      return ResponseHandler.success(res, email);
    } catch (error: any) {
      console.error("Error getting email:", error);

      return ResponseHandler.internalError(res, "Failed to get email");
    }
  }

  // Mark email as read/unread
  async markEmailAsRead(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");

      }

      const { emailId } = req.params;
      const { isRead = true } = req.body;

      if (!emailId) {
        return ResponseHandler.error(res, "Email ID is required");

      }

      const success = await this.emailService.markEmailAsRead(
        emailId,
        req.user.id.toString(),
        isRead
      );
      if (!success) {
        return ResponseHandler.notFound(res, "Email not found");

      }

      // Notify user about email read status change
      if (this.notificationService) {
        this.notificationService.notifyUser(req.user.id.toString(), {
          type: "email_status_changed",
          data: {
            emailId,
            isRead,
            timestamp: new Date(),
          },
          timestamp: new Date(),
        });
      }

      return ResponseHandler.success(res, `Email marked as ${isRead ? "read" : "unread"}`);
    } catch (error: any) {
      console.error("Error marking email as read:", error);
      return ResponseHandler.internalError(res, "Failed to mark email as read");
    }
  }
}
