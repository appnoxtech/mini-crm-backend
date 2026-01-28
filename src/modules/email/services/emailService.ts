import { EmailModel } from "../models/emailModel";
import { EmailConnectorService } from "./emailConnectorService";
import { Email, EmailAccount, EmailAttachment } from "../models/types";
import { RealTimeNotificationService } from "./realTimeNotificationService";
import { simpleParser } from 'mailparser';
import { DealActivityModel } from "../../pipelines/models/DealActivity";
import { HistoricalSyncService } from "./historicalSyncService";

export class EmailService {
  private emailModel: EmailModel;
  private connectorService: EmailConnectorService;
  private notificationService?: RealTimeNotificationService;
  private activityModel?: DealActivityModel;
  private historicalSyncService: HistoricalSyncService;

  constructor(
    emailModel: EmailModel,
    connectorService: EmailConnectorService,
    notificationService?: RealTimeNotificationService,
    activityModel?: DealActivityModel
  ) {
    this.emailModel = emailModel;
    this.connectorService = connectorService;
    this.notificationService = notificationService;
    this.activityModel = activityModel;
    this.historicalSyncService = new HistoricalSyncService(
      emailModel,
      connectorService,
      notificationService
    );
  }

  public getEmailModel(): EmailModel {
    if (!this.emailModel) {
      throw new Error("EmailModel is not initialized!");
    }
    return this.emailModel;
  }

