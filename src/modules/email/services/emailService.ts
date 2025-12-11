import { EmailModel } from "../models/emailModel";
import { EmailConnectorService } from "./emailConnectorService";
import { Email, EmailAccount, EmailAttachment } from "../models/types";
import { RealTimeNotificationService } from "./realTimeNotificationService";

export class EmailService {
  private emailModel: EmailModel;
  private connectorService: EmailConnectorService;
  private notificationService?: RealTimeNotificationService;

  constructor(
    emailModel: EmailModel,
    connectorService: EmailConnectorService,
    notificationService?: RealTimeNotificationService
  ) {
    this.emailModel = emailModel;
    this.connectorService = connectorService;
    this.notificationService = notificationService;
  }

  public getEmailModel(): EmailModel {
    if (!this.emailModel) {
      throw new Error("EmailModel is not initialized!");
    }
    return this.emailModel;
  }

  async sendEmail(
    accountId: string,
    emailData: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      body: string;
      htmlBody?: string;
      attachments?: EmailAttachment[];
    }
  ): Promise<string> {
    // Get the email account
    const account = await this.emailModel.getEmailAccountById(accountId);
    if (!account) {
      throw new Error("Email account not found");
    }

    // Check if account has OAuth tokens (Gmail/Outlook) or SMTP config
    if (!account.accessToken && !account.smtpConfig) {
      throw new Error(
        "Email account not configured. Please connect your email account via OAuth or SMTP."
      );
    }

    // Send email via connector service
    const messageId = await this.connectorService.sendEmail(account, emailData);

    // Create email record in database
    const email: Email = {
      id: messageId,
      messageId,
      accountId: account.id,
      from: account.email,
      to: emailData.to,
      subject: emailData.subject,
      body: emailData.body,
      isRead: true,
      isIncoming: false,
      sentAt: new Date(),
      contactIds: [],
      dealIds: [],
      accountEntityIds: [],
      opens: 0,
      clicks: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Handle optional properties
    if (emailData.cc) email.cc = emailData.cc;
    if (emailData.bcc) email.bcc = emailData.bcc;
    if (emailData.htmlBody) email.htmlBody = emailData.htmlBody;
    if (emailData.attachments) email.attachments = emailData.attachments;

    await this.emailModel.createEmail(email);

    // Notify user about email sent
    if (this.notificationService) {
      const account = await this.emailModel.getEmailAccountById(accountId);
      if (account) {
        this.notificationService.notifyEmailSent(
          account.userId,
          messageId,
          emailData.to,
          emailData.subject
        );
      }
    }

    return messageId;
  }

  async processIncomingEmails(
    account: EmailAccount
  ): Promise<{ processed: number; errors: number }> {
    const provider = account.provider;
    let rawEmails: any[] = [];
    let processed = 0;
    let errors = 0;

    try {
      console.log(
        `Processing incoming emails for ${provider} account: ${account.email}`
      );

      if (provider === "gmail") {
        // Fetch up to 100 emails for better sync coverage
        rawEmails = await this.connectorService.fetchGmailEmails(
          account,
          account.lastSyncAt,
          100 // Increased from default 50 for better sync coverage
        );
      } else if (provider === "outlook") {
        rawEmails = await this.connectorService.fetchOutlookEmails(
          account,
          account.lastSyncAt
        );
      } else if (provider === "imap") {
        rawEmails = await this.connectorService.fetchIMAPEmails(
          account,
          account.lastSyncAt
        );
      }

      console.log(`Found ${rawEmails.length} emails to process`);

      for (const rawEmail of rawEmails) {
        try {
          await this.processSingleEmail(account, rawEmail);
          processed++;
        } catch (error: any) {
          console.error("Error processing individual email:", error);
          errors++;
          // Continue processing other emails
        }
      }

      // Update last sync time
      await this.emailModel.updateEmailAccount(account.id, {
        lastSyncAt: new Date(),
      });

      console.log(
        `Email processing completed. Processed: ${processed}, Errors: ${errors}`
      );
      return { processed, errors };
    } catch (error: any) {
      console.error(
        `Error processing emails for account ${account.id}:`,
        error
      );
      throw new Error(`Email processing failed: ${error.message}`);
    }
  }

  private async processSingleEmail(
    account: EmailAccount,
    rawEmail: any
  ): Promise<void> {
    const parsed = this.parseRawEmail(rawEmail, account.provider);

    // Check if email already exists
    const existing = await this.emailModel.findEmailByMessageId(
      parsed.messageId!
    );
    if (existing) return;

    // Match with CRM entities
    const { contactIds, dealIds, accountEntityIds } =
      await this.matchEmailWithCRMEntities(parsed);

    // Determine if email is incoming or outgoing
    const isIncoming = this.determineEmailDirection(parsed, account, rawEmail);

    const email: Email = {
      id: parsed.messageId!,
      messageId: parsed.messageId!,
      accountId: account.id,
      from: parsed.from!,
      to: parsed.to || [],
      subject: parsed.subject || "",
      body: parsed.body || "",
      isRead: parsed.isRead ?? true,
      isIncoming: isIncoming,
      sentAt: parsed.sentAt ? new Date(parsed.sentAt) : new Date(),
      receivedAt: parsed.receivedAt ? new Date(parsed.receivedAt) : new Date(),
      contactIds,
      dealIds,
      accountEntityIds,
      opens: 0,
      clicks: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Handle optional properties
    if (parsed.threadId) email.threadId = parsed.threadId;
    if (parsed.cc) email.cc = parsed.cc;
    if (parsed.bcc) email.bcc = parsed.bcc;
    if (parsed.htmlBody) email.htmlBody = parsed.htmlBody;
    if (parsed.attachments) email.attachments = parsed.attachments;

    await this.emailModel.createEmail(email);

    // Notify user about new incoming email
    if (this.notificationService) {
      console.log(
        "🔔 Sending WebSocket notification for new email:",
        email.subject
      );
      this.notificationService.notifyNewEmail(account.userId, email);
    } else {
      console.log("⚠️ Notification service not available");
    }
  }

  private parseRawEmail(rawEmail: any, provider: string): Partial<Email> {
    if (provider === "gmail") return this.parseGmailMessage(rawEmail);
    if (provider === "outlook") return this.parseOutlookMessage(rawEmail);
    if (provider === "imap") return this.parseIMAPMessage(rawEmail);
    throw new Error(`Unsupported provider: ${provider}`);
  }

  private determineEmailDirection(
    parsed: Partial<Email>,
    account: EmailAccount,
    rawEmail: any
  ): boolean {
    if (account.provider === "gmail") {
      return this.determineGmailEmailDirection(parsed, account, rawEmail);
    } else if (account.provider === "outlook") {
      return this.determineOutlookEmailDirection(parsed, account, rawEmail);
    } else if (account.provider === "imap") {
      return this.determineIMAPEmailDirection(parsed, account, rawEmail);
    }

    // Default to incoming if we can't determine
    return true;
  }

  private determineGmailEmailDirection(
    parsed: Partial<Email>,
    account: EmailAccount,
    rawEmail: any
  ): boolean {
    // Method 1: Check Gmail labels
    const labelIds = rawEmail.labelIds || [];
    console.log(`Determining Gmail email direction for ${parsed.subject}:`, {
      labelIds,
      from: parsed.from,
      to: parsed.to,
      accountEmail: account.email,
    });

    if (labelIds.includes("SENT")) {
      console.log("Email marked as SENT based on Gmail labels");
      return false; // This is a sent email
    }
    if (
      labelIds.includes("INBOX") ||
      labelIds.includes("SPAM") ||
      labelIds.includes("TRASH")
    ) {
      console.log("Email marked as INCOMING based on Gmail labels");
      return true; // This is an incoming email
    }

    // Method 2: Compare sender with account email
    const fromEmail = this.extractEmailFromAddress(parsed.from || "");
    const accountEmail = account.email.toLowerCase();

    if (fromEmail && fromEmail.toLowerCase() === accountEmail) {
      console.log(
        "Email marked as SENT based on sender matching account email"
      );
      return false; // Email is from the account owner, so it's sent
    }

    // Method 3: Check if account email is in the 'to' field
    const toEmails = (parsed.to || []).map((email) =>
      this.extractEmailFromAddress(email)
    );
    if (
      toEmails.some((email) => email && email.toLowerCase() === accountEmail)
    ) {
      console.log(
        "Email marked as INCOMING based on account email in recipients"
      );
      return true; // Account email is in recipients, so it's incoming
    }

    // Default to incoming
    console.log("Email defaulted to INCOMING");
    return true;
  }

  private determineOutlookEmailDirection(
    parsed: Partial<Email>,
    account: EmailAccount,
    rawEmail: any
  ): boolean {
    // For Outlook, check if the sender matches the account email
    const fromEmail = this.extractEmailFromAddress(parsed.from || "");
    const accountEmail = account.email.toLowerCase();

    if (fromEmail && fromEmail.toLowerCase() === accountEmail) {
      return false; // Email is from the account owner, so it's sent
    }

    // Check if account email is in the 'to' field
    const toEmails = (parsed.to || []).map((email) =>
      this.extractEmailFromAddress(email)
    );
    if (
      toEmails.some((email) => email && email.toLowerCase() === accountEmail)
    ) {
      return true; // Account email is in recipients, so it's incoming
    }

    // Default to incoming
    return true;
  }

  private determineIMAPEmailDirection(
    parsed: Partial<Email>,
    account: EmailAccount,
    rawEmail: any
  ): boolean {
    // For IMAP, check if the sender matches the account email
    const fromEmail = this.extractEmailFromAddress(parsed.from || "");
    const accountEmail = account.email.toLowerCase();

    if (fromEmail && fromEmail.toLowerCase() === accountEmail) {
      return false; // Email is from the account owner, so it's sent
    }

    // Default to incoming
    return true;
  }

  private extractEmailFromAddress(address: string): string | null {
    // Extract email from "Name <email@domain.com>" format
    const match = address.match(/<([^>]+)>/);
    if (match && match[1]) {
      return match[1];
    }

    // If no angle brackets, assume the whole string is the email
    if (address.includes("@")) {
      return address;
    }

    return null;
  }

  private parseGmailMessage(message: any): Partial<Email> {
    const headers = (message.payload?.headers || []).reduce(
      (acc: any, header: any) => {
        acc[(header.name || "").toLowerCase()] = header.value;
        return acc;
      },
      {}
    );

    return {
      messageId: headers["message-id"],
      threadId: message.threadId,
      from: headers["from"],
      to: (headers["to"] || "")
        .split(",")
        .filter(Boolean)
        .map((s: string) => s.trim()),
      cc: headers["cc"]
        ? headers["cc"].split(",").map((s: string) => s.trim())
        : undefined,
      bcc: headers["bcc"]
        ? headers["bcc"].split(",").map((s: string) => s.trim())
        : undefined,
      subject: headers["subject"] || "",
      body: this.extractTextFromGmailPayload(message.payload),
      htmlBody: this.extractHtmlFromGmailPayload(message.payload),
      isRead: !(message.labelIds || []).includes("UNREAD"),
      sentAt: new Date(parseInt(message.internalDate)),
      receivedAt: new Date(parseInt(message.internalDate)),
      // Store labelIds for direction detection
      labelIds: message.labelIds || [],
    } as any;
  }

  private parseOutlookMessage(message: any): Partial<Email> {
    return {
      messageId: message.internetMessageId,
      threadId: message.conversationId,
      from: message.from?.emailAddress?.address,
      to: (message.toRecipients || []).map((r: any) => r.emailAddress.address),
      cc: (message.ccRecipients || []).map((r: any) => r.emailAddress.address),
      bcc: (message.bccRecipients || []).map(
        (r: any) => r.emailAddress.address
      ),
      subject: message.subject || "",
      body: message.body?.contentType === "text" ? message.body.content : "",
      htmlBody:
        message.body?.contentType === "html" ? message.body.content : undefined,
      isRead: !!message.isRead,
      sentAt: new Date(message.sentDateTime),
      receivedAt: new Date(message.receivedDateTime),
    } as any;
  }

  private parseIMAPMessage(message: any): Partial<Email> {
    return {
      messageId: message.envelope?.messageId,
      from: message.envelope?.from?.[0]?.address,
      to: (message.envelope?.to || []).map((a: any) => a.address),
      cc: message.envelope?.cc?.map((a: any) => a.address),
      bcc: message.envelope?.bcc?.map((a: any) => a.address),
      subject: message.envelope?.subject || "",
      body: String(message.source || ""),
      sentAt: message.envelope?.date,
      receivedAt: message.envelope?.date,
      isRead: !(
        message.flags &&
        message.flags.has &&
        message.flags.has("\\Seen") === false
      ),
    } as any;
  }

  private extractTextFromGmailPayload(payload: any): string {
    if (!payload) return "";
    if (payload.mimeType === "text/plain" && payload.body?.data) {
      return Buffer.from(payload.body.data, "base64").toString();
    }
    for (const part of payload.parts || []) {
      const text = this.extractTextFromGmailPayload(part);
      if (text) return text;
    }
    return "";
  }

  private extractHtmlFromGmailPayload(payload: any): string | undefined {
    if (!payload) return undefined;
    if (payload.mimeType === "text/html" && payload.body?.data) {
      return Buffer.from(payload.body.data, "base64").toString();
    }
    for (const part of payload.parts || []) {
      const html = this.extractHtmlFromGmailPayload(part);
      if (html) return html;
    }
    return undefined;
  }

  private async matchEmailWithCRMEntities(email: Partial<Email>): Promise<{
    contactIds: string[];
    dealIds: string[];
    accountEntityIds: string[];
  }> {
    const allEmails = [
      email.from,
      ...(email.to || []),
      ...(email.cc || []),
      ...(email.bcc || []),
    ].filter(Boolean) as string[];

    const contacts = await this.emailModel.findContactsByEmails(allEmails);
    const contactIds = contacts.map((c) => c.id);
    const deals = await this.emailModel.findDealsByContactIds(contactIds);
    const dealIds = deals.map((d) => d.id);

    return { contactIds, dealIds, accountEntityIds: [] };
  }

  async getEmailsForContact(contactId: string): Promise<Email[]> {
    return this.emailModel.getEmailsForContact(contactId);
  }

  async getEmailsForDeal(dealId: string): Promise<Email[]> {
    return this.emailModel.getEmailsForDeal(dealId);
  }

  async getEmailAccountByUserId(userId: string): Promise<EmailAccount | null> {
    return this.emailModel.getEmailAccountByUserId(userId);
  }

  async getEmailAccountByEmail(email: string): Promise<EmailAccount | null> {
    return this.emailModel.getEmailAccountByEmail(email);
  }

  async createEmailAccount(account: EmailAccount): Promise<EmailAccount> {
    return this.emailModel.createEmailAccount(account);
  }

  async updateEmailAccount(
    accountId: string,
    updates: Partial<EmailAccount>
  ): Promise<void> {
    return this.emailModel.updateEmailAccount(accountId, updates);
  }

  async getEmailAccounts(userId: string): Promise<EmailAccount[]> {
    return this.emailModel.getEmailAccounts(userId);
  }

  // Get emails for a user with filtering options
  async getEmailsForUser(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      folder?: string;
      search?: string;
      unreadOnly?: boolean;
    } = {}
  ): Promise<{ emails: Email[]; total: number }> {
    return this.emailModel.getEmailsForUser(userId, options);
  }

  // In EmailService
  async getAllEmails(options: { limit?: number } = {}) {
    return this.emailModel.getAllEmails({ limit: 1000 });
  }

  // Get a specific email by ID
  async getEmailById(emailId: string, userId: string): Promise<Email | null> {
    return this.emailModel.getEmailById(emailId, userId);
  }

  // Mark email as read/unread
  async markEmailAsRead(
    emailId: string,
    userId: string,
    isRead: boolean
  ): Promise<boolean> {
    return this.emailModel.markEmailAsRead(emailId, userId, isRead);
  }
}
