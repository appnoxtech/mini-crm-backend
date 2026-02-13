import type { Request, Response } from "express";
import axios from "axios";
import { DraftService } from "../services/draftService";
import { EmailService } from "../services/emailService";
import { OAuthService } from "../services/oauthService";
import { EmailQueueService } from "../services/emailQueueService";
import { RealTimeNotificationService } from "../services/realTimeNotificationService";
import { AuthenticatedRequest } from "../../../shared/types";
import { EmailAccount, Email } from "../models/types";
import { EmailModel } from "../models/emailModel";
import { summarizeThreadWithVLLM } from "../../../shared/utils/summarizer";
import { ResponseHandler } from "../../../shared/responses/responses";
import { DealHistoryModel, DealHistory } from "../../pipelines/models/DealHistory";
import { QuotaValidationService } from "../services/quotaValidationService";

/**
 * Get SMTP/IMAP server defaults based on provider name
 * Reads from environment variables with fallback to known provider settings
 */
function getProviderDefaults(provider: string): {
  smtp: { host: string; port: number; secure: boolean };
  imap: { host: string; port: number; secure: boolean };
} {
  const providerUpper = provider.toUpperCase();

  // Try provider-specific env vars first
  const smtpHost = process.env[`${providerUpper}_SMTP_HOST`];
  const smtpPort = process.env[`${providerUpper}_SMTP_PORT`];
  const smtpSecure = process.env[`${providerUpper}_SMTP_SECURE`];
  const imapHost = process.env[`${providerUpper}_IMAP_HOST`];
  const imapPort = process.env[`${providerUpper}_IMAP_PORT`];
  const imapSecure = process.env[`${providerUpper}_IMAP_SECURE`];

  // If provider-specific vars exist, use them
  if (smtpHost) {
    return {
      smtp: {
        host: smtpHost,
        port: parseInt(smtpPort || '587'),
        secure: smtpSecure === 'true',
      },
      imap: {
        host: imapHost || smtpHost.replace('smtp', 'imap'),
        port: parseInt(imapPort || '993'),
        secure: imapSecure !== 'false',
      },
    };
  }

  // Fallback to DEFAULT provider settings
  return {
    smtp: {
      host: process.env.DEFAULT_SMTP_HOST || 'smtp.hostinger.com',
      port: parseInt(process.env.DEFAULT_SMTP_PORT || '465'),
      secure: process.env.DEFAULT_SMTP_SECURE !== undefined ? process.env.DEFAULT_SMTP_SECURE === 'true' : true,
    },
    imap: {
      host: process.env.DEFAULT_IMAP_HOST || 'imap.hostinger.com',
      port: parseInt(process.env.DEFAULT_IMAP_PORT || '993'),
      secure: process.env.DEFAULT_IMAP_SECURE !== undefined ? process.env.DEFAULT_IMAP_SECURE === 'true' : true,
    },
  };
}
import { ListDraftsOptions } from "../models/draftTypes";

export class EmailController {
  private emailService: EmailService;
  private draftService: DraftService;
  private oauthService: OAuthService;
  private queueService: EmailQueueService | undefined;
  private notificationService: RealTimeNotificationService | undefined;
  private quotaService: QuotaValidationService | undefined;

  constructor(
    emailService: EmailService,
    draftService: DraftService, // Inject DraftService
    oauthService: OAuthService,
    queueService?: EmailQueueService,
    notificationService?: RealTimeNotificationService,
    quotaService?: QuotaValidationService
  ) {
    this.emailService = emailService;
    this.draftService = draftService; // Assign DraftService
    this.oauthService = oauthService;
    this.queueService = queueService;
    this.notificationService = notificationService;
    this.quotaService = quotaService;
  }

  // Manual trigger for summarizing a thread
  async summarizeThread(req: AuthenticatedRequest, res: Response) {
    try {
      const threadId = req.params.threadId;
      const emailModel: EmailModel = this.emailService.getEmailModel();

      const { emails } = await this.emailService.getAllEmails(req.user!.companyId, { limit: 1000 });
      // console.log(emails);
      const threadEmails = emails.filter((e) => e.threadId === threadId);

      if (!threadEmails.length) {
        return ResponseHandler.error(res, "Thread not found", 404);

      }

      const threadText = threadEmails
        .map((e) => `${e.from}: ${e.body}`)
        .join("\n");

      const summary = await summarizeThreadWithVLLM(threadText);

      await emailModel.saveThreadSummary(threadId!, req.user!.companyId, summary);

      return ResponseHandler.success(res, { threadId, summary }, "Successfully Summarizing a Thread");
    } catch (err: any) {
      console.error(err);
      return ResponseHandler.internalError(res, err.message);
    }
  }

  // Get summary for a thread
  async getThreadSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const threadId = req.params.threadId;
      const emailModel: EmailModel = this.emailService.getEmailModel();

      const summaryData = await emailModel.getThreadSummary(threadId!, req.user!.companyId);

      if (!summaryData) {
        return ResponseHandler.error(res, "No summary available", 404);
      }