  /**
   * Test SMTP connection with provided configuration
   */
  async testSmtpConnection(smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  }): Promise<{ success: boolean; message: string }> {
    return this.connectorService.testSmtpConnection(smtpConfig);
  }

  /**
   * Test IMAP connection with provided configuration
   */
  async testImapConnection(imapConfig: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  }): Promise<{ success: boolean; message: string }> {
    return this.connectorService.testImapConnection(imapConfig);
  }

  async sendEmail(
    accountOrId: string | EmailAccount,
    emailData: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      body: string;
      htmlBody?: string;
      attachments?: EmailAttachment[];
      dealId?: number;
    }
  ): Promise<string> {
    let account: EmailAccount | null;

    if (typeof accountOrId === 'string') {
      // Get the email account from DB
      account = await this.emailModel.getEmailAccountById(accountOrId);
    } else {
      // Use the provided account object
      account = accountOrId;
    }

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

    // Create email record in database with composite ID to prevent conflicts
    const uniqueEmailId = `${account.id}-${messageId}`;
    const email: Email = {
      id: uniqueEmailId,
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
      dealIds: emailData.dealId ? [emailData.dealId.toString()] : [],
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

    // --- INTERNAL NOTIFICATION LOGIC ---
    // Check if any recipients (to, cc, bcc) are also platform users/accounts
    // This allows real-time notifications even before the receiver's next sync
    const allRecipients = [
      ...emailData.to,
      ...(emailData.cc || []),
      ...(emailData.bcc || [])
    ];

    for (const recipientEmail of allRecipients) {
      try {
        const recipientAccount = await this.emailModel.getEmailAccountByEmail(recipientEmail);

        if (recipientAccount && recipientAccount.userId !== account.userId) {


          // 1. Create a database record for the recipient immediately
          // This ensures they see the email even before sync
          const recipientEmailRecord: Email = {
            ...email,
            id: `${recipientAccount.id}-${messageId}`, // Unique ID using consistent format
            accountId: recipientAccount.id,
            isIncoming: true,
            isRead: false,
            // Directional metadata
            receivedAt: new Date(),
          };

          // Check if recipient already has this email (unlikely if just sent, but safe)
          const existingForRecipient = await this.emailModel.findEmailByMessageId(messageId, recipientAccount.id);
          if (!existingForRecipient) {
            await this.emailModel.createEmail(recipientEmailRecord);

          }

          // 2. Trigger real-time notification for the recipient
          if (this.notificationService) {
            this.notificationService.notifyNewEmail(recipientAccount.userId, recipientEmailRecord);

          }
        }
      } catch (internalNotifyError) {
        console.error('Error in internal email notification:', internalNotifyError);
        // Don't fail the main send process
      }
    }
    // --- END INTERNAL NOTIFICATION LOGIC ---

    // Create history entry if dealId is provided
    if (emailData.dealId && this.activityModel) {
      try {
        await this.activityModel.create({
          dealId: emailData.dealId,
          userId: Number(account.userId),
          activityType: 'mail',
          subject: emailData.subject,
          label: 'outgoing',
          priority: 'none',
          busyFree: 'free',
          email: {
            from: email.from,
            to: email.to,
            subject: email.subject,
            body: email.body
          },
          organization: emailData.to.join(', '),
          participants: [],
          persons: [],
          isDone: true,
          completedAt: new Date().toISOString(),
        });

      } catch (activityError: any) {
        console.error('Failed to create email activity record:', activityError.message);
        // We don't throw here to avoid failing the whole send process if only logging fails
      }
    }

    // Notify sender about email sent
    if (this.notificationService) {
      this.notificationService.notifyEmailSent(
        account.userId,
        messageId,
        emailData.to,
        emailData.subject
      );
    }

    return messageId;
  }

  async processIncomingEmails(
    account: EmailAccount
  ): Promise<{ processed: number; errors: number; newEmails: number }> {


    const provider = account.provider;
    let rawEmails: any[] = [];
    let processed = 0;
    let errors = 0;
    let newEmails = 0;

    try {


      // Notify user that sync is in progress
      if (this.notificationService) {
        this.notificationService.notifySyncStatus(account.userId, account.id, 'starting');
      }

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
      } else if (provider === "imap" || provider === "custom") {


        // Use parallel sync for IMAP for better performance
        // Quick sync if we have a lastSyncAt, full sync otherwise
        const useQuickSync = !!account.lastSyncAt;
        rawEmails = await this.connectorService.fetchIMAPEmailsParallel(
          account,
          account.lastSyncAt,
          useQuickSync
        );
      }



      for (const rawEmail of rawEmails) {
        try {
          const isNew = await this.processSingleEmail(account, rawEmail);
          processed++;

          if (isNew) newEmails++;
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



      // Notify user about sync completion
      if (this.notificationService) {
        this.notificationService.notifySyncStatus(account.userId, account.id, 'completed', {
          processed,
          newEmails,
          errors
        });
      }

      return { processed, errors, newEmails };
    } catch (error: any) {
      console.error(
        `Error processing emails for account ${account.id}:`,
        error
      );

      if (this.notificationService) {
        this.notificationService.notifySyncStatus(account.userId, account.id, 'failed', {
          error: error.message
        });
      }

      throw new Error(`Email processing failed: ${error.message}`);
    }
  }

  private async processSingleEmail(
    account: EmailAccount,
    rawEmail: any
  ): Promise<boolean> {
    const parsed = await this.parseRawEmail(rawEmail, account.provider);

    // Check if email already exists for THIS account
    const existing = await this.emailModel.findEmailByMessageId(
      parsed.messageId!,
      account.id
    );
    if (existing) {
      // console.log(`Email ${parsed.messageId} already exists for account ${account.id}, skipping.`);
      return false;
    }

    // Match with CRM entities
    const { contactIds, dealIds, accountEntityIds } =
      await this.matchEmailWithCRMEntities(parsed);

    // Determine if email is incoming or outgoing
    const isIncoming = this.determineEmailDirection(parsed, account, rawEmail);


    // Generate a unique composite ID to prevent conflicts when same email exists in multiple accounts
    const uniqueEmailId = `${account.id}-${parsed.messageId}`;

    const email: Email = {
      id: uniqueEmailId,
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
    if (parsed.labelIds) email.labelIds = parsed.labelIds;

    await this.emailModel.createEmail(email);


    // Create activity records for matched deals
    if (dealIds.length > 0 && this.activityModel) {
      for (const dealId of dealIds) {
        try {
          await this.activityModel.create({
            dealId: Number(dealId),
            userId: Number(account.userId),
            activityType: 'mail',
            subject: email.subject,
            label: isIncoming ? 'incoming' : 'outgoing',
            priority: 'none',
            busyFree: 'free',
            email: {
              from: email.from,
              to: email.to,
              subject: email.subject,
              body: email.body
            },
            organization: isIncoming ? email.from : email.to.join(', '),
            isDone: true,
            completedAt: (isIncoming ? email.receivedAt : email.sentAt)?.toISOString() || new Date().toISOString()
          });
        } catch (error) {
          console.error(`Failed to create activity for deal ${dealId}:`, error);
        }
      }
    }

    // Notify user about new incoming email
    if (this.notificationService && isIncoming) {

      this.notificationService.notifyNewEmail(account.userId, email);
    } else if (this.notificationService && !isIncoming) {

    } else if (!this.notificationService) {

    }

    return true;
  }

  private async parseRawEmail(rawEmail: any, provider: string): Promise<Partial<Email>> {
    if (provider === "gmail") return this.parseGmailMessage(rawEmail);
    if (provider === "outlook") return this.parseOutlookMessage(rawEmail);
    if (provider === "imap" || provider === "custom") return await this.parseIMAPMessage(rawEmail);
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


    if (labelIds.includes("SENT")) {

      return false; // This is a sent email
    }
    if (
      labelIds.includes("INBOX") ||
      labelIds.includes("SPAM") ||
      labelIds.includes("TRASH")
    ) {

      return true; // This is an incoming email
    }

    // Method 2: Compare sender with account email
    const fromEmail = this.extractEmailFromAddress(parsed.from || "");
    const accountEmail = account.email.toLowerCase();

    if (fromEmail && fromEmail.toLowerCase() === accountEmail) {

      return false; // Email is from the account owner, so it's sent
    }

    // Method 3: Check if account email is in the 'to' field
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
    // Check explicit folder tag from fetchIMAPEmails
    if (rawEmail.folder === 'SENT') {
      return false;
    }
    if (rawEmail.folder === 'INBOX') {
      return true;
    }
    if (rawEmail.folder === 'DRAFT') {
      return false; // Drafts are outgoing
    }
    if (rawEmail.folder === 'SPAM') {
      return true; // Spam is incoming
    }
    if (rawEmail.folder === 'TRASH') {
      return true; // Trash is incoming
    }

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
      attachments: this.extractAttachmentsFromGmailPayload(message.payload),
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
      attachments: (message.attachments || []).map((att: any) => {
        const contentType = att.contentType || 'application/octet-stream';
        const attachment: EmailAttachment = {
          id: att.id,
          filename: att.name,
          contentType: contentType,
          size: att.size,
          contentId: att.contentId || undefined
        };
        if (att.contentBytes) {
          attachment.content = att.contentBytes;
          attachment.url = `data:${contentType};base64,${att.contentBytes}`;
          attachment.encoding = 'base64';
        }
        return attachment;
      }),
    } as any;
  }

  private async parseIMAPMessage(message: any): Promise<Partial<Email>> {
    const source = message.source;
    let body = "";
    let htmlBody: string | undefined;
    let parsed: any = {};
    let attachments: EmailAttachment[] | undefined;

    if (source) {
      try {
        // Ensure source is a string or Buffer for simpleParser
        // imapflow returns Buffer, but let's be safe
        const sourceData = Buffer.isBuffer(source) ? source : String(source);
        parsed = await simpleParser(sourceData);

        body = parsed.text || ""; // Plain text body
        // Prefer HTML, fallback to textAsHtml, then undefined
        htmlBody = parsed.html || parsed.textAsHtml || undefined;

        // Parse attachments (same structure as Gmail)
        if (parsed.attachments && parsed.attachments.length > 0) {
          attachments = parsed.attachments.map((att: any, index: number) => {
            const base64Content = att.content ? att.content.toString('base64') : '';
            const contentType = att.contentType || 'application/octet-stream';
            return {
              id: att.contentId || `att_${Date.now()}_${index}`,
              filename: att.filename || 'attachment',
              contentType: contentType,
              size: att.size || 0,
              contentId: att.contentId || undefined,
              url: base64Content ? `data:${contentType};base64,${base64Content}` : undefined,
              content: base64Content || undefined,
              encoding: 'base64'
            };
          });
        }


      } catch (err) {
        console.error("Failed to parse IMAP email body:", err);
        // Do NOT fall back to raw source as body, it looks broken to the user
        body = "Error parsing email content.";
      }
    }

    // Helper to format address objects to match Gmail format "Name <email>"
    const formatAddress = (addr: any): string[] => {
      if (!addr) return [];
      if (Array.isArray(addr.value)) {
        return addr.value.map((a: any) => a.name ? `${a.name} <${a.address}>` : a.address);
      }
      return addr.text ? [addr.text] : [];
    };

    // Use parsed metadata if available, otherwise fall back to envelope
    const from = parsed.from?.text || message.envelope?.from?.[0]?.address;
    const to = parsed.to ? formatAddress(parsed.to) : (message.envelope?.to || []).map((a: any) => a.address);
    const cc = parsed.cc ? formatAddress(parsed.cc) : message.envelope?.cc?.map((a: any) => a.address);
    const bcc = parsed.bcc ? formatAddress(parsed.bcc) : message.envelope?.bcc?.map((a: any) => a.address);
    const subject = parsed.subject || message.envelope?.subject || "";
    const date = parsed.date || message.envelope?.date;

    // Extract threadId from In-Reply-To or References header (similar to Gmail's threadId)
    const threadId = parsed.inReplyTo || (parsed.references && parsed.references[0]) || undefined;

    // Determine isRead from flags - check if \Seen flag is present
    // If flags exist and has the \Seen flag, email is read; otherwise unread
    let isRead = true; // Default to read
    if (message.flags) {
      if (message.flags instanceof Set) {
        isRead = message.flags.has('\\Seen');
      } else if (Array.isArray(message.flags)) {
        isRead = message.flags.includes('\\Seen');
      }
    }

    return {
      messageId: parsed.messageId || message.envelope?.messageId,
      threadId: threadId,
      from: from,
      to: to,
      cc: cc,
      bcc: bcc,
      subject: subject,
      body: body,
      htmlBody: htmlBody,
      attachments: attachments,
      sentAt: date,
      receivedAt: date,
      isRead: isRead,
      // Store folder for direction detection and labeling
      folder: message.folder,
      labelIds: message.folder ? [message.folder] : [],
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

  private extractAttachmentsFromGmailPayload(payload: any): EmailAttachment[] {
    const attachments: EmailAttachment[] = [];

    if (!payload || !payload.parts) return attachments;

    const walk = (parts: any[]) => {
      for (const part of parts) {
        if (part.filename && part.filename.length > 0) {
          const contentType = part.mimeType || 'application/octet-stream';
          const attachmentId = part.body?.attachmentId || `att_${Date.now()}_${attachments.length}`;

          const attachment: EmailAttachment = {
            id: attachmentId,
            filename: part.filename,
            contentType: contentType,
            size: part.body?.size || 0,
            contentId: this.getGmailHeader(part.headers || [], 'content-id')
          };

          // If content is directly in the part (rare for large files, but possible for small ones/inline)
          if (part.body?.data) {
            const base64Content = part.body.data.replace(/-/g, '+').replace(/_/g, '/');
            attachment.content = base64Content;
            attachment.url = `data:${contentType};base64,${base64Content}`;
            attachment.encoding = 'base64';
          }

          attachments.push(attachment);
        }
        if (part.parts) {
          walk(part.parts);
        }
      }
    };

    walk(payload.parts);
    return attachments;
  }

  private getGmailHeader(headers: any[], name: string): string | undefined {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : undefined;
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

  async getEmailAccountById(accountId: string): Promise<EmailAccount | null> {
    return this.emailModel.getEmailAccountById(accountId);
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
      accountId?: string;
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

  async archiveEmail(emailId: string, userId: string): Promise<boolean> {
    return this.emailModel.archiveEmail(emailId, userId);
  }

  async unarchiveEmail(emailId: string, userId: string): Promise<boolean> {
    return this.emailModel.unarchiveEmail(emailId, userId);
  }

  /**
   * Sync archived emails for a user from Gmail
   * Uses history API for incremental sync if available
   */
  async syncArchivedEmails(userId: string): Promise<{ processed: number; errors: number }> {
    const account = await this.emailModel.getEmailAccountByUserId(userId);
    if (!account || account.provider !== 'gmail' || !account.accessToken) {
      console.log(`Skipping archive sync: User ${userId} has no connected Gmail account`);
      return { processed: 0, errors: 0 };
    }

    console.log(`Starting Gmail archive sync for user ${userId} (Account: ${account.email})`);
    let processed = 0;
    let errors = 0;

    try {
      // Check if we have a history ID to do incremental sync
      if (account.lastHistoryId) {
        return await this.syncGmailHistory(account);
      } else {
        // First time running archive sync or history expired -> Full/Initial Sync
        return await this.syncGmailArchiveInitial(account);
      }
    } catch (error: any) {
      console.error(`Archive sync failed for user ${userId}:`, error);
      // Check for history expired error to trigger full sync next time/now
      if (error.message === 'HISTORY_EXPIRED') {
        console.log('History expired, clearing lastHistoryId to force full sync next time');
        await this.emailModel.updateEmailAccount(account.id, { lastHistoryId: undefined });
        // Optionally retry immediately
        return await this.syncGmailArchiveInitial(account);
      }
      throw error;
    }
  }

  private async syncGmailArchiveInitial(account: EmailAccount): Promise<{ processed: number, errors: number }> {
    console.log(`Performing INITIAL archive sync for ${account.email}`);
    let processed = 0;
    let errors = 0;
    let pageToken: string | undefined = undefined;
    let newHistoryId: string | undefined = undefined;

    // Fetch pages (limit to a few pages to avoid timeouts in this implementation, 
    // real world might use background jobs)
    const MAX_PAGES = 5;
    let pageCount = 0;

    do {
      const result = await this.connectorService.fetchArchivedGmailEmails(account, 50, pageToken);
      const messages = result.messages;
      pageToken = result.nextPageToken;
      if (result.newHistoryId) newHistoryId = result.newHistoryId;

      for (const msg of messages) {
        try {
          await this.processSingleEmail(account, msg);
          // Explicitly ensure ARCHIVE label is set in DB since we fetched it via archive query
          // processSingleEmail might not set it if it just relies on Gmail labels and "ARCHIVE" isn't a real label
          await this.ensureArchiveStatus(msg.id, account.userId);
          processed++;
        } catch (err) {
          console.error(`Error processing archived email ${msg.id}:`, err);
          errors++;
        }
      }
      pageCount++;
    } while (pageToken && pageCount < MAX_PAGES);

    // Update account with new history ID
    if (newHistoryId) {
      await this.emailModel.updateEmailAccount(account.id, {
        lastHistoryId: newHistoryId,
        lastSyncAt: new Date()
      });
    }

    return { processed, errors };
  }

  private async syncGmailHistory(account: EmailAccount): Promise<{ processed: number, errors: number }> {
    console.log(`Performing INCREMENTAL history sync for ${account.email} from ID ${account.lastHistoryId}`);
    let processed = 0;
    let errors = 0;

    const { history, newHistoryId } = await this.connectorService.fetchGmailHistory(account, account.lastHistoryId!);

    if (!history || history.length === 0) {
      console.log('No new history changes found.');
      // Still update history ID to the latest
      if (newHistoryId) {
        await this.emailModel.updateEmailAccount(account.id, {
          lastHistoryId: newHistoryId,
          lastSyncAt: new Date()
        });
      }
      return { processed: 0, errors: 0 };
    }

    for (const record of history) {
      // 1. Handle Messages Added (New emails)
      if (record.messagesAdded) {
        for (const item of record.messagesAdded) {
          try {
            const messageId = item.message.id;
            // Check if we already have it
            const existing = await this.emailModel.findEmailByMessageId(messageId);
            if (!existing) {
              // Fetch full details
              const fullMsg = await this.connectorService.fetchGmailMessageDetails(account.id, messageId);
              await this.processSingleEmail(account, fullMsg);

              // Check if it should be archived
              const labels = fullMsg.labelIds || [];
              if (!labels.includes('INBOX') && !labels.includes('SPAM') && !labels.includes('TRASH')) {
                await this.ensureArchiveStatus(messageId, account.userId);
              }
              processed++;
            }
          } catch (err) {
            console.error(`Error processing history messageAdded:`, err);
            errors++;
          }
        }
      }

      // 2. Handle Labels Removed (e.g. Inbox label removed -> Archived)
      if (record.labelsRemoved) {
        for (const item of record.labelsRemoved) {
          try {
            // item has message { id, threadId } and labelIds (removed labels)
            if (item.labelIds && item.labelIds.includes('INBOX')) {
              console.log(`Message ${item.message.id} archived (INBOX label removed)`);
              await this.emailModel.archiveEmail(item.message.id, account.userId);
              processed++;
            }
          } catch (err) {
            errors++;
          }
        }
      }

      // 3. Handle Labels Added (e.g. Inbox label added -> Unarchived)
      if (record.labelsAdded) {
        for (const item of record.labelsAdded) {
          try {
            if (item.labelIds && item.labelIds.includes('INBOX')) {
              console.log(`Message ${item.message.id} unarchived (INBOX label added)`);
              await this.emailModel.unarchiveEmail(item.message.id, account.userId);
              processed++;
            }
          } catch (err) {
            errors++;
          }
        }
      }
    }

    // Update to new history ID
    if (newHistoryId) {
      await this.emailModel.updateEmailAccount(account.id, {
        lastHistoryId: newHistoryId,
        lastSyncAt: new Date()
      });
    }

    return { processed, errors };
  }

  // Helper to force set isArchived/label
  private async ensureArchiveStatus(emailId: string, userId: string) {
    // We can reuse archiveEmail logic which adds 'ARCHIVE' label and removes 'INBOX'
    await this.emailModel.archiveEmail(emailId, userId);
  }

  /**
   * Quick initial load for IMAP - fetches latest 100 emails immediately
   * Used when connecting a new account to show emails fast
   */
  async quickInitialLoadIMAP(account: EmailAccount): Promise<{ emails: Email[]; count: number }> {
    return this.historicalSyncService.quickInitialLoad(account);
  }

  /**
   * Trigger full historical sync in background
   */
  async triggerHistoricalSync(accountId: string): Promise<{ success: boolean; message: string }> {
    const account = await this.emailModel.getEmailAccountById(accountId);
    if (!account) throw new Error("Account not found");

    // Run in background (don't await)
    this.historicalSyncService.syncHistoricalEmails(account).catch(err => {
      console.error(`Background historical sync failed for ${accountId}:`, err);
    });

    return { success: true, message: "Historical sync started in background" };
  }

  /**
   * Get paginated emails for the user
   */
  async getPaginatedEmails(userId: string, options: any) {
    return this.emailModel.getEmailsPaginated(userId, options);
  }
}
