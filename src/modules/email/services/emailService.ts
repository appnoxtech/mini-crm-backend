import { EmailModel } from "../models/emailModel";
import { EmailConnectorService } from "./emailConnectorService";
import { Email, EmailAccount, EmailAttachment } from "../models/types";
import { RealTimeNotificationService } from "./realTimeNotificationService";
import { simpleParser } from 'mailparser';
import { DealActivityModel } from "../../pipelines/models/DealActivity";
import { HistoricalSyncService } from "./historicalSyncService";
import nodemailer from 'nodemailer';
import { DraftModel } from "../models/draftModel";
import { EmailDraft } from "../models/draftTypes";
import { v4 as uuidv4 } from 'uuid';
import { Worker } from 'worker_threads';
import path from 'path';

export class EmailService {
  private emailModel: EmailModel;
  private connectorService: EmailConnectorService;
  private notificationService?: RealTimeNotificationService;
  private activityModel?: DealActivityModel;
  private historicalSyncService: HistoricalSyncService;
  private draftModel: DraftModel;
  private worker: Worker | null = null;
  // Determine correct path based on environment (ts-node vs compiled js)
  // path.extname(__filename) will be .ts in dev and .js in prod usually
  private workerScriptPath = path.join(__dirname, `../workers/emailParser${path.extname(__filename)}`);

  constructor(
    emailModel: EmailModel,
    connectorService: EmailConnectorService,
    notificationService?: RealTimeNotificationService,
    activityModel?: DealActivityModel,
    draftModel?: DraftModel
  ) {
    this.emailModel = emailModel;
    this.connectorService = connectorService;
    this.notificationService = notificationService;
    this.activityModel = activityModel;
    this.draftModel = draftModel || new DraftModel();
    this.historicalSyncService = new HistoricalSyncService(
      emailModel,
      connectorService,
      notificationService
    );
    this.initializeWorker();
  }

  private initializeWorker() {
    try {
      // Support ts-node in development
      const options: any = {};

      // If the worker script is .ts, we need to register ts-node
      if (this.workerScriptPath.endsWith('.ts')) {
        options.execArgv = ["-r", "ts-node/register"];
      }

      this.worker = new Worker(this.workerScriptPath, options);
      this.worker.on('error', (err) => console.error('Email Parser Worker Error:', err));

      this.setupWorkerMessageHandler();
    } catch (e) {
      console.error('Failed to initialize email worker:', e);
    }
  }

  private pendingTasks: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();

  private setupWorkerMessageHandler() {
    if (!this.worker) return;
    this.worker.on('message', (msg) => {
      const task = this.pendingTasks.get(msg.id);
      if (task) {
        if (msg.success) {
          task.resolve(msg.data);
        } else {
          task.reject(new Error(msg.error));
        }
        this.pendingTasks.delete(msg.id);
      }
    });
  }