      return ResponseHandler.success(res, summaryData, "Thread Summary Fetched Successfully");
    } catch (err: any) {
      console.error(err);
      return ResponseHandler.internalError(res, err.message);
    }
  }

  // Get all emails for a thread
  async getThreadEmails(req: AuthenticatedRequest, res: Response) {
    try {
      const threadId = req.params.threadId;
      if (!threadId) {
        return ResponseHandler.validationError(res, "Thread ID is required");
      }

      const emails = this.emailService.getEmailModel().getEmailsForThread(threadId, req.user!.companyId);
      return ResponseHandler.success(res, emails, "Thread emails fetched successfully");
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

      const { to, cc, bcc, subject, body, htmlBody, attachments, dealId, email, from, provider, smtpConfig, enableTracking } =
        (req.body as any) || {};

      if (!to || !subject || !body) {
        return ResponseHandler.error(res, "Missing required fields: to, subject, body", 400);
      }

      let emailAccount: EmailAccount | null = null;
      const userId = req.user.id.toString();

      // 1. Determine which email address to use as the base for account resolution
      const targetEmail = from ?? email ?? req.user.email;
      const accountId = `${userId}-${targetEmail}`;
      console.log("accountId", accountId);
      // 2. Try to find the specific account for this user and email
      emailAccount = await this.emailService.getEmailModel().getEmailAccountById(accountId, req.user.companyId);
      console.log("emailAccount", emailAccount);
      // 3. Fallback: if no specific account found, use the user's first connected account
      if (!emailAccount) {
        emailAccount = await this.emailService.getEmailAccountByUserId(userId, req.user.companyId);
      }

      // 4. Handle SMTP Configuration (Direct update or override)
      if (smtpConfig) {
        const providerName = provider || (emailAccount ? emailAccount.provider : 'custom');
        const providerDefaults = getProviderDefaults(providerName);

        // Merge provided config with existing account config (to preserve username/password if missing in request)
        const finalSmtpConfig = {
          host: smtpConfig.host || (emailAccount?.smtpConfig?.host) || providerDefaults.smtp.host,
          port: smtpConfig.port || (emailAccount?.smtpConfig?.port) || providerDefaults.smtp.port,
          secure: smtpConfig.secure !== undefined ? smtpConfig.secure : (emailAccount?.smtpConfig?.secure !== undefined ? emailAccount.smtpConfig.secure : providerDefaults.smtp.secure),
          username: smtpConfig.username || (emailAccount?.smtpConfig?.username),
          password: smtpConfig.password || (emailAccount?.smtpConfig?.password),
        };

        // Also ensure imapConfig is populated if this is an IMAP provider
        let finalImapConfig = emailAccount?.imapConfig;
        if (providerName === 'imap' || providerName === 'custom') {
          finalImapConfig = {
            host: providerDefaults.imap.host,
            port: providerDefaults.imap.port,
            secure: providerDefaults.imap.secure,
            username: finalSmtpConfig.username,
            password: finalSmtpConfig.password,
            ...emailAccount?.imapConfig, // Preserve existing if any
          };
        }

        const accountData: EmailAccount = {
          id: accountId,
          userId,
          companyId: req.user!.companyId,
          email: targetEmail,
          provider: providerName,
          isActive: true,
          smtpConfig: finalSmtpConfig,
          imapConfig: finalImapConfig,
          createdAt: emailAccount ? emailAccount.createdAt : new Date(),
          updatedAt: new Date(),
        };

        // Check if this specific account exists in DB to decide between update and create
        const dbAccount = await this.emailService.getEmailModel().getEmailAccountById(accountId, req.user.companyId);
        if (dbAccount) {
          accountData.createdAt = dbAccount.createdAt;
          await this.emailService.updateEmailAccount(accountId, req.user.companyId, accountData);
        } else {
          await this.emailService.createEmailAccount(accountData);
        }

        emailAccount = accountData;
      }

      if (!emailAccount) {
        return ResponseHandler.notFound(res, "No email account configured OR Please connect your email account first");
      }

      // Validate and refresh OAuth tokens if needed (only for stored OAuth accounts)
      if (
        !smtpConfig &&
        emailAccount.accessToken &&
        (emailAccount.provider === "gmail" ||
          emailAccount.provider === "outlook")
      ) {
        try {
          await this.validateAndRefreshTokens(emailAccount);
        } catch (error: any) {
          console.error("Token validation failed:", error);
          return ResponseHandler.error(
            res,
            `Your ${emailAccount.provider} account needs to be re-connected. Please go to email settings and reconnect your account.`,
            401
          );
        }
      }

      const messageId = await this.emailService.sendEmail(emailAccount, {
        to: Array.isArray(to) ? to : [to],
        cc: Array.isArray(cc) ? cc : (cc ? [cc] : undefined),
        bcc: Array.isArray(bcc) ? bcc : (bcc ? [bcc] : undefined),
        subject,
        body,
        htmlBody,
        attachments,
        dealId: dealId ? Number(dealId) : undefined,
        enableTracking: !!enableTracking,
      }, req.user.companyId);

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
          await this.emailService.updateEmailAccount(emailAccount.id, emailAccount.companyId, {
            accessToken: refreshResult.accessToken,
            refreshToken:
              refreshResult.refreshToken || emailAccount.refreshToken,
            updatedAt: new Date(),
          });


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
        req.user.id.toString(),
        req.user.companyId
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

      const emails = await this.emailService.getEmailsForContact(contactId, req.user.companyId);
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

      const emails = await this.emailService.getEmailsForDeal(dealId, req.user.companyId);


      return ResponseHandler.success(res, emails, "Data Fetched Successfully");


    } catch (error: any) {
      console.error("Error fetching emails for deal:", error);

      return ResponseHandler.internalError(res, "Failed to fetch emails");

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
      const companyId = await this.emailService.getEmailModel().getCompanyIdForUser(userId);
      if (!companyId) return ResponseHandler.notFound(res, "User company not found");

      const emailAccount = await this.emailService.getEmailAccountByUserId(
        userId,
        companyId
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
      const companyId = await this.emailService.getEmailModel().getCompanyIdForUser(userId);
      if (!companyId) return ResponseHandler.notFound(res, "User company not found");

      const emailAccount = await this.emailService.getEmailAccountByUserId(
        userId,
        companyId
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



      // Fetch companyId since it's missing from OAuth result
      const companyId = await this.emailService.getEmailModel().getCompanyIdForUser(oauthResult.userId);
      if (!companyId) {
        throw new Error('User company not found');
      }

      // Check if user already has THIS SPECIFIC email account
      const userAccounts = await this.emailService.getEmailAccounts(oauthResult.userId, companyId);
      const existingAccount = userAccounts.find(acc => acc.email === oauthResult.email);

      if (existingAccount) {
        // Update existing account with new tokens (encrypt them before storing)


        await this.emailService.updateEmailAccount(existingAccount.id, companyId, {
          accessToken: this.oauthService.encryptToken(oauthResult.accessToken),
          refreshToken: this.oauthService.encryptToken(
            oauthResult.refreshToken
          ),
          updatedAt: new Date(),
        });


      } else {
        // Create new email account from OAuth result
        const companyId = await this.emailService.getEmailModel().getCompanyIdForUser(oauthResult.userId);

        if (!companyId) {
          throw new Error('User company not found');
        }

        const emailAccount = this.oauthService.createEmailAccountFromOAuth(
          oauthResult.userId,
          companyId,
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

      // Fetch companyId since it's missing from OAuth result
      const companyId = await this.emailService.getEmailModel().getCompanyIdForUser(oauthResult.userId);
      if (!companyId) {
        throw new Error('User company not found');
      }

      // Check if user already has an email account
      const existingAccount = await this.emailService.getEmailAccountByUserId(
        oauthResult.userId,
        companyId
      );

      if (existingAccount) {
        // Update existing account with new tokens (encrypt them before storing)
        await this.emailService.updateEmailAccount(existingAccount.id, companyId, {
          accessToken: this.oauthService.encryptToken(oauthResult.accessToken),
          refreshToken: this.oauthService.encryptToken(
            oauthResult.refreshToken
          ),
          updatedAt: new Date(),
        });
      } else {
        // Create new email account from OAuth result
        const companyId = await this.emailService.getEmailModel().getCompanyIdForUser(oauthResult.userId);

        if (!companyId) {
          throw new Error('User company not found');
        }

        const emailAccount = this.oauthService.createEmailAccountFromOAuth(
          oauthResult.userId,
          companyId,
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
        req.user.id.toString(),
        req.user.companyId
      );


      return ResponseHandler.success(res, accounts, "Fetched Email Accounts Successfully ");


    } catch (error: any) {
      console.error("Error fetching email accounts:", error);
      return ResponseHandler.internalError(res, "Failed to fetch email accounts");
    }
  }

  /**
   * Test SMTP and/or IMAP connection before saving account
   * This allows users to validate credentials before committing to an account
   */
  async testConnection(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");
      }

      const { smtpConfig, imapConfig } = req.body as any;


      if (!smtpConfig && !imapConfig) {
        return ResponseHandler.validationError(
          res,
          "At least one of smtpConfig or imapConfig is required"
        );
      }

      const results: {
        smtp?: { success: boolean; message: string };
        imap?: { success: boolean; message: string };
      } = {};

      // Test SMTP if provided
      if (smtpConfig) {
        if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.username || !smtpConfig.password) {
          return ResponseHandler.validationError(
            res,
            "SMTP config requires: host, port, username, password"
          );
        }
        results.smtp = await this.emailService.testSmtpConnection(smtpConfig);
      }

      // Test IMAP if provided
      if (imapConfig) {
        if (!imapConfig.host || !imapConfig.port || !imapConfig.username || !imapConfig.password) {
          return ResponseHandler.validationError(
            res,
            "IMAP config requires: host, port, username, password"
          );
        }
        results.imap = await this.emailService.testImapConnection(imapConfig);
      }

      // Check if any test failed
      const allSuccessful =
        (!results.smtp || results.smtp.success) &&
        (!results.imap || results.imap.success);

      if (allSuccessful) {
        return ResponseHandler.success(res, results, "Connection test successful");
      } else {
        return ResponseHandler.validationError(res, results, "Connection test failed");
      }
    } catch (error: any) {
      console.error("Error testing connection:", error);
      return ResponseHandler.internalError(res, "Failed to test connection");
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

      const { email, provider, smtpConfig, imapConfig } = req.body as any;

      // Require email and provider
      if (!email || !provider) {
        return ResponseHandler.validationError(
          res,
          "Missing required fields: email, provider"
        );
      }

      // For custom IMAP providers, require at least username/password for SMTP
      if (provider === 'imap') {
        if (!smtpConfig?.username || !smtpConfig?.password) {
          return ResponseHandler.validationError(
            res,
            "SMTP username and password are required for custom email accounts"
          );
        }

        const isAccountCurrent = await this.emailService.testSmtpConnection(smtpConfig);

        const allSuccessful = isAccountCurrent.success;

        if (!allSuccessful) {
          return ResponseHandler.validationError(
            res,
            "SMTP username & password are incorrect"
          );
        }
      }

      // Check if account already exists
      const accountId = `${req.user.id}-${email}`;
      console.log("accountId", accountId);

      const existingAccount = await this.emailService.getEmailModel().getEmailAccountById(accountId, req.user.companyId);


      // Get provider-specific defaults from environment
      const providerDefaults = getProviderDefaults(provider);

      // Prepare updated account data
      const account: EmailAccount = {
        id: accountId,
        userId: req.user.id.toString(),
        companyId: req.user!.companyId,
        email,
        provider,
        isActive: true,
        createdAt: existingAccount ? existingAccount.createdAt : new Date(),
        updatedAt: new Date(),
      };

      // Build SMTP config - preserve existing if not provided
      if (smtpConfig) {
        account.smtpConfig = {
          host: smtpConfig.host || providerDefaults.smtp.host,
          port: smtpConfig.port || providerDefaults.smtp.port,
          secure: smtpConfig.secure !== undefined ? smtpConfig.secure : providerDefaults.smtp.secure,
          username: smtpConfig.username,
          password: smtpConfig.password,
        };
      } else if (existingAccount?.smtpConfig) {
        account.smtpConfig = existingAccount.smtpConfig;
      }

      // Build IMAP config - preserve existing, or infer from smtpConfig if needed
      if (imapConfig) {
        account.imapConfig = {
          host: imapConfig.host || providerDefaults.imap.host,
          port: imapConfig.port || providerDefaults.imap.port,
          secure: imapConfig.secure !== undefined ? imapConfig.secure : providerDefaults.imap.secure,
          username: imapConfig.username,
          password: imapConfig.password,
        };
      } else if (existingAccount?.imapConfig) {
        account.imapConfig = existingAccount.imapConfig;
      } else if (provider === 'imap' || provider === 'custom') {
        // Inference logic for new IMAP accounts or those missing it
        const smtpToUse = account.smtpConfig || smtpConfig;
        if (smtpToUse?.username && smtpToUse?.password) {
          // If we have an SMTP host, try to infer the IMAP host from it
          // e.g. smtp.example.com -> imap.example.com
          // If invalid or unsure, fallback to providerDefaults (which might be system defaults)
          let inferredImapHost = providerDefaults.imap.host;

          if (smtpToUse.host) {
            if (smtpToUse.host.startsWith('smtp.')) {
              inferredImapHost = smtpToUse.host.replace('smtp.', 'imap.');
            } else {
              // If it's something like 'mail.example.com', IMAP often uses the same host
              inferredImapHost = smtpToUse.host;
            }
          }

          account.imapConfig = {
            host: inferredImapHost,
            port: providerDefaults.imap.port, // Default port (993) is usually safe to guess
            secure: providerDefaults.imap.secure,
            username: smtpToUse.username,
            password: smtpToUse.password,
          };
          console.log(`Inferred IMAP config for ${email}: host=${inferredImapHost}`);
        }
      }

      // Preserve tokens if not providing new ones
      if (existingAccount?.accessToken && !account.accessToken) {
        account.accessToken = existingAccount.accessToken;
      }
      if (existingAccount?.refreshToken && !account.refreshToken) {
        account.refreshToken = existingAccount.refreshToken;
      }

      if (existingAccount) {
        console.log(`Updating existing email account: ${accountId}`);
        await this.emailService.updateEmailAccount(accountId, req.user!.companyId, account);

        // For IMAP: Quick load 100 emails first, then sync rest in background
        if (provider === 'imap' || provider === 'custom') {
          // Quick initial load (100 latest emails - returns fast)
          this.emailService.quickInitialLoadIMAP(account).then(result => {
            console.log(`Quick loaded ${result.count} emails for ${account.email}`);
            // Then trigger full historical sync in background
            this.emailService.triggerHistoricalSync(accountId, req.user!.companyId);
          }).catch(err => {
            console.error(`Quick load failed for ${accountId}:`, err);
          });
        } else {
          // OAuth providers - use standard sync
          this.emailService.processIncomingEmails(account).catch(err =>
            console.error(`Initial sync failed for ${accountId}:`, err)
          );
        }

        return ResponseHandler.success(res, account, "Email account updated successfully");
      } else {
        const createdAccount = await this.emailService.createEmailAccount(account);

        // For IMAP: Quick load 100 emails first, then sync rest in background
        if (provider === 'imap' || provider === 'custom') {
          // Quick initial load (100 latest emails - returns fast)
          this.emailService.quickInitialLoadIMAP(createdAccount).then(result => {
            console.log(`Quick loaded ${result.count} emails for ${createdAccount.email}`);
            // Then trigger full historical sync in background
            this.emailService.triggerHistoricalSync(createdAccount.id, req.user!.companyId);
          }).catch(err => {
            console.error(`Quick load failed for ${createdAccount.id}:`, err);
          });
        } else {
          // OAuth providers - use standard sync
          this.emailService.processIncomingEmails(createdAccount).catch(err =>
            console.error(`Initial sync failed for ${accountId}:`, err)
          );
        }

        return ResponseHandler.created(res, createdAccount, "Email account connected successfully");
      }

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

      await this.emailService.updateEmailAccount(accountId, req.user.companyId, updates);
      return ResponseHandler.success(res, [], "Email account updated successfully");
    } catch (error: any) {
      console.error("Error updating email account:", error);
      return ResponseHandler.internalError(res, "Failed to update email account");
    }
  }

  /**
   * Delete (deactivate) an email account
   * Performs soft delete by setting isActive = false
   */
  async deleteEmailAccount(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");
      }

      const { accountId } = (req as any).params;

      if (!accountId) {
        return ResponseHandler.validationError(res, "Account ID is required");
      }

      // Verify the account belongs to the user
      const accounts = await this.emailService.getEmailAccounts(
        req.user.id.toString(),
        req.user.companyId
      );
      const account = accounts.find((acc) => acc.id === accountId);

      if (!account) {
        return ResponseHandler.notFound(res, "Email account not found");
      }

      // Soft delete by deactivating
      await this.emailService.updateEmailAccount(accountId, req.user.companyId, {
        isActive: false,
      });

      return ResponseHandler.success(res, null, "Email account deleted successfully");
    } catch (error: any) {
      console.error("Error deleting email account:", error);
      return ResponseHandler.internalError(res, "Failed to delete email account");
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
        req.user.id.toString(),
        req.user.companyId
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
          req.user.companyId,
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

  async triggerArchiveSync(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");
      }

      console.log(`Manual archive sync triggered for user ${req.user.id}`);

      const result = await this.emailService.syncArchivedEmails(req.user.id.toString(), req.user.companyId);

      return ResponseHandler.success(res, result, "Archive sync completed");
    } catch (error: any) {
      console.error("Error triggering archive sync:", error);
      return ResponseHandler.internalError(res, "Failed to sync archives: " + error.message);
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

      const { limit, offset, folder, search, unreadOnly, accountId, emailAddress } = req.query;

      let effectiveAccountId = accountId as string;

      // Resolve emailAddress to accountId if provided
      if (emailAddress && !effectiveAccountId) {
        try {
          const accounts = await this.emailService.getEmailAccounts(req.user.id.toString(), req.user.companyId);
          const matchingAccount = accounts.find(acc => acc.email.toLowerCase() === (emailAddress as string).toLowerCase());

          if (matchingAccount) {
            effectiveAccountId = matchingAccount.id;
            console.log(`Resolved emailAddress ${emailAddress} to accountId: ${effectiveAccountId}`);
          } else {
            console.log(`No matching account found for emailAddress: ${emailAddress}`);
            // If emailAddress was specified but not found, return empty results
            return ResponseHandler.success(res, { emails: [], total: 0 }, "No accounts found for the specified email address");
          }
        } catch (error) {
          console.error("Error resolving emailAddress to accountId:", error);
        }
      }

      // Handle on-demand sync before fetching from database
      if (effectiveAccountId) {
        try {
          const account = await this.emailService.getEmailAccountById(effectiveAccountId, req.user.companyId);
          if (account && account.userId === req.user.id.toString()) {
            // Trigger sync if never synced or synced > 2 minutes ago
            const syncInterval = 2 * 60 * 1000; // 2 minutes
            const needsSync = !account.lastSyncAt || (new Date().getTime() - new Date(account.lastSyncAt).getTime() > syncInterval);

            if (needsSync) {
              console.log(`Triggering background on-demand sync for account: ${account.email}`);
              // Trigger sync in background to keep response fast
              this.emailService.processIncomingEmails(account).catch(err =>
                console.error(`On-demand sync failed for ${account.email}:`, err)
              );
            }
          }
        } catch (syncError) {
          console.error("Error during on-demand sync:", syncError);
          // Continue to fetch from DB even if sync fails
        }
      } else {
        // If no specific accountId, trigger background sync for all user accounts
        try {
          const accounts = await this.emailService.getEmailAccounts(req.user.id.toString(), req.user.companyId);
          for (const account of accounts) {
            const syncInterval = 5 * 60 * 1000; // 5 mins for multi-account background sync
            const needsSync = !account.lastSyncAt || (new Date().getTime() - new Date(account.lastSyncAt).getTime() > syncInterval);

            if (needsSync) {
              // Don't await here to keep the response fast for multiple accounts
              this.emailService.processIncomingEmails(account).catch(err =>
                console.error(`Background sync failed for ${account.email}:`, err)
              );
            }
          }
        } catch (err) {
          console.error("Error triggering background syncs:", err);
        }
      }

      // Special handling for 'drafts' folder: Use DraftService with merged local + provider drafts
      if ((folder as string) === 'drafts') {
        const draftOptions: ListDraftsOptions = {
          limit: limit ? parseInt(limit as string) : 50,
          offset: offset ? parseInt(offset as string) : 0,
          search: search as string,
          accountId: effectiveAccountId,
        };

        const draftResult = await this.draftService.listAllDrafts(req.user.id.toString(), req.user.companyId, draftOptions);

        // Map drafts to Email interface structure for compatibility
        const mappedDrafts = draftResult.drafts.map(draft => ({
          id: draft.id,
          messageId: draft.id, // Use draft ID as message ID
          threadId: draft.threadId,
          accountId: draft.accountId,
          from: draft.from || '', // Drafts typically don't have a 'from' until sent, or it's the account's email
          to: draft.to,
          cc: draft.cc,
          bcc: draft.bcc,
          subject: draft.subject,
          body: draft.body,
          htmlBody: draft.htmlBody,
          snippet: draft.body?.substring(0, 100),
          isRead: true,
          isIncoming: false,
          sentAt: draft.updatedAt, // Use updated time as "sent" time for sorting
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt,
          folder: 'drafts',
          attachments: draft.attachments || [],
          hasAttachments: (draft.attachments?.length || 0) > 0,
          contactIds: draft.contactIds || [],
          dealIds: draft.dealIds || [],
          accountEntityIds: draft.accountEntityIds || [],
          companyId: req.user!.companyId,
          // Other fields can be defaults/undefined
        }));

        return ResponseHandler.success(res, { emails: mappedDrafts, total: draftResult.total }, "Drafts Fetched Successfully");
      }

      const emailsResponse = await this.emailService.getEmailsForUser(
        req.user.id.toString(),
        req.user.companyId,
        {
          limit: limit ? parseInt(limit as string) : 50,
          offset: offset ? parseInt(offset as string) : 0,
          folder: (folder as string) || "inbox",
          search: search as string,
          unreadOnly: unreadOnly === "true",
          accountId: effectiveAccountId,
        }
      );

      const emails: Email[] = emailsResponse.emails;

      // Special handling for 'trash' folder: Merge trashed drafts
      if ((folder as string) === 'trash') {
        try {
          const trashedDrafts = await this.draftService.getTrashedDrafts(
            req.user.id.toString(),
            req.user.companyId,
            limit ? parseInt(limit as string) : 50,
            offset ? parseInt(offset as string) : 0
          );

          if (trashedDrafts.drafts.length > 0) {
            const mappedDrafts = trashedDrafts.drafts.map(draft => ({
              id: draft.id,
              messageId: draft.id,
              threadId: draft.threadId,
              accountId: draft.accountId,
              from: draft.from || '',
              to: draft.to,
              cc: draft.cc,
              bcc: draft.bcc,
              subject: `[Draft] ${draft.subject}`,
              body: draft.body,
              htmlBody: draft.htmlBody,
              snippet: draft.body?.substring(0, 100),
              isRead: true,
              isIncoming: false,
              sentAt: draft.updatedAt,
              createdAt: draft.createdAt,
              updatedAt: draft.updatedAt,
              folder: 'trash',
              attachments: draft.attachments || [],
              hasAttachments: (draft.attachments?.length || 0) > 0,
              contactIds: draft.contactIds || [],
              dealIds: draft.dealIds || [],
              accountEntityIds: draft.accountEntityIds || [],
              companyId: req.user!.companyId,
            }));

            emailsResponse.emails = [...emailsResponse.emails, ...mappedDrafts];
            emailsResponse.total += trashedDrafts.total;

            // Re-sort combined list
            emailsResponse.emails.sort((a, b) => {
              const dateA = a.sentAt instanceof Date ? a.sentAt : new Date(a.sentAt);
              const dateB = b.sentAt instanceof Date ? b.sentAt : new Date(b.sentAt);
              return dateB.getTime() - dateA.getTime();
            });
          }
        } catch (draftError) {
          console.error("Error fetching trashed drafts during trash list:", draftError);
          // Continue with just regular emails if draft fetch fails
        }
      }

      return ResponseHandler.success(res, emailsResponse, "Emails Fetched Successfully");

    } catch (error: any) {
      console.error("Error in getEmails:", error);
      return ResponseHandler.internalError(res, `Failed to get emails: ${error.message}`);
    }
  }

  async getInbox(req: AuthenticatedRequest, res: Response): Promise<void> {
    req.query.folder = 'inbox';
    return this.getEmails(req, res);
  }

  async getSent(req: AuthenticatedRequest, res: Response): Promise<void> {
    req.query.folder = 'sent';
    return this.getEmails(req, res);
  }

  async getDrafts(req: AuthenticatedRequest, res: Response): Promise<void> {
    req.query.folder = 'drafts';
    return this.getEmails(req, res);
  }

  async getSpam(req: AuthenticatedRequest, res: Response): Promise<void> {
    req.query.folder = 'spam';
    return this.getEmails(req, res);
  }

  async getTrash(req: AuthenticatedRequest, res: Response): Promise<void> {
    req.query.folder = 'trash';
    return this.getEmails(req, res);
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
        req.user.id.toString(),
        req.user.companyId
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
        req.user.companyId,
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

  async archiveEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");
      }

      const { emailId } = req.params;
      if (!emailId) {
        return ResponseHandler.error(res, "Email ID is required");
      }

      const success = await this.emailService.archiveEmail(
        emailId,
        req.user.id.toString(),
        req.user.companyId
      );

      if (!success) {
        return ResponseHandler.notFound(res, "Email not found");
      }

      return ResponseHandler.success(res, "Email archived successfully");
    } catch (error: any) {
      console.error("Error archiving email:", error);
      return ResponseHandler.internalError(res, "Failed to archive email");
    }
  }

  async unarchiveEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");
      }

      const { emailId } = req.params;
      if (!emailId) {
        return ResponseHandler.error(res, "Email ID is required");
      }

      const success = await this.emailService.unarchiveEmail(
        emailId,
        req.user.id.toString(),
        req.user.companyId
      );

      if (!success) {
        return ResponseHandler.notFound(res, "Email not found");
      }

      return ResponseHandler.success(res, "Email unarchived successfully");
    } catch (error: any) {
      console.error("Error unarchiving email:", error);
      return ResponseHandler.internalError(res, "Failed to unarchive email");
    }
  }

  async proxyImage(req: Request, res: Response): Promise<void> {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl) {
        return ResponseHandler.error(res, "URL parameter is required", 400);
      }

      // We use a stream to pipe the image directly to the response
      const response = await axios({
        url: imageUrl,
        method: 'GET',
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://drive.google.com/',
        },
        timeout: 10000,
      });

      // Pass along the content type if available
      const contentType = response.headers['content-type'];
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }

      // Cache for 24 hours to reduce backend load
      res.setHeader('Cache-Control', 'public, max-age=86400');

      response.data.pipe(res);
    } catch (error: any) {
      console.error("Error proxying image:", error.message);
      res.status(404).end();
    }
  }

  getArchive(req: AuthenticatedRequest, res: Response): Promise<void> {
    req.query.folder = 'archive';
    return this.getEmails(req, res);
  }

  /**
   * Move email to trash (soft delete)
   */
  async trashEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");
      }

      const { emailId } = req.params;
      if (!emailId) {
        return ResponseHandler.error(res, "Email ID is required");
      }

      const success = await this.emailService.trashEmail(
        emailId,
        req.user.id.toString(),
        req.user.companyId
      );

      // Return success regardless of whether email was found (idempotent operation)
      // If email doesn't exist, it's effectively already in the desired state
      return ResponseHandler.success(res, "Email moved to trash successfully");
    } catch (error: any) {
      console.error("Error trashing email:", error);
      return ResponseHandler.internalError(res, "Failed to move email to trash");
    }
  }

  /**
   * Restore email from trash
   */
  async restoreFromTrash(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");
      }

      const { emailId } = req.params;
      if (!emailId) {
        return ResponseHandler.error(res, "Email ID is required");
      }

      const success = await this.emailService.restoreFromTrash(
        emailId,
        req.user.id.toString(),
        req.user.companyId
      );

      if (!success) {
        return ResponseHandler.notFound(res, "Email not found in trash");
      }

      return ResponseHandler.success(res, "Email restored from trash successfully");
    } catch (error: any) {
      console.error("Error restoring email from trash:", error);
      return ResponseHandler.internalError(res, "Failed to restore email from trash");
    }
  }

  /**
   * Permanently delete email
   */
  async deleteEmailPermanently(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");
      }

      const { emailId } = req.params;
      if (!emailId) {
        return ResponseHandler.error(res, "Email ID is required");
      }

      const success = await this.emailService.deleteEmailPermanently(
        emailId,
        req.user.id.toString(),
        req.user.companyId
      );

      if (!success) {
        return ResponseHandler.notFound(res, "Email not found");
      }

      return ResponseHandler.success(res, "Email permanently deleted");
    } catch (error: any) {
      console.error("Error permanently deleting email:", error);
      return ResponseHandler.internalError(res, "Failed to permanently delete email");
    }
  }

  /**
   * Delete all emails in trash permanently
   */
  async deleteAllTrash(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");
      }

      // Run in background
      this.emailService.deleteAllTrash(req.user.id.toString(), req.user.companyId)
        .then(result => {
          console.log(`[Background] Empty trash completed: ${result.deleted} deleted, ${result.failed} failed`);
        })
        .catch(err => {
          console.error("[Background] Empty trash failed:", err);
        });

      return ResponseHandler.success(res, { message: "Trash emptying started in background" }, "Trash emptying started");
    } catch (error: any) {
      console.error("Error deleting all trash:", error);
      return ResponseHandler.internalError(res, "Failed to start trash emptying");
    }
  }

  async batchArchive(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { emailIds } = req.body;
      if (!emailIds || !Array.isArray(emailIds)) {
        return ResponseHandler.error(res, "Invalid emailIds provided", 400);
      }

      const results = await Promise.all(
        emailIds.map(id => this.emailService.archiveEmail(id, req.user!.id.toString(), req.user!.companyId))
      );

      return ResponseHandler.success(res, { count: results.filter((r: boolean) => r).length }, "Emails Archived Successfully");
    } catch (error) {
      console.error("Error batch archiving emails:", error);
      return ResponseHandler.internalError(res, "Failed to archive emails");
    }
  }

  async batchTrash(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { emailIds } = req.body;
      if (!emailIds || !Array.isArray(emailIds)) {
        return ResponseHandler.error(res, "Invalid emailIds provided", 400);
      }

      const results = await Promise.all(
        emailIds.map(id => this.emailService.trashEmail(id, req.user!.id.toString(), req.user!.companyId))
      );

      return ResponseHandler.success(res, { count: results.filter((r: boolean) => r).length }, "Emails Moved to Trash Successfully");
    } catch (error) {
      console.error("Error batch trashing emails:", error);
      return ResponseHandler.internalError(res, "Failed to move emails to trash");
    }
  }

  async batchMarkAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { emailIds, isRead } = req.body;
      if (!emailIds || !Array.isArray(emailIds)) {
        return ResponseHandler.error(res, "Invalid emailIds provided", 400);
      }

      const results = await Promise.all(
        emailIds.map(id => this.emailService.markEmailAsRead(id, req.user!.id.toString(), req.user!.companyId, isRead))
      );

      return ResponseHandler.success(res, { count: results.filter((r: boolean) => r).length }, `Emails marked as ${isRead ? 'read' : 'unread'}`);
    } catch (error) {
      console.error("Error batch marking emails as read:", error);
      return ResponseHandler.internalError(res, "Failed to update emails");
    }
  }

  async batchRestore(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { emailIds } = req.body;
      if (!emailIds || !Array.isArray(emailIds)) {
        return ResponseHandler.error(res, "Invalid emailIds provided", 400);
      }

      const results = await Promise.all(
        emailIds.map(id => this.emailService.restoreFromTrash(id, req.user!.id.toString(), req.user!.companyId))
      );

      return ResponseHandler.success(res, { count: results.filter((r: boolean) => r).length }, "Emails Restored Successfully");
    } catch (error) {
      console.error("Error batch restoring emails:", error);
      return ResponseHandler.internalError(res, "Failed to restore emails");
    }
  }

  async batchDelete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { emailIds } = req.body;
      if (!emailIds || !Array.isArray(emailIds)) {
        return ResponseHandler.error(res, "Invalid emailIds provided", 400);
      }

      // Run in background
      Promise.all(
        emailIds.map(id => this.emailService.deleteEmailPermanently(id, req.user!.id.toString(), req.user!.companyId))
      ).then(results => {
        const count = results.filter((r: boolean) => r).length;
        console.log(`[Background] Batch delete completed: ${count} deleted`);
      }).catch(err => {
        console.error("[Background] Batch delete failed:", err);
      });

      return ResponseHandler.success(res, { count: emailIds.length, message: "Batch deletion started in background" }, "Deletion started");
    } catch (error) {
      console.error("Error batch deleting emails:", error);
      return ResponseHandler.internalError(res, "Failed to start deletion");
    }
  }


  /**
   * Mark email as spam
   */
  async markAsSpam(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return ResponseHandler.unauthorized(res, "User not authenticated");
      const { emailId } = req.params;
      if (!emailId) return ResponseHandler.error(res, "Email ID is required");

      await this.emailService.markEmailAsSpam(emailId, req.user.id.toString(), req.user.companyId);

      return ResponseHandler.success(res, null, "Email marked as spam");
    } catch (error: any) {
      return ResponseHandler.error(res, error.message);
    }
  }

  /**
   * Unmark email as spam
   */
  async unmarkAsSpam(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return ResponseHandler.unauthorized(res, "User not authenticated");
      const { emailId } = req.params;
      if (!emailId) return ResponseHandler.error(res, "Email ID is required");

      await this.emailService.unmarkEmailAsSpam(emailId, req.user.id.toString(), req.user.companyId);

      return ResponseHandler.success(res, null, "Email unmarked from spam (moved to INBOX)");
    } catch (error: any) {
      return ResponseHandler.error(res, error.message);
    }
  }

  /**
   * Test notification endpoint for debugging
   */
  async testNotification(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, "User not authenticated");
      }

      const userId = req.user.id.toString();
      console.log(`🧪 [DEBUG] Triggering test notification for user: ${userId}`);

      if (this.notificationService) {
        const stats = this.notificationService.getConnectionStats();
        const isConnected = this.notificationService.isUserConnected(userId);

        this.notificationService.notifyUser(userId, {
          type: 'new_email',
          data: {
            id: 'test-id-' + Date.now(),
            from: 'System Test <test@example.com>',
            subject: 'Test Notification arrived!',
            snippet: 'This is a test notification to verify WebSocket connection.',
            receivedAt: new Date(),
            isRead: false
          },
          timestamp: new Date()
        });

        return ResponseHandler.success(res, {
          stats,
          isConnected,
          message: "Test notification sent"
        });
      }

      return ResponseHandler.error(res, "Notification service not initialized");
    } catch (error: any) {
      console.error("Error in testNotification:", error);
      return ResponseHandler.internalError(res, "Failed to send test notification");
    }
  }
}