  private parseWithWorker(source: any): Promise<any> {
    if (!this.worker) {
      // Fallback if worker failed to init
      return simpleParser(source);
    }
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      this.pendingTasks.set(id, { resolve, reject });
      this.worker!.postMessage({ id, source, type: 'parse' });

      // Timeout safety
      setTimeout(() => {
        if (this.pendingTasks.has(id)) {
          this.pendingTasks.delete(id);
          reject(new Error('Worker timeout'));
        }
      }, 30000);
    });
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
      threadId?: string;
      enableTracking?: boolean;
    },
    options?: { skipSave?: boolean }
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

    // Generate unique ID before sending to support tracking injection
    const emailId = uuidv4();

    // Send email via connector service (passing the pre-generated ID for tracking injection)
    const messageId = await this.connectorService.sendEmail(account, {
      ...emailData,
      emailId
    });

    if (options?.skipSave) {
      return messageId;
    }

    // Create email record in database using the pre-generated ID
    const email: Email = {
      id: emailId,
      messageId,
      threadId: emailData.threadId || messageId, // Use provided threadId or default to messageId
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

    for (const rawRecipient of allRecipients) {
      try {
        const cleanRecipient = this.extractEmailFromAddress(rawRecipient);
        if (!cleanRecipient) continue;

        const recipientAccount = await this.emailModel.getEmailAccountByEmail(cleanRecipient);

        if (recipientAccount) {
          const isSelfSent = String(recipientAccount.id) === String(account.id);
          const isSameUser = String(recipientAccount.userId) === String(account.userId);

          // 1. Create a database record for the recipient immediately
          // This ensures they see the email even before sync
          const recipientEmailRecord: Email = {
            ...email,
            id: isSelfSent ? emailId : `${recipientAccount.id}-${messageId}`, // Use the sent ID for self, composite for others
            accountId: recipientAccount.id,
            isIncoming: true,
            isRead: false,
            // For self-sent emails, mark them differently so they appear in both Inbox and Sent
            folder: 'INBOX',
            // Directional metadata
            receivedAt: new Date(),
          };

          // Check if recipient already has this email
          const existingForRecipient = await this.emailModel.findEmailByMessageId(messageId, recipientAccount.id);

          if (!existingForRecipient) {
            // New recipient (not self): Create the incoming-focused record
            await this.emailModel.createEmail(recipientEmailRecord);
          } else if (isSelfSent) {
            // Self-sent email: Update the existing "Sent" record to also be in INBOX
            await this.emailModel.updateEmail(emailId, { folder: 'INBOX' });
          }

          // 2. Trigger real-time notification for the recipient (including self!)
          // Self-sent emails should notify the sender that they have "received" their own email
          if (this.notificationService) {
            console.log(`[Email] Notifying user ${recipientAccount.userId} about new email ${recipientAccount.id === account.id ? '(SELF)' : '(INTERNAL)'}`);
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
    console.log(`[EmailService] Detected dealId: ${emailData.dealId}, activityModel present: ${!!this.activityModel}`);
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
            body: email.body,
            cc: email.cc,
            bcc: email.bcc,
            htmlBody: email.htmlBody,
            threadId: email.threadId,
            attachments: email.attachments?.map(att => ({
              filename: att.filename,
              url: att.url || '',
              size: att.size,
              mimeType: att.contentType
            }))
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

    // Notify sender about email delivered
    // if (this.notificationService) {
    //   this.notificationService.notifyEmailDelivered(
    //     account.userId,
    //     messageId,
    //     emailData.to[0]
    //   );
    // }

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

      // Use a safety buffer (15 minutes) for sync time to account for server delays/clock skew
      const syncSince = account.lastSyncAt
        ? new Date(account.lastSyncAt.getTime() - 15 * 60 * 1000)
        : undefined;

      if (provider === "gmail") {
        rawEmails = await this.connectorService.fetchGmailEmails(
          account,
          syncSince,
          100
        );
      } else if (provider === "outlook") {
        rawEmails = await this.connectorService.fetchOutlookEmails(
          account,
          syncSince
        );
      } else if (provider === "imap" || provider === "custom") {
        const useQuickSync = !!account.lastSyncAt;
        rawEmails = await this.connectorService.fetchIMAPEmailsParallel(
          account,
          syncSince,
          useQuickSync
        );
      }

      if (rawEmails.length === 0) {
        // No emails to process, just update sync time
        await this.emailModel.updateEmailAccount(account.id, {
          lastSyncAt: new Date(),
        });

        if (this.notificationService) {
          this.notificationService.notifySyncStatus(account.userId, account.id, 'completed', {
            processed: 0,
            newEmails: 0,
            errors: 0
          });
        }
        return { processed: 0, errors: 0, newEmails: 0 };
      }

      // ============ OPTIMIZED BATCH PROCESSING ============
      const startTime = Date.now();
      console.log(`[EmailSync] Starting optimized batch processing for ${rawEmails.length} emails`);

      // Step 1: Parse all emails in parallel with concurrency limit
      const PARSE_CONCURRENCY = 10;
      const parsedEmails: { raw: any; parsed: Partial<Email> | null; error?: string }[] = [];

      for (let i = 0; i < rawEmails.length; i += PARSE_CONCURRENCY) {
        const batch = rawEmails.slice(i, i + PARSE_CONCURRENCY);
        const batchResults = await Promise.allSettled(
          batch.map(async (rawEmail) => {
            try {
              const parsed = await this.parseRawEmail(rawEmail, provider);
              return { raw: rawEmail, parsed };
            } catch (error: any) {
              return { raw: rawEmail, parsed: null, error: error.message };
            }
          })
        );

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            parsedEmails.push(result.value);
          } else {
            parsedEmails.push({ raw: null, parsed: null, error: result.reason?.message });
            errors++;
          }
        }
      }

      console.log(`[EmailSync] Parsed ${parsedEmails.length} emails in ${Date.now() - startTime}ms`);

      // Step 2: Extract messageIds for batch existence check
      const messageIds = parsedEmails
        .filter(e => e.parsed?.messageId)
        .map(e => e.parsed!.messageId!);

      // Step 3: Batch fetch existing emails (1 query instead of N)
      const existingEmailsMap = await this.emailModel.findEmailsByMessageIds(messageIds, account.id);
      console.log(`[EmailSync] Found ${existingEmailsMap.size} existing emails out of ${messageIds.length}`);

      // Step 4: For IMAP, also check by UID (batch)
      let existingUidsSet = new Set<string>();
      if (provider === 'imap' || provider === 'custom') {
        const folderUidPairs = parsedEmails
          .filter(e => e.parsed && (e.parsed as any).uid && (e.parsed as any).folder)
          .map(e => ({ folder: (e.parsed as any).folder, uid: (e.parsed as any).uid }));

        if (folderUidPairs.length > 0) {
          existingUidsSet = await this.emailModel.findExistingImapUids(account.id, folderUidPairs);
        }
      }

      // Step 5: Batch fetch existing content for deduplication
      const existingContentMap = await this.emailModel.findExistingContentByMessageIds(messageIds);
      console.log(`[EmailSync] Found ${existingContentMap.size} existing content records`);

      // Step 6: Separate new emails from existing ones
      const emailsToCreate: Email[] = [];
      const emailsToUpdate: { id: string; updates: any }[] = [];
      const newEmailNotifications: Email[] = [];

      for (const { raw, parsed, error } of parsedEmails) {
        if (error || !parsed || !parsed.messageId) {
          if (error) errors++;
          continue;
        }

        // Check if exists by messageId
        const existing = existingEmailsMap.get(parsed.messageId);

        // Also check by IMAP UID if applicable
        const uidKey = (parsed as any).uid && (parsed as any).folder
          ? `${(parsed as any).folder}:${(parsed as any).uid}`
          : null;
        const existsByUid = uidKey ? existingUidsSet.has(uidKey) : false;

        if (existing || existsByUid) {
          // Email exists - check if we need updates
          if (existing) {
            let needsUpdate = false;
            const updates: any = {};

            if (!existing.providerId && parsed.providerId) {
              updates.providerId = parsed.providerId;
              needsUpdate = true;
            }
            if ((parsed as any).uid && existing.uid === null) {
              updates.uid = (parsed as any).uid;
              needsUpdate = true;
            }
            if ((parsed as any).folder && existing.folder !== (parsed as any).folder) {
              // Skip folder move if keeping email in INBOX
              if (!(existing.folder === 'INBOX' && (parsed as any).folder === 'SENT')) {
                updates.folder = (parsed as any).folder;
                updates.labelIds = [(parsed as any).folder];
                needsUpdate = true;
              }
            }
            if (existing.isRead !== parsed.isRead) {
              updates.isRead = parsed.isRead;
              needsUpdate = true;
            }

            // Body repair: if existing email has no body but we just parsed one, update it
            const existingHasBody = (existing.body && existing.body !== "" && existing.body !== "Error parsing email content." && existing.body !== "[object Uint8Array]");
            const parsedHasBody = (parsed.body && parsed.body !== "");

            if (!existingHasBody && parsedHasBody) {
              updates.body = parsed.body;
              updates.snippet = this.generateSnippet(parsed);
              needsUpdate = true;
            }
            if (!existing.htmlBody && parsed.htmlBody) {
              updates.htmlBody = parsed.htmlBody;
              needsUpdate = true;
            }

            if (needsUpdate) {
              (updates as any).messageId = existing.messageId; // Pass messageId for EmailContent update
              emailsToUpdate.push({ id: existing.id, updates });
            }
          }
          processed++;
          continue;
        }

        // New email - reuse content if exists AND it's not empty
        // This prevents overwriting a correctly parsed new email with a broken/empty record in the DB
        const existingContent = existingContentMap.get(parsed.messageId);
        if (existingContent && (existingContent.body || existingContent.htmlBody)) {
          // Only reuse if the existing content seems valid
          parsed.body = existingContent.body;
          parsed.htmlBody = existingContent.htmlBody;
          parsed.attachments = existingContent.attachments;
        }

        // Match with CRM entities (lightweight)
        const { contactIds, dealIds, accountEntityIds } =
          await this.matchEmailWithCRMEntities(parsed);

        // Auto-link to deals via threadId: if this email belongs to a thread
        // where another email is already linked to a deal, inherit those deal associations
        if (parsed.threadId && dealIds.length === 0) {
          try {
            const threadDealIds = await this.emailModel.findDealIdsByThreadId(parsed.threadId);
            if (threadDealIds.length > 0) {
              dealIds.push(...threadDealIds);
              console.log(`[EmailSync] Auto-linked email ${parsed.messageId} to deals [${threadDealIds.join(', ')}] via threadId ${parsed.threadId}`);
            }
          } catch (err) {
            console.error('[EmailSync] Error auto-linking email to deals via threadId:', err);
          }
        }

        const isIncoming = this.determineEmailDirection(parsed, account, raw);
        const uniqueEmailId = `${account.id}-${parsed.messageId}`;

        const email: Email = {
          id: uniqueEmailId,
          messageId: parsed.messageId,
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
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Add optional fields
        if (parsed.threadId) email.threadId = parsed.threadId;
        if (parsed.cc) email.cc = parsed.cc;
        if (parsed.bcc) email.bcc = parsed.bcc;
        if (parsed.htmlBody) email.htmlBody = parsed.htmlBody;
        if (parsed.attachments) email.attachments = parsed.attachments;
        if (parsed.labelIds) email.labelIds = parsed.labelIds;
        if ((parsed as any).uid) email.uid = (parsed as any).uid;
        if ((parsed as any).folder) email.folder = (parsed as any).folder;
        if (parsed.providerId) email.providerId = parsed.providerId;

        emailsToCreate.push(email);

        // Queue notification for new incoming emails
        if (isIncoming || email.folder === 'INBOX') {
          newEmailNotifications.push(email);
        }

        processed++;
        newEmails++;
      }

      // Step 7: Bulk insert new emails (single transaction)
      if (emailsToCreate.length > 0) {
        console.log(`[EmailSync] Bulk inserting ${emailsToCreate.length} new emails`);
        await this.emailModel.bulkCreateEmails(emailsToCreate);
      }

      // Step 8: Batch update existing emails
      if (emailsToUpdate.length > 0) {
        console.log(`[EmailSync] Updating ${emailsToUpdate.length} existing emails`);
        await this.emailModel.batchUpdateEmails(emailsToUpdate);
      }

      // Step 9: Send notifications for new emails (async, don't block)
      if (this.notificationService && newEmailNotifications.length > 0) {
        console.log(`[EmailSync] Sending ${newEmailNotifications.length} notifications`);
        for (const email of newEmailNotifications) {
          this.notificationService.notifyNewEmail(account.userId, email);
        }
      }

      console.log(`[EmailSync] Batch processing completed in ${Date.now() - startTime}ms`);
      // ============ END OPTIMIZED BATCH PROCESSING ============

      // Refresh flags for existing emails
      if (provider === "imap" || provider === "custom") {
        await this.refreshEmailFlags(account);
      } else if (provider === "gmail" && account.lastHistoryId) {
        await this.syncGmailHistory(account);
      } else if (provider === "outlook") {
        await this.refreshOutlookFlags(account);
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
  ): Promise<{ id: string, isNew: boolean } | null> {
    const parsed = await this.parseRawEmail(rawEmail, account.provider);
    const provider = account.provider;

    // Check if email already exists for THIS account
    let existing: Email | null = null;

    if (provider === 'imap' || provider === 'custom') {
      const { uid, folder } = parsed as any;
      if (uid && folder) {
        existing = await this.emailModel.findEmailByImapUid(account.id, folder, uid);
      }
    }

    if (!existing) {
      existing = await this.emailModel.findEmailByMessageId(
        parsed.messageId!,
        account.id
      );
    }

    if (existing) {
      // If found, we can potentially backfill missing fields (historical sync)
      let needsUpdate = false;
      const updates: any = {};

      if (!existing.providerId && parsed.providerId) {
        updates.providerId = parsed.providerId;
        needsUpdate = true;
      }
      if (parsed.uid && existing.uid === null) {
        updates.uid = parsed.uid;
        needsUpdate = true;
      }

      // Update folder if it changed (handles moves between Inbox/Trash/etc)
      if (parsed.folder && existing.folder !== parsed.folder) {
        // PRIORITY FIX FOR SELF-SENT EMAILS:
        // If an email is already in 'INBOX', don't let a secondary sync (e.g. from the SENT folder)
        // move it out to 'SENT'. We want it to stay in 'INBOX' to remain visible there.
        if (existing.folder === 'INBOX' && parsed.folder === 'SENT') {
          console.log(`[Sync] Skipping folder move for self-sent email ${existing.id}: SENT -> INBOX (keeping INBOX)`);

          // However, we SHOULD update the SentAt/Created time if the sent copy has better data
          updates.sentAt = parsed.sentAt;
          needsUpdate = true;
        } else {
          console.log(`[Sync] Email ${existing.id} folder changed: ${existing.folder} -> ${parsed.folder}`);
          updates.folder = parsed.folder;
          updates.uid = parsed.uid; // Also update UID since it changes when moving folders
          updates.labelIds = [parsed.folder]; // Update labels to match
          needsUpdate = true;

          // If an email has "moved" to the inbox, notify the user as it's a new arrival for their attention
          if (parsed.folder === 'INBOX' && this.notificationService) {
            console.log(`[Email] Notifying about email ${existing.id} moving to INBOX`);
            this.notificationService.notifyNewEmail(account.userId, { ...existing, ...updates });
          }
        }
      }

      if (needsUpdate) {
        console.log(`Backfilling missing fields for existing email ${existing.id}:`, updates);
        await this.emailModel.updateEmail(existing.id, updates);
      }

      if (existing.isRead !== parsed.isRead) {
        await this.emailModel.markEmailAsRead(existing.id, account.userId, !!parsed.isRead);
      }

      return { id: existing.id, isNew: false };
    }

    // --- CHECK FOR GLOBAL CONTENT REUSE ---
    const existingContent = await this.emailModel.findContentByMessageId(parsed.messageId!);
    if (existingContent) {
      console.log(`Reusing existing content for messageId: ${parsed.messageId}`);
      parsed.body = existingContent.body;
      parsed.htmlBody = existingContent.htmlBody;
      parsed.attachments = existingContent.attachments;
    }
    // --------------------------------------

    // Match with CRM entities
    const { contactIds, dealIds, accountEntityIds } =
      await this.matchEmailWithCRMEntities(parsed);

    // Auto-link to deals via threadId: if this email belongs to a thread
    // where another email is already linked to a deal, inherit those deal associations
    if (parsed.threadId && dealIds.length === 0) {
      try {
        const threadDealIds = await this.emailModel.findDealIdsByThreadId(parsed.threadId);
        if (threadDealIds.length > 0) {
          dealIds.push(...threadDealIds);
          console.log(`[EmailSync] Auto-linked email ${parsed.messageId} to deals [${threadDealIds.join(', ')}] via threadId ${parsed.threadId}`);
        }
      } catch (err) {
        console.error('[EmailSync] Error auto-linking email to deals via threadId:', err);
      }
    }

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
    if (parsed.uid) email.uid = parsed.uid;
    if (parsed.folder) email.folder = parsed.folder;
    if (parsed.providerId) email.providerId = parsed.providerId;

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
              body: email.body,
              threadId: email.threadId
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

    // Notify user about new incoming email OR self-sent email appearing in Inbox
    if (this.notificationService && (isIncoming || email.folder === 'INBOX')) {
      this.notificationService.notifyNewEmail(account.userId, email);
    }

    return { id: email.id, isNew: true };
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
      messageId: this.normalizeMessageId(headers["message-id"] || message.id),
      providerId: message.id,
      threadId: message.threadId,
      from: headers["from"],
      to: (headers["to"] || "")
        .split(",")
        .filter(Boolean)
        .map((s: string) => s.trim()),
      cc: headers["cc"]
        ? headers["cc"]
          .split(",")
          .filter(Boolean)
          .map((s: string) => s.trim())
        : undefined,
      bcc: headers["bcc"]
        ? headers["bcc"]
          .split(",")
          .filter(Boolean)
          .map((s: string) => s.trim())
        : undefined,
      subject: headers["subject"] || "",
      body: this.extractTextFromGmailPayload(message.payload),
      htmlBody: this.extractHtmlFromGmailPayload(message.payload),
      isRead: !(message.labelIds || []).includes("UNREAD"),
      sentAt: new Date(parseInt(message.internalDate)),
      receivedAt: new Date(parseInt(message.internalDate)),
      // Store labelIds for direction detection
      labelIds: message.labelIds || [],
      // For Gmail, if it has the INBOX label, mark it as being in the INBOX folder
      folder: (message.labelIds || []).includes("INBOX") ? "INBOX" :
        (message.labelIds || []).includes("SENT") ? "SENT" : undefined,
      attachments: this.extractAttachmentsFromGmailPayload(message.payload),
    } as any;
  }

  private normalizeMessageId(messageId: string): string {
    if (!messageId) return "";
    let id = messageId.trim();
    if (id.startsWith('<') && id.endsWith('>')) {
      id = id.substring(1, id.length - 1);
    }
    return id.toLowerCase();
  }

  private stripHtml(html: string): string {
    if (!html) return "";
    return html
      .replace(/<style[^>]*>.*<\/style>/gms, '')
      .replace(/<script[^>]*>.*<\/script>/gms, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  private parseOutlookMessage(message: any): Partial<Email> {
    return {
      messageId: this.normalizeMessageId(message.internetMessageId || message.id),
      providerId: message.id,
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
      folder: (message.parentFolderId === 'inbox' || message.inferenceClassification === 'focused') ? 'INBOX' : undefined,
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
        // Robust Buffer check
        let sourceData: any;
        if (Buffer.isBuffer(source)) {
          sourceData = source;
        } else if (source instanceof Uint8Array) {
          sourceData = Buffer.from(source);
        } else if (typeof source === 'object' && source !== null && source.type === 'Buffer' && Array.isArray(source.data)) {
          sourceData = Buffer.from(source.data);
        } else {
          sourceData = String(source || "");
        }

        // Use worker thread for parsing
        parsed = await this.parseWithWorker(sourceData);

        // Fallback: if text is missing but HTML is present, strip tags for body
        body = parsed.text || "";
        if (!body && (parsed.html || parsed.textAsHtml)) {
          body = this.stripHtml(parsed.html || parsed.textAsHtml);
        }

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
      messageId: this.normalizeMessageId(parsed.messageId || message.envelope?.messageId || `msg_${Date.now()}`),
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
      uid: message.uid,
      folder: message.folder,
      labelIds: message.folder ? [message.folder] : [],
    } as any;
  }

  private extractTextFromGmailPayload(payload: any): string {
    if (!payload) return "";
    if (payload.mimeType === "text/plain" && payload.body?.data) {
      // Gmail uses URL-safe base64 (replace - with + and _ with /)
      const base64 = payload.body.data.replace(/-/g, '+').replace(/_/g, '/');
      return Buffer.from(base64, "base64").toString();
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
      // Gmail uses URL-safe base64 (replace - with + and _ with /)
      const base64 = payload.body.data.replace(/-/g, '+').replace(/_/g, '/');
      return Buffer.from(base64, "base64").toString();
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
        const contentId = this.getGmailHeader(part.headers || [], 'content-id');
        if ((part.filename && part.filename.length > 0) || contentId) {
          const contentType = part.mimeType || 'application/octet-stream';
          const attachmentId = part.body?.attachmentId || `att_${Date.now()}_${attachments.length}`;

          const attachment: EmailAttachment = {
            id: attachmentId,
            filename: part.filename || (contentId ? `inline_${contentId.replace(/[<>]/g, '')}` : `att_${attachments.length}`),
            contentType: contentType,
            size: part.body?.size || 0,
            contentId: contentId
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

  private generateSnippet(email: Partial<Email>): string {
    if (email.snippet) return email.snippet;
    if (email.body) {
      return email.body.substring(0, 200).replace(/(\r\n|\n|\r)/gm, " ");
    } else if (email.htmlBody) {
      return this.stripHtml(email.htmlBody).substring(0, 200).replace(/(\r\n|\n|\r)/gm, " ").trim();
    }
    return "";
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
    return await this.emailModel.getEmailsForDeal(dealId);
  }

  /**
   * Get threaded email conversations for a deal.
   * Returns emails grouped by thread with full conversation context.
   */
  async getThreadedEmailsForDeal(dealId: string) {
    return await this.emailModel.getThreadedEmailsForDeal(dealId);
  }

  /**
   * Find dealIds linked to emails in a specific thread.
   * Used to auto-link reply emails to the same deals.
   */
  async findDealIdsByThreadId(threadId: string): Promise<string[]> {
    return await this.emailModel.findDealIdsByThreadId(threadId);
  }

  async getEmailAccountByUserId(userId: string): Promise<EmailAccount | null> {
    return await this.emailModel.getEmailAccountByUserId(userId);
  }

  async getEmailAccountByEmail(email: string): Promise<EmailAccount | null> {
    return await this.emailModel.getEmailAccountByEmail(email);
  }

  async getEmailAccountById(accountId: string): Promise<EmailAccount | null> {
    return await this.emailModel.getEmailAccountById(accountId);
  }

  async createEmailAccount(account: EmailAccount): Promise<EmailAccount> {
    return await this.emailModel.createEmailAccount(account);
  }

  async updateEmailAccount(
    accountId: string,
    updates: Partial<EmailAccount>
  ): Promise<void> {
    return await this.emailModel.updateEmailAccount(accountId, updates);
  }

  async getEmailAccounts(userId: string): Promise<EmailAccount[]> {
    return await this.emailModel.getEmailAccounts(userId);
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
    return await this.emailModel.getEmailsForUser(userId, options);
  }

  // In EmailService
  async getAllEmails(options: { limit?: number } = {}) {
    return await this.emailModel.getAllEmails({ limit: 1000 });
  }

  // Get a specific email by ID
  async getEmailById(emailId: string, userId: string): Promise<Email | null> {
    return await this.emailModel.getEmailById(emailId, userId);
  }

  // Mark email as read/unread
  async markEmailAsRead(
    emailId: string,
    userId: string,
    isRead: boolean
  ): Promise<boolean> {
    // 1. Update local DB immediately
    const success = await this.emailModel.markEmailAsRead(emailId, userId, isRead);
    if (!success) {
      return false;
    }

    // 2. Sync to provider asynchronously
    // Fetch email to get accountId and provider details
    const email = await this.emailModel.getEmailById(emailId, userId);
    if (!email) {
      return true; // DB update was success, but somehow can't refetch? inconsistent but return success
    }

    const account = await this.emailModel.getEmailAccountById(email.accountId);
    if (!account) {
      console.warn(`Account ${email.accountId} not found for email ${emailId}, skipping provider sync`);
      return true;
    }

    // Don't await provider sync to keep UI snappy
    this.syncReadStatusToProvider(account, email, isRead).catch(err => {
      console.error(`Failed to sync read status for ${emailId} to provider:`, err);
    });

    return true;
  }

  async archiveEmail(emailId: string, userId: string): Promise<boolean> {
    return await this.emailModel.archiveEmail(emailId, userId);
  }

  async unarchiveEmail(emailId: string, userId: string): Promise<boolean> {
    return await this.emailModel.unarchiveEmail(emailId, userId);
  }

  /**
   * Move email to trash (soft delete)
   * Updates local DB and syncs to provider (Gmail/IMAP/Outlook)
   */
  async trashEmail(emailId: string, userId: string): Promise<boolean> {
    // 1. Update local DB immediately
    const success = await this.emailModel.trashEmail(emailId, userId);

    if (!success) {
      if (this.draftModel) {
        // Try finding it as a draft
        const draft = await this.draftModel.trashDraft(emailId, userId);
        if (draft) {
          if (draft.remoteUid || draft.providerId) {
            this.syncDraftTrashToProvider(draft, userId, true).catch(err =>
              console.error(`Failed to sync draft trash status for ${emailId}:`, err)
            );
          }
          return true;
        }
      }
      return false;
    }

    // 2. Sync to provider asynchronously
    const email = await this.emailModel.getEmailById(emailId, userId);
    if (!email) {
      return true;
    }

    const account = await this.emailModel.getEmailAccountById(email.accountId);
    if (!account) {
      console.warn(`Account ${email.accountId} not found for email ${emailId}, skipping provider sync`);
      return true;
    }

    // Don't await provider sync to keep UI snappy
    this.syncTrashToProvider(account, email, true).catch(err => {
      console.error(`Failed to sync trash status for ${emailId} to provider:`, err);
    });

    return true;
  }

  /**
   * Restore email from trash back to inbox
   */
  async restoreFromTrash(emailId: string, userId: string): Promise<boolean> {
    // 1. Update local DB immediately
    const success = await this.emailModel.restoreFromTrash(emailId, userId);

    if (!success) {
      if (this.draftModel) {
        // Try finding it as a draft
        const draft = await this.draftModel.restoreDraftFromTrash(emailId, userId);
        if (draft) {
          if (draft.remoteUid || draft.providerId) {
            this.syncDraftTrashToProvider(draft, userId, false).catch(err =>
              console.error(`Failed to sync draft restore status for ${emailId}:`, err)
            );
          }
          return true;
        }
      }
      return false;
    }

    // 2. Sync to provider asynchronously
    const email = await this.emailModel.getEmailById(emailId, userId);
    if (!email) {
      return true;
    }

    const account = await this.emailModel.getEmailAccountById(email.accountId);
    if (!account) {
      console.warn(`Account ${email.accountId} not found for email ${emailId}, skipping provider sync`);
      return true;
    }

    // 2. Sync to provider synchronously to ensure alignment
    // 2. Sync to provider synchronously to ensure alignment
    try {
      // Re-fetch email to get updated labels/folder from local restore logic
      const updatedEmail = await this.emailModel.getEmailById(emailId, userId);
      await this.syncTrashToProvider(account, updatedEmail || email, false);
    } catch (err) {
      console.error(`Failed to sync restore from trash for ${emailId} to provider:`, err);
    }

    return true;
  }

  /**
   * Delete all emails in trash permanently
   */
  async deleteAllTrash(userId: string): Promise<{ deleted: number; failed: number }> {
    let deleted = 0;
    let failed = 0;

    // 1. Fetch all items first (Emails + Drafts)
    const trashEmails = await this.emailModel.getTrashEmails(userId);
    let trashDrafts: any[] = [];
    if (this.draftModel) {
      const { drafts } = await this.draftModel.getTrashedDrafts(userId, 5000, 0); // High limit to get all
      trashDrafts = drafts;
    }

    // 2. Optimistic Local Delete (Fast UI)
    // We assume local delete succeeds mostly. If it fails, we catch below.
    try {
      // Bulk delete emails
      if (trashEmails.length > 0) {
        // Using a loop for now since we don't have a bulk delete method exposed on EmailModel that takes IDs easily
        // Actually purging by IDs is safer.
        // Let's assume we can loop delete locally very fast.
        // Or better: use available methods.
        // To ensure "Instant", we should run local deletes in parallel or batch.
        // Since EmailModel doesn't have deleteMany exposed here, we'll loop parallel promises.
        await Promise.all(trashEmails.map(e => this.emailModel.deleteEmailPermanently(e.id, userId)));
        deleted += trashEmails.length;
      }

      // Bulk delete drafts
      if (trashDrafts.length > 0) {
        await this.draftModel.deleteAllTrashedDrafts(userId);
        // Drafts are deleted locally by this call
      }
    } catch (e) {
      console.error("Local bulk delete failed partially", e);
      // Continue to sync what we have
    }

    // 3. Background Sync (Slow Server)
    // We use the FETCHED objects to sync, because they don't exist in DB anymore!
    Promise.all([
      (async () => {
        for (const email of trashEmails) {
          try {
            const account = await this.emailModel.getEmailAccountById(email.accountId);
            if (account) {
              await this.syncPermanentDeleteToProvider(account, email);
            }
          } catch (err) {
            console.warn(`[Background] Failed to sync delete email ${email.id}`, err);
            failed++;
          }
        }
      })(),
      (async () => {
        for (const draft of trashDrafts) {
          try {
            // Pass the draft object to avoid re-fetching!
            await this.deleteDraftFromServer(userId, draft.id, draft);
          } catch (err) {
            console.warn(`[Background] Failed to sync delete draft ${draft.id}`, err);
            failed++;
          }
        }
      })()
    ]).then(() => {
      console.log(`[DeleteAllTrash] Background sync completed.`);
    });

    console.log(`[DeleteAllTrash] Started background tasks. Local items cleared.`);
    return { deleted, failed };
  }

  /**
   * Permanently delete an email
   * Validates draft vs email, deletes local first (optimistic), then syncs
   */
  async deleteEmailPermanently(emailId: string, userId: string): Promise<boolean> {
    // 0. Check if it's a draft first
    if (this.draftModel) {
      const draft = await this.draftModel.getDraftById(emailId, userId);
      if (draft) {
        // Local delete first
        await this.draftModel.deleteDraft(emailId, userId);

        // Background sync
        this.deleteDraftFromServer(userId, emailId, draft).catch(e => console.warn(e));
        return true;
      }
    }

    // Get email first to have data for sync
    const email = await this.emailModel.getEmailById(emailId, userId);
    if (!email) {
      return false;
    }

    const account = await this.emailModel.getEmailAccountById(email.accountId);

    // 1. Delete from local DB IMMEDIATELY (Optimistic)
    const success = await this.emailModel.deleteEmailPermanently(emailId, userId);

    // 2. Sync permanent deletion to provider in BACKGROUND
    if (account && success) {
      this.syncPermanentDeleteToProvider(account, email).catch(err => {
        console.error(`[Background] Failed to sync permanent deletion for ${emailId}:`, err);
        // We can't revert the local delete easily. We accept slight desync risk for UI speed.
        // Or we could flag it? For now, logging is standard for optimistic UI.
      });
    }

    return success;
  }

  /**
   * Sync trash/restore status to email provider
   */
  private async syncTrashToProvider(account: EmailAccount, email: Email, moveToTrash: boolean) {
    const { provider } = account;
    console.log(`[TrashSync] Starting sync for email ${email.id} (Provider: ${provider}, moveToTrash: ${moveToTrash})`);

    try {
      if (provider === 'gmail') {
        let gmailId = email.providerId;

        if (!gmailId) {
          console.log(`[TrashSync] providerId missing for Gmail email ${email.id}. Attempting to resolve via RFC Message-ID...`);
          gmailId = (await this.connectorService.findGmailMessageByRfcId(account, email.messageId)) ?? undefined;
          if (gmailId) {
            console.log(`[TrashSync] Resolved Gmail ID: ${gmailId}. Backfilling DB.`);
            await this.emailModel.updateEmail(email.id, { providerId: gmailId ?? undefined });
          }
        }

        if (!gmailId) {
          console.error(`[TrashSync] Could not resolve Gmail ID for message ${email.messageId}. Cannot sync status.`);
          return;
        }

        if (moveToTrash) {
          // Move to trash in Gmail
          await this.connectorService.trashGmailEmail(account, gmailId);
        } else {
          // Restore from trash in Gmail (remove TRASH label)
          await this.connectorService.untrashGmailEmail(account, gmailId);
        }
        console.log(`[TrashSync] Successfully synced Gmail trash status for message ${gmailId}`);
      }
      else if (provider === 'imap' || provider === 'custom') {
        const { uid, folder, messageId } = email;
        if (uid && folder) {
          if (moveToTrash) {
            // Move to Trash folder via IMAP (pass messageId for robust finding if folder invalid)
            await this.connectorService.moveImapEmailToTrash(account, folder, uid, messageId);
          } else {
            // Move back to original folder from Trash (pass messageId to find correct UID)
            // If folder is undefined, default to INBOX. For Drafts, folder ('DRAFT') is passed.
            await this.connectorService.moveImapEmailFromTrash(account, uid, messageId, folder || 'INBOX');
          }
          console.log(`[TrashSync] Successfully synced IMAP trash status for UID ${uid} in folder ${folder}`);
        } else {
          console.warn(`[TrashSync] Skipping IMAP sync for ${email.id} - missing UID or folder`);
        }
      }
      else if (provider === 'outlook') {
        let outlookId = email.providerId;

        if (!outlookId) {
          console.log(`[TrashSync] providerId missing for Outlook email ${email.id}. Attempting to resolve via Internet Message-ID...`);
          outlookId = (await this.connectorService.findOutlookMessageByRfcId(account, email.messageId)) ?? undefined;
          if (outlookId) {
            console.log(`[TrashSync] Resolved Outlook ID: ${outlookId}. Backfilling DB.`);
            await this.emailModel.updateEmail(email.id, { providerId: outlookId ?? undefined });
          }
        }

        if (!outlookId) {
          console.error(`[TrashSync] Could not resolve Outlook ID for message ${email.messageId}. Cannot sync status.`);
          return;
        }

        if (moveToTrash) {
          await this.connectorService.trashOutlookEmail(account, outlookId);
        } else {
          await this.connectorService.untrashOutlookEmail(account, outlookId);
        }
        console.log(`[TrashSync] Successfully synced Outlook trash status for message ${outlookId}`);
      }
    } catch (error) {
      console.error(`[TrashSync] Failed to sync trash status for ${email.id} (${provider}):`, error);
    }
  }

  /**
   * Sync permanent deletion to email provider
   */
  private async syncPermanentDeleteToProvider(account: EmailAccount, email: Email) {
    const { provider } = account;
    console.log(`[DeleteSync] Starting permanent delete sync for email ${email.id} (Provider: ${provider})`);

    try {
      if (provider === 'gmail') {
        let gmailId = email.providerId;

        if (!gmailId) {
          gmailId = (await this.connectorService.findGmailMessageByRfcId(account, email.messageId)) ?? undefined;
        }

        if (gmailId) {
          await this.connectorService.deleteGmailEmailPermanently(account, gmailId);
          console.log(`[DeleteSync] Successfully deleted Gmail message ${gmailId}`);
        }
      }
      else if (provider === 'imap' || provider === 'custom') {
        const { uid, folder, messageId } = email;
        if (uid && folder) {
          // Pass messageId to find the email in Trash folder (UIDs change after move)
          await this.connectorService.deleteImapEmailPermanently(account, folder, uid, messageId);
          console.log(`[DeleteSync] Successfully deleted IMAP email UID ${uid} from folder ${folder}`);
        }
      }
      else if (provider === 'outlook') {
        let outlookId = email.providerId;

        if (!outlookId) {
          outlookId = (await this.connectorService.findOutlookMessageByRfcId(account, email.messageId)) ?? undefined;
        }

        if (outlookId) {
          await this.connectorService.deleteOutlookEmailPermanently(account, outlookId);
          console.log(`[DeleteSync] Successfully deleted Outlook message ${outlookId}`);
        }
      }
    } catch (error) {
      console.error(`[DeleteSync] Failed to sync permanent deletion for ${email.id} (${provider}):`, error);
    }
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
            const gmailId = item.message.id;
            // Check if we already have it using internal Gmail ID
            const existing = await this.emailModel.findEmailByProviderId(account.id, gmailId);
            if (!existing) {
              // Fetch full details
              const fullMsg = await this.connectorService.fetchGmailMessageDetails(account.id, gmailId);
              const result = await this.processSingleEmail(account, fullMsg);

              // Check if it should be archived
              if (result) {
                const labels = fullMsg.labelIds || [];
                if (!labels.includes('INBOX') && !labels.includes('SPAM') && !labels.includes('TRASH')) {
                  await this.ensureArchiveStatus(result.id, account.userId);
                }
                processed++;
              }
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
            if (item.labelIds) {
              if (item.labelIds.includes('INBOX')) {
                console.log(`Message ${item.message.id} archived (INBOX label removed)`);
                const existing = await this.emailModel.findEmailByProviderId(account.id, item.message.id);
                if (existing) {
                  await this.emailModel.archiveEmail(existing.id, account.userId);
                  processed++;
                }
              }
              if (item.labelIds.includes('UNREAD')) {
                console.log(`Message ${item.message.id} marked as READ (UNREAD label removed)`);
                const existing = await this.emailModel.findEmailByProviderId(account.id, item.message.id);
                if (existing) {
                  await this.emailModel.markEmailAsRead(existing.id, account.userId, true);
                  processed++;
                }
              }
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
            if (item.labelIds) {
              if (item.labelIds.includes('INBOX')) {
                console.log(`Message ${item.message.id} unarchived (INBOX label added)`);
                const existing = await this.emailModel.findEmailByProviderId(account.id, item.message.id);
                if (existing) {
                  await this.emailModel.unarchiveEmail(existing.id, account.userId);
                  processed++;
                }
              }
              if (item.labelIds.includes('UNREAD')) {
                console.log(`Message ${item.message.id} marked as UNREAD (UNREAD label added)`);
                const existing = await this.emailModel.findEmailByProviderId(account.id, item.message.id);
                if (existing) {
                  await this.emailModel.markEmailAsRead(existing.id, account.userId, false);
                  processed++;
                }
              }
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

  private async syncReadStatusToProvider(account: EmailAccount, email: Email, isRead: boolean) {
    const { provider } = account;
    console.log(`[ReadSync] Starting sync for email ${email.id} (Provider: ${provider}, isRead: ${isRead})`);

    try {
      if (provider === 'gmail') {
        // Use providerId (hex ID) if available
        let gmailId = email.providerId;

        if (!gmailId) {
          console.log(`[ReadSync] providerId missing for Gmail email ${email.id}. Attempting to resolve via RFC Message-ID...`);
          gmailId = (await this.connectorService.findGmailMessageByRfcId(account, email.messageId)) ?? undefined;
          if (gmailId) {
            console.log(`[ReadSync] Resolved Gmail ID: ${gmailId}. Backfilling DB.`);
            await this.emailModel.updateEmail(email.id, { providerId: gmailId ?? undefined });
          }
        }

        if (!gmailId) {
          console.error(`[ReadSync] Could not resolve Gmail ID for message ${email.messageId}. Cannot sync status.`);
          return;
        }

        // Gmail uses labels: UNREAD (if isRead=false, add UNREAD; isRead=true, remove UNREAD)
        await this.connectorService.setGmailLabel(account, gmailId, {
          add: isRead ? [] : ['UNREAD'],
          remove: isRead ? ['UNREAD'] : []
        });
        console.log(`[ReadSync] Successfully synced Gmail label for message ${gmailId}`);
      }
      else if (provider === 'imap' || provider === 'custom') {
        const { uid, folder } = email;
        if (uid && folder) {
          // IMAP uses \Seen flag
          await this.connectorService.setImapFlag(account, folder, uid, {
            add: isRead ? ['\\Seen'] : [],
            remove: isRead ? [] : ['\\Seen']
          });
          console.log(`[ReadSync] Successfully synced IMAP flag for UID ${uid} in folder ${folder}`);
        } else {
          console.warn(`[ReadSync] Skipping IMAP sync for ${email.id} - missing UID or folder`);
        }
      }
      else if (provider === 'outlook') {
        let outlookId = email.providerId;

        if (!outlookId) {
          console.log(`[ReadSync] providerId missing for Outlook email ${email.id}. Attempting to resolve via Internet Message-ID...`);
          outlookId = (await this.connectorService.findOutlookMessageByRfcId(account, email.messageId)) ?? undefined;
          if (outlookId) {
            console.log(`[ReadSync] Resolved Outlook ID: ${outlookId}. Backfilling DB.`);
            await this.emailModel.updateEmail(email.id, { providerId: outlookId ?? undefined });
          }
        }

        if (!outlookId) {
          console.error(`[ReadSync] Could not resolve Outlook ID for message ${email.messageId}. Cannot sync status.`);
          return;
        }

        await this.connectorService.setOutlookFlag(account, outlookId, { isRead });
        console.log(`[ReadSync] Successfully synced Outlook status for message ${outlookId}`);
      }
    } catch (error) {
      console.error(`[ReadSync] Failed to sync status for ${email.id} (${provider}):`, error);
      // We could add a retry queue here if needed
    }
  }

  /**
   * Sync draft to provider
   */
  async syncDraft(userId: string, draftId: string): Promise<boolean> {
    const draft = await this.draftModel.getDraftById(draftId, userId);
    if (!draft) return false;

    // Use DraftService logic if possible, but DraftService calls EmailService.saveDraft.
    // This method is for when we want to trigger a sync from EmailService context
    // or if we have specific flagging needs.
    // Actually, this is redundant if DraftService handles it.
    // But we might need to flag it as DRAFT on the provider side manually if saveDraft didn't?
    return true;
  }

  /**
   * Refresh read/unread status for existing emails in specified folders
   */
  private async refreshEmailFlags(account: EmailAccount): Promise<void> {
    if (account.provider !== 'imap' && account.provider !== 'custom') {
      return;
    }

    try {
      const folders = await this.connectorService.getIMAPFolderConfigs(account);

      for (const folder of folders) {
        // Get unread UIDs + last 50 synced UIDs for this folder
        const unreadUids = await this.emailModel.getUnreadUids(account.id, folder.label);
        const recentUids = await this.emailModel.getRecentUids(account.id, folder.label, 50);

        // Combine and unique UIDs
        const uidsToRefresh = Array.from(new Set([...unreadUids, ...recentUids]));

        if (uidsToRefresh.length === 0) continue;

        // Fetch current flags from server
        const flagMap = await this.connectorService.refreshIMAPFlags(account, folder.path, uidsToRefresh);

        // Compare with DB and update if needed
        // Compare with DB and update if needed
        for (const [uid, flags] of flagMap.entries()) {
          const isReadOnServer = flags.includes('\\Seen');

          // Get current state from DB
          const existing = await this.emailModel.findEmailByImapUid(account.id, folder.label, uid);
          if (existing && existing.isRead !== isReadOnServer) {
            await this.emailModel.markEmailAsRead(existing.id, account.userId, isReadOnServer);
          }
        }

        // Handle UIDs that are MISSING on server (Deleted/Moved)
        const foundUids = new Set(flagMap.keys());
        const missingUids = uidsToRefresh.filter(u => !foundUids.has(u));

        if (missingUids.length > 0) {
          console.log(`[Sync] Found ${missingUids.length} missing UIDs in ${folder.label}. Processing removals...`);

          for (const missingUid of missingUids) {
            const existing = await this.emailModel.findEmailByImapUid(account.id, folder.label, missingUid);
            if (!existing) {
              console.log(`[Sync] Could not find email with UID ${missingUid} in folder ${folder.label} for account ${account.id}. Skipping.`);
              continue;
            }

            if (folder.label === 'TRASH' || folder.label === 'SPAM') {
              // Check if it moved back to INBOX or SENT (restored) before permanently deleting
              let restoredTo: string | null = null;
              let restoredUid: number | null = null;

              // Use actually existing folders from the list we fetched earlier
              const foldersToCheck = new Set<string>();

              // 1. Add explicitly known common names if they exist
              const commonFolders = ['INBOX', 'Sent', 'INBOX.Sent', 'Sent Items'];
              const hostingerFolders = ['INBOX.Sent Messages', 'INBOX.Drafts', 'INBOX.Trash', 'INBOX.Spam']; // Common for Hostinger
              const allPaths = folders.map((f: any) => f.path);
              for (const f of [...commonFolders, ...hostingerFolders]) {
                if (allPaths.includes(f)) foldersToCheck.add(f);
              }

              for (const checkFolder of foldersToCheck) {
                try {
                  const result = await this.connectorService.searchImapEmailByMessageId(account, checkFolder, existing.messageId);
                  if (result) {
                    restoredTo = checkFolder === 'INBOX' ? 'INBOX' : 'SENT';
                    restoredUid = result.uid;
                    break;
                  }
                } catch (searchErr) {
                  // Ignore errors for individual folder checks
                }
              }

              if (restoredTo) {
                console.log(`[Sync] Email ${existing.id} was restored to ${restoredTo} on server. Updating local record.`);
                await this.emailModel.updateEmail(existing.id, {
                  folder: restoredTo,
                  labelIds: [restoredTo],
                  uid: restoredUid || null as any,
                  updatedAt: new Date()
                });
              } else {
                // Permanently delete if truly gone from Trash/Spam
                console.log(`[Sync] Deleting missing email ${existing.id} from ${folder.label}`);
                await this.emailModel.deleteEmailPermanently(existing.id, account.userId);
              }
            } else {
              // Soft delete (Move to Trash) if gone from Inbox/Sent/etc
              // Try to find the new UID in TRASH folder
              let trashUid: number | null = null;
              const trashFolders = ['Trash', 'INBOX.Trash', 'Deleted', 'Deleted Items'];
              for (const trashFolder of trashFolders) {
                try {
                  const result = await this.connectorService.searchImapEmailByMessageId(account, trashFolder, existing.messageId);
                  if (result) {
                    trashUid = result.uid;
                    break;
                  }
                } catch (searchErr) {
                  // Ignore errors for individual folder checks
                }
              }

              console.log(`[Sync] Soft deleting (moving to trash) missing email ${existing.id} from ${folder.label}${trashUid ? ` (found in Trash with UID ${trashUid})` : ''}`);
              await this.emailModel.updateEmail(existing.id, {
                folder: 'TRASH',
                labelIds: ['TRASH'],
                uid: trashUid || null as any, // Use found UID or null
                updatedAt: new Date()
              });
            }
          }
        }
      }
    } catch (error: any) {
      console.error(`Failed to refresh email flags for account ${account.id}:`, error.message);
    }
  }

  /**
   * Refresh read/unread status for Outlook emails
   */
  private async refreshOutlookFlags(account: EmailAccount): Promise<void> {
    try {
      // Get unread or recent email IDs
      // Note: For Outlook we don't have separate folders in a simple way like IMAP here
      // but we can at least check the most recent synced messages across all folders
      const unreadEmails = await this.emailModel.getEmailsForUser(account.userId, {
        accountId: account.id,
        unreadOnly: true,
        limit: 50
      });

      const recentEmails = await this.emailModel.getEmailsForUser(account.userId, {
        accountId: account.id,
        limit: 50
      });

      const emailsToRefresh = Array.from(new Map([...unreadEmails.emails, ...recentEmails.emails].map(e => [e.id, e])).values());

      for (const email of emailsToRefresh) {
        try {
          // Fetch current status from Outlook. Use providerId if available
          const outlookId = email.providerId || email.messageId;
          const isReadOnServer = await this.connectorService.fetchOutlookMessageStatus(account, outlookId);

          if (email.isRead !== isReadOnServer) {
            console.log(`Outlook message ${outlookId} status mismatch: CRM=${email.isRead}, Server=${isReadOnServer}. Updating...`);
            await this.emailModel.markEmailAsRead(email.id, account.userId, isReadOnServer);
          }
        } catch (err) {
          // Individual message fail shouldn't stop others
          console.warn(`Failed to refresh status for Outlook message ${email.providerId || email.messageId}:`, err);
        }
      }
    } catch (error: any) {
      console.error(`Failed to refresh Outlook flags for account ${account.id}:`, error.message);
    }
  }
  async saveDraft(
    userId: string,
    draftInput: {
      accountId: string;
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      body: string;
      htmlBody?: string;
      attachments?: EmailAttachment[];
    },
    existingProviderDraftId?: string
  ): Promise<string> {
    const account = await this.emailModel.getEmailAccountById(draftInput.accountId);
    if (!account) {
      throw new Error('Email account not found');
    }

    if (String(account.userId) !== String(userId)) {
      console.error(`Auth mismatch: account.userId=${account.userId} (${typeof account.userId}), userId=${userId} (${typeof userId})`);
      throw new Error('Unauthorized access to email account');
    }

    try {
      return await this.connectorService.saveDraft(account, draftInput, existingProviderDraftId);
    } catch (error) {
      console.warn('Failed to sync draft to provider:', error);
      // We rethrow so the DraftService knows that sync failed, but it can decide to catch and ignore
      throw error;
    }
  }

  async deleteDraftProvider(
    userId: string,
    accountId: string,
    providerDraftId: string
  ): Promise<void> {
    const account = await this.emailModel.getEmailAccountById(accountId);
    if (!account) return;

    if (account.userId !== userId) return;

    try {
      await this.connectorService.deleteDraft(account, providerDraftId);
    } catch (error) {
      console.warn('Failed to delete draft from provider:', error);
    }
  }

  async syncDraftTrashToProvider(draft: EmailDraft, userId: string, moveToTrash: boolean): Promise<void> {
    const account = await this.emailModel.getEmailAccountById(draft.accountId);
    if (!account || account.userId !== userId) return;

    const emailForSync: any = {
      id: draft.id,
      messageId: draft.id, // For drafts we might use ID if messageId missing
      providerId: draft.providerId || draft.providerDraftId,
      uid: draft.remoteUid ? parseInt(draft.remoteUid) : undefined,
      folder: 'DRAFTS'
    };

    return this.syncTrashToProvider(account, emailForSync, moveToTrash);
  }

  async deleteDraftFromServer(userId: string, draftId: string, draftObj?: EmailDraft): Promise<void> {
    const draft = draftObj || await this.draftModel.getDraftById(draftId, userId);
    if (!draft || !draft.providerDraftId) return;

    return this.deleteDraftProvider(userId, draft.accountId, draft.providerDraftId);
  }

  async triggerEmailSync(userId: string, accountId: string): Promise<{ success: boolean; message: string }> {
    const account = await this.emailModel.getEmailAccountById(accountId);
    if (!account || account.userId !== userId) {
      throw new Error("Account not found");
    }

    // Run in background
    this.processIncomingEmails(account).catch(err => {
      console.error(`Background sync failed for ${accountId}:`, err);
    });

    return { success: true, message: "Sync started in background" };
  }

  async triggerArchiveSync(userId: string): Promise<{ success: boolean; message: string }> {
    // Run in background
    this.syncArchivedEmails(userId).catch(err => {
      console.error(`Background archive sync failed for user ${userId}:`, err);
    });

    return { success: true, message: "Archive sync started in background" };
  }

  async getQueueStatus(): Promise<any> {
    return { status: 'operating', items: 0 }; // Placeholder
  }

  async getNotificationStats(): Promise<any> {
    return { delivered: 0, pending: 0 }; // Placeholder
  }

  async markEmailAsSpam(emailId: string, userId: string): Promise<boolean> {
    // Implement spam logic if needed, for now just a placeholder
    console.log(`Marking email ${emailId} as spam for user ${userId}`);
    return true;
  }

  async unmarkEmailAsSpam(emailId: string, userId: string): Promise<boolean> {
    // Implement unspam logic if needed, for now just a placeholder
    console.log(`Unmarking email ${emailId} from spam for user ${userId}`);
    return true;
  }
}
