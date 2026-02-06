import { Email, EmailAccount, EmailContent, Contact, Deal } from "./types";
import { prisma } from "../../../shared/prisma";
import { Prisma } from "@prisma/client";

export class EmailModel {
  private accountCache = new Map<string, { data: EmailAccount; expires: number }>();
  private readonly CACHE_TTL = 60 * 1000; // 1 minute cache

  constructor() { }

  initialize(): void { }

  async createEmail(email: Email): Promise<Email> {
    // 1. Save or update unique content
    // Check if we should update existing content (e.g. if it was empty before)
    await prisma.emailContent.upsert({
      where: { messageId: email.messageId },
      create: {
        messageId: email.messageId,
        body: email.body || "",
        htmlBody: email.htmlBody || null,
        attachments: (email.attachments as any) || [],
        createdAt: email.createdAt,
        updatedAt: email.updatedAt
      },
      update: {
        // If the new body is not empty but the existing one might be, we could update.
        // Prisma upsert 'update' doesn't easily support conditional setting based on existing DB value without a query.
        // However, we can at least ensure we provide the data if we have it.
        ...(email.body ? { body: email.body } : {}),
        ...(email.htmlBody ? { htmlBody: email.htmlBody } : {}),
        ...(email.attachments ? { attachments: (email.attachments as any) } : {}),
        updatedAt: new Date()
      }
    });

    // 2. Save account-specific metadata
    let snippet = email.snippet;
    if (!snippet) {
      if (email.body) {
        snippet = email.body.substring(0, 200).replace(/(\r\n|\n|\r)/gm, " ");
      } else if (email.htmlBody) {
        // Simple tag stripping to get snippet from HTML
        snippet = email.htmlBody.replace(/<[^>]*>/g, ' ').substring(0, 200).replace(/(\r\n|\n|\r)/gm, " ").trim();
      } else {
        snippet = "";
      }
    }

    const data: any = {
      id: email.id,
      messageId: email.messageId,
      threadId: email.threadId || null,
      accountId: email.accountId,
      from: email.from,
      to: (email.to as any) || [],
      cc: (email.cc as any) || [],
      bcc: (email.bcc as any) || [],
      subject: email.subject,
      body: email.body || "",
      htmlBody: email.htmlBody || null,
      snippet: snippet,
      isRead: email.isRead,
      isIncoming: email.isIncoming,
      sentAt: email.sentAt,
      receivedAt: email.receivedAt || null,
      contactIds: (email.contactIds as any) || [],
      dealIds: (email.dealIds as any) || [],
      accountEntityIds: (email.accountEntityIds as any) || [],
      createdAt: email.createdAt,
      updatedAt: email.updatedAt,
      labelIds: (email.labelIds as any) || [],
      uid: email.uid || null,
      folder: email.folder || null,
      providerId: email.providerId || null,
      attachments: (email.attachments as any) || []
    };

    await prisma.email.upsert({
      where: {
        messageId_accountId: {
          messageId: email.messageId,
          accountId: email.accountId
        }
      },
      create: data,
      update: data
    });

    return email;
  }

  async bulkCreateEmails(emails: Email[]): Promise<{ inserted: number; skipped: number }> {
    if (emails.length === 0) return { inserted: 0, skipped: 0 };

    try {
      // 1. Prepare unique content data (deduplicate by messageId)
      // We use a Map to ensure only one record per messageId, preferring the one with a body if available
      const contentMap = new Map<string, any>();
      for (const email of emails) {
        const existing = contentMap.get(email.messageId);
        // Prefer content that has a body or htmlBody
        const hasContent = (email.body && email.body.length > 0) || (email.htmlBody && email.htmlBody.length > 0);
        const existingHasContent = existing && ((existing.body && existing.body.length > 0) || (existing.htmlBody && existing.htmlBody.length > 0));

        if (!existing || (!existingHasContent && hasContent)) {
          contentMap.set(email.messageId, {
            messageId: email.messageId,
            body: email.body || "",
            htmlBody: email.htmlBody || null,
            attachments: (email.attachments as any) || [],
            createdAt: email.createdAt,
            updatedAt: email.updatedAt
          });
        }
      }

      const contentData = Array.from(contentMap.values());

      // 2. Prepare Email records
      const emailData = emails.map(email => {
        let snippet = email.snippet;
        if (!snippet) {
          if (email.body) {
            snippet = email.body.substring(0, 200).replace(/(\r\n|\n|\r)/gm, " ");
          } else if (email.htmlBody) {
            snippet = email.htmlBody.replace(/<[^>]*>/g, ' ').substring(0, 200).replace(/(\r\n|\n|\r)/gm, " ").trim();
          } else {
            snippet = "";
          }
        }

        return {
          id: email.id,
          messageId: email.messageId,
          threadId: email.threadId || null,
          accountId: email.accountId,
          from: email.from,
          to: (email.to as any) || [],
          cc: (email.cc as any) || [],
          bcc: (email.bcc as any) || [],
          subject: email.subject,
          body: email.body || "",
          htmlBody: email.htmlBody || null,
          snippet: snippet,
          isRead: email.isRead,
          isIncoming: email.isIncoming,
          sentAt: email.sentAt,
          receivedAt: email.receivedAt || null,
          contactIds: (email.contactIds as any) || [],
          dealIds: (email.dealIds as any) || [],
          accountEntityIds: (email.accountEntityIds as any) || [],
          createdAt: email.createdAt,
          updatedAt: email.updatedAt,
          labelIds: (email.labelIds as any) || [],
          uid: email.uid || null,
          folder: email.folder || null,
          providerId: email.providerId || null,
          attachments: (email.attachments as any) || []
        };
      });

      // 3. Find existing content records that might need repair
      const messageIds = contentData.map(c => c.messageId);
      const existingContent = await prisma.emailContent.findMany({
        where: { messageId: { in: messageIds } },
        select: { messageId: true, body: true }
      });

      const existingContentMap = new Map(existingContent.map(c => [c.messageId, c]));
      const contentDataToCreate = [];
      const contentDataToUpdate = [];

      for (const content of contentData) {
        const existing = existingContentMap.get(content.messageId);
        if (!existing) {
          contentDataToCreate.push(content);
        } else {
          const existingIsEmpty = !existing.body || existing.body === "" || existing.body === "Error parsing email content." || existing.body === "[object Uint8Array]";
          const newHasBody = content.body && content.body !== "" && content.body !== "Error parsing email content.";
          if (existingIsEmpty && newHasBody) {
            contentDataToUpdate.push(content);
          }
        }
      }

      // 4. Build transaction operations
      const operations: any[] = [];

      // Create new content
      if (contentDataToCreate.length > 0) {
        operations.push(prisma.emailContent.createMany({
          data: contentDataToCreate,
          skipDuplicates: true
        }));
      }

      // Update/Repair existing content
      for (const content of contentDataToUpdate) {
        operations.push(prisma.emailContent.update({
          where: { messageId: content.messageId },
          data: {
            body: content.body,
            htmlBody: content.htmlBody,
            attachments: content.attachments as any,
            updatedAt: new Date()
          }
        }));
      }

      // Upsert Emails - we use separate upserts if we want to support repair of existing Email table rows
      // or createMany with skipDuplicates for speed. 
      // For synchromization, we usually want createMany skipDuplicates: true for new emails.
      operations.push(prisma.email.createMany({
        data: emailData,
        skipDuplicates: true
      }));

      // 5. Execute transaction
      await prisma.$transaction(operations);

      return { inserted: emails.length, skipped: 0 };
    } catch (err) {
      console.error('Bulk create failed, falling back to sequential:', err);
      // Fallback to sequential on error
      let inserted = 0;
      let skipped = 0;
      for (const email of emails) {
        try {
          await this.createEmail(email);
          inserted++;
        } catch (e) {
          skipped++;
        }
      }
      return { inserted, skipped };
    }
  }

  async findContentByMessageId(messageId: string): Promise<EmailContent | null> {
    const row = await prisma.emailContent.findUnique({
      where: { messageId }
    });
    if (!row) return null;
    return {
      messageId: row.messageId,
      body: row.body,
      htmlBody: row.htmlBody || undefined,
      attachments: (row.attachments as any) || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  async findEmailByImapUid(accountId: string, folder: string, uid: number): Promise<Email | null> {
    const row = await prisma.email.findFirst({
      where: {
        accountId,
        folder,
        uid
      },
      include: {
        content: true
      }
    });
    if (!row) return null;
    return this.mapRowToEmail(row);
  }

  async findEmailByProviderId(accountId: string, providerId: string): Promise<Email | null> {
    const row = await prisma.email.findFirst({
      where: {
        accountId,
        providerId
      },
      include: {
        content: true
      }
    });
    if (!row) return null;
    return this.mapRowToEmail(row);
  }

  async findEmailByMessageId(messageId: string, accountId?: string): Promise<Email | null> {
    const row = await prisma.email.findFirst({
      where: {
        messageId,
        ...(accountId ? { accountId } : {})
      },
      include: {
        content: true
      }
    });

    if (!row) return null;
    return this.mapRowToEmail(row);
  }

  /**
   * Batch lookup: Find all existing emails by messageIds for a specific account
   * Returns a Map<messageId, Email> for O(1) lookups
   */
  async findEmailsByMessageIds(messageIds: string[], accountId: string): Promise<Map<string, Email>> {
    if (messageIds.length === 0) return new Map();

    const rows = await prisma.email.findMany({
      where: {
        accountId,
        messageId: { in: messageIds }
      },
      include: {
        content: true
      }
    });

    const result = new Map<string, Email>();
    for (const row of rows) {
      result.set(row.messageId, this.mapRowToEmail(row));
    }
    return result;
  }

  /**
   * Batch lookup: Find existing UIDs for IMAP emails
   * Returns a Set of "folder:uid" composite keys for quick lookups
   */
  async findExistingImapUids(accountId: string, folderUidPairs: { folder: string; uid: number }[]): Promise<Set<string>> {
    if (folderUidPairs.length === 0) return new Set();

    // Group by folder for efficient querying
    const folderGroups = new Map<string, number[]>();
    for (const { folder, uid } of folderUidPairs) {
      if (!folderGroups.has(folder)) {
        folderGroups.set(folder, []);
      }
      folderGroups.get(folder)!.push(uid);
    }

    const result = new Set<string>();

    // Query each folder's UIDs
    for (const [folder, uids] of folderGroups) {
      const rows = await prisma.email.findMany({
        where: {
          accountId,
          folder,
          uid: { in: uids }
        },
        select: { folder: true, uid: true }
      });

      for (const row of rows) {
        if (row.folder && row.uid) {
          result.add(`${row.folder}:${row.uid}`);
        }
      }
    }

    return result;
  }

  /**
   * Batch lookup: Find existing content by messageIds
   * Returns a Map<messageId, EmailContent> for reusing existing content
   */
  async findExistingContentByMessageIds(messageIds: string[]): Promise<Map<string, EmailContent>> {
    if (messageIds.length === 0) return new Map();

    const rows = await prisma.emailContent.findMany({
      where: {
        messageId: { in: messageIds }
      }
    });

    const result = new Map<string, EmailContent>();
    for (const row of rows) {
      result.set(row.messageId, {
        messageId: row.messageId,
        body: row.body,
        htmlBody: row.htmlBody || undefined,
        attachments: (row.attachments as any) || undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      });
    }
    return result;
  }

  async getEmailAccountById(id: string): Promise<EmailAccount | null> {
    // Check cache
    const cached = this.accountCache.get(id);
    if (cached && Date.now() < cached.expires) {
      return cached.data;
    }

    const row = await prisma.emailAccount.findUnique({
      where: { id }
    });

    if (!row) return null;

    const account: EmailAccount = {
      id: row.id,
      userId: row.userId.toString(),
      email: row.email,
      provider: row.provider as any,
      accessToken: row.accessToken || undefined,
      refreshToken: row.refreshToken || undefined,
      imapConfig: row.imapConfig ? JSON.parse(row.imapConfig as string) : undefined,
      smtpConfig: row.smtpConfig ? JSON.parse(row.smtpConfig as string) : undefined,
      isActive: row.isActive,
      lastSyncAt: row.lastSyncAt || undefined,
      lastHistoryId: row.lastHistoryId || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    // Set cache
    this.accountCache.set(id, {
      data: account,
      expires: Date.now() + this.CACHE_TTL
    });

    return account;
  }

  async getEmailAccountByUserId(userId: string): Promise<EmailAccount | null> {
    const row = await prisma.emailAccount.findFirst({
      where: {
        userId: parseInt(userId),
        isActive: true
      }
    });

    if (!row) return null;

    return {
      id: row.id,
      userId: row.userId.toString(),
      email: row.email,
      provider: row.provider as any,
      accessToken: row.accessToken || undefined,
      refreshToken: row.refreshToken || undefined,
      imapConfig: row.imapConfig ? JSON.parse(row.imapConfig as string) : undefined,
      smtpConfig: row.smtpConfig ? JSON.parse(row.smtpConfig as string) : undefined,
      isActive: row.isActive,
      lastSyncAt: row.lastSyncAt || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async getEmailAccountByEmail(email: string): Promise<EmailAccount | null> {
    const row = await prisma.emailAccount.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive'
        },
        isActive: true
      }
    });

    if (!row) return null;

    return {
      id: row.id,
      userId: row.userId.toString(),
      email: row.email,
      provider: row.provider as any,
      accessToken: row.accessToken || undefined,
      refreshToken: row.refreshToken || undefined,
      imapConfig: row.imapConfig ? JSON.parse(row.imapConfig as string) : undefined,
      smtpConfig: row.smtpConfig ? JSON.parse(row.smtpConfig as string) : undefined,
      isActive: row.isActive,
      lastSyncAt: row.lastSyncAt || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async createEmailAccount(account: EmailAccount): Promise<EmailAccount> {
    await prisma.emailAccount.create({
      data: {
        id: account.id,
        userId: parseInt(account.userId),
        email: account.email,
        provider: account.provider,
        accessToken: account.accessToken || null,
        refreshToken: account.refreshToken || null,
        imapConfig: account.imapConfig ? JSON.stringify(account.imapConfig) : null,
        smtpConfig: account.smtpConfig ? JSON.stringify(account.smtpConfig) : null,
        isActive: account.isActive,
        lastSyncAt: account.lastSyncAt || null,
        lastHistoryId: account.lastHistoryId || null,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt
      }
    });

    return account;
  }

  async updateEmailAccount(
    accountId: string,
    updates: Partial<EmailAccount>
  ): Promise<void> {
    const data: any = {};

    if (updates.accessToken !== undefined) data.accessToken = updates.accessToken;
    if (updates.refreshToken !== undefined) data.refreshToken = updates.refreshToken;
    if (updates.imapConfig !== undefined) data.imapConfig = JSON.stringify(updates.imapConfig);
    if (updates.smtpConfig !== undefined) data.smtpConfig = JSON.stringify(updates.smtpConfig);
    if (updates.isActive !== undefined) data.isActive = updates.isActive;
    if (updates.lastSyncAt !== undefined) data.lastSyncAt = updates.lastSyncAt;
    if (updates.lastHistoryId !== undefined) data.lastHistoryId = updates.lastHistoryId;

    // Invalidate cache
    this.accountCache.delete(accountId);

    if (Object.keys(data).length === 0) return;

    await prisma.emailAccount.update({
      where: { id: accountId },
      data
    });
  }

  async getAllActiveAccounts(): Promise<EmailAccount[]> {
    const rows = await prisma.emailAccount.findMany({
      where: { isActive: true }
    });

    return rows.map((row: any) => ({
      id: row.id,
      userId: row.userId.toString(),
      email: row.email,
      provider: row.provider as any,
      accessToken: row.accessToken || undefined,
      refreshToken: row.refreshToken || undefined,
      imapConfig: row.imapConfig ? JSON.parse(row.imapConfig as string) : undefined,
      smtpConfig: row.smtpConfig ? JSON.parse(row.smtpConfig as string) : undefined,
      isActive: row.isActive,
      lastSyncAt: row.lastSyncAt || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async getEmailAccounts(userId: string): Promise<EmailAccount[]> {
    const rows = await prisma.emailAccount.findMany({
      where: {
        userId: parseInt(userId),
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return rows.map((row: any) => ({
      id: row.id,
      userId: row.userId.toString(),
      email: row.email,
      provider: row.provider as any,
      accessToken: row.accessToken || undefined,
      refreshToken: row.refreshToken || undefined,
      imapConfig: row.imapConfig ? JSON.parse(row.imapConfig as string) : undefined,
      smtpConfig: row.smtpConfig ? JSON.parse(row.smtpConfig as string) : undefined,
      isActive: row.isActive,
      lastSyncAt: row.lastSyncAt || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async findContactsByEmails(emails: string[]): Promise<Contact[]> {
    // Mock implementation
    return [];
  }

  async saveThreadSummary(threadId: string, summary: string): Promise<void> {
    await prisma.threadSummary.upsert({
      where: { threadId },
      create: {
        threadId,
        summary,
        lastSummarizedAt: new Date()
      },
      update: {
        summary,
        lastSummarizedAt: new Date()
      }
    });
  }

  async getThreadSummary(threadId: string): Promise<{ summary: string; lastSummarizedAt: Date } | null> {
    const row = await prisma.threadSummary.findUnique({
      where: { threadId }
    });
    if (!row) return null;
    return {
      summary: row.summary,
      lastSummarizedAt: row.lastSummarizedAt,
    };
  }

  async getThreadsNeedingSummary(): Promise<string[]> {
    const results = (await prisma.$queryRaw`
      SELECT DISTINCT "threadId" 
      FROM emails 
      WHERE "threadId" IS NOT NULL 
        AND "threadId" NOT IN (SELECT "threadId" FROM thread_summaries)
    `) as { threadId: string }[];
    return results.map((r: any) => r.threadId);
  }

  async findDealsByContactIds(contactIds: string[]): Promise<Deal[]> {
    // Mock implementation
    return [];
  }

  async getEmailsForContact(contactId: string): Promise<Email[]> {
    const rows = await prisma.email.findMany({
      where: {
        contactIds: {
          array_contains: contactId
        }
      },
      include: {
        content: true
      },
      orderBy: { sentAt: 'desc' }
    });
    return rows.map((row: any) => this.mapRowToEmail(row));
  }

  async getEmailsForDeal(dealId: string): Promise<Email[]> {
    const rows = await prisma.email.findMany({
      where: {
        dealIds: {
          array_contains: dealId
        }
      },
      include: {
        content: true
      },
      orderBy: { sentAt: 'desc' }
    });
    return rows.map((row: any) => this.mapRowToEmail(row));
  }

  async getEmailsByAddress(address: string): Promise<Email[]> {
    const rows = await prisma.email.findMany({
      where: {
        OR: [
          { from: address },
          {
            to: {
              array_contains: address
            }
          }
        ]
      },
      include: {
        content: true
      },
      orderBy: { sentAt: 'desc' }
    });
    return rows.map((row: any) => this.mapRowToEmail(row));
  }

  async getEmailsForThread(threadId: string): Promise<Email[]> {
    const rows = await prisma.email.findMany({
      where: { threadId },
      include: {
        content: true
      },
      orderBy: { sentAt: 'asc' }
    });
    return rows.map((row: any) => this.mapRowToEmail(row));
  }

  async getAllEmails(options: { limit?: number } = {}): Promise<{ emails: Email[]; total: number }> {
    const { limit = 1000 } = options;
    const rows = await prisma.email.findMany({
      take: limit,
      include: {
        content: true
      }
    });

    return { emails: rows.map((r: any) => this.mapRowToEmail(r)), total: rows.length };
  }

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
    const {
      limit = 50,
      offset = 0,
      folder = "inbox",
      search,
      unreadOnly = false,
      accountId,
    } = options;

    let rawWhere = `ea."userId" = ${parseInt(userId)}`;
    if (accountId) rawWhere += ` AND e."accountId" = '${accountId}'`;

    if (folder === "inbox") {
      rawWhere += ` AND (e."isIncoming" = true OR e."folder" = 'INBOX') AND (e."labelIds" IS NULL OR (NOT (e."labelIds"::text LIKE '%SPAM%') AND NOT (e."labelIds"::text LIKE '%JUNK%') AND NOT (e."labelIds"::text LIKE '%TRASH%') AND NOT (e."labelIds"::text LIKE '%ARCHIVE%')))`;
    } else if (folder === "sent") {
      rawWhere += ` AND (e."isIncoming" = false OR e."folder" = 'SENT') AND (e."labelIds" IS NULL OR (NOT (e."labelIds"::text LIKE '%DRAFT%') AND NOT (e."labelIds"::text LIKE '%TRASH%')))`;
    } else if (folder === "spam") {
      rawWhere += ` AND (e."labelIds"::text LIKE '%SPAM%' OR e."labelIds"::text LIKE '%JUNK%') AND NOT (e."labelIds"::text LIKE '%TRASH%')`;
    } else if (folder === "drafts" || folder === "drfts") {
      rawWhere += ` AND (e.folder = 'DRAFT' OR e."labelIds"::text LIKE '%DRAFT%') AND (e."labelIds" IS NULL OR NOT (e."labelIds"::text LIKE '%TRASH%'))`;

    } else if (folder === "trash") {
      rawWhere += ` AND e."labelIds"::text LIKE '%TRASH%'`;
    } else if (folder === "archive") {
      rawWhere += ` AND (e."labelIds"::text LIKE '%ARCHIVE%' OR e."labelIds"::text LIKE '%ALL_MAIL%') AND NOT (e."labelIds"::text LIKE '%TRASH%') AND NOT (e."labelIds"::text LIKE '%SPAM%')`;
    }

    if (unreadOnly) rawWhere += ` AND e."isRead" = false`;

    // Only join email_contents if we need to search in body
    const joinContent = search ? 'JOIN email_contents ec ON e."messageId" = ec."messageId"' : '';

    if (search) {
      // If search is active, we need to check matches in body too
      rawWhere += ` AND (e."subject" ILIKE '%${search}%' OR e."from_address" ILIKE '%${search}%' OR ec."body" ILIKE '%${search}%')`;
    }

    // Deduplicate across accounts for the same user if no specific accountId is provided
    // This handles cases where a user has multiple alias accounts for the same mailbox
    const distinctClause = accountId ? '' : 'DISTINCT ON (e."messageId")';
    const orderByClause = accountId ? 'ORDER BY e."sentAt" DESC' : 'ORDER BY e."messageId", e."sentAt" DESC';

    const totalResults = (await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as total FROM (
        SELECT ${distinctClause} e.id
        FROM emails e 
        JOIN email_accounts ea ON e."accountId" = ea."id"
        ${joinContent}
        WHERE ${rawWhere}
      ) as sub
    `)) as { total: bigint }[];
    const total = (totalResults && totalResults.length > 0 && totalResults[0]) ? Number(totalResults[0].total) : 0;

    // We use a subquery to support DISTINCT ON for deduplication while maintaining sentAt ordering
    const rows = (await prisma.$queryRawUnsafe(`
      SELECT * FROM (
        SELECT ${distinctClause} e.*, 
          (SELECT COUNT(*)::int FROM emails e2 WHERE e2."threadId" = e."threadId" AND e."threadId" IS NOT NULL) as "threadCount"
        FROM emails e 
        JOIN email_accounts ea ON e."accountId" = ea."id"
        ${joinContent}
        WHERE ${rawWhere}
        ${orderByClause}
      ) as sub
      ORDER BY sub."sentAt" DESC 
      LIMIT ${limit} OFFSET ${offset}
    `)) as any[];

    return { emails: rows.map(r => this.mapRowToEmail(r)), total };
  }

  async getEmailsPaginated(userId: string, options: {
    page?: number;
    limit?: number;
    folder?: string;
    accountId?: string;
    search?: string;
    unreadOnly?: boolean;
  }): Promise<{ emails: Email[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    const result = await this.getEmailsForUser(userId, {
      ...options,
      limit,
      offset
    });

    return {
      emails: result.emails,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit)
    };
  }

  async getEmailById(emailId: string, userId: string): Promise<Email | null> {
    const row = await prisma.email.findFirst({
      where: {
        id: emailId,
        account: {
          userId: parseInt(userId)
        }
      },
      include: {
        content: true,
        trackingEvents: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!row) return null;
    return this.mapRowToEmail(row);
  }

  async findEmailById(id: string): Promise<Email | null> {
    const row = await prisma.email.findUnique({
      where: { id },
      include: { content: true }
    });
    if (!row) return null;
    return this.mapRowToEmail(row);
  }

  async markEmailAsRead(emailId: string, userId: string, isRead: boolean): Promise<boolean> {
    try {
      const result = await prisma.email.updateMany({
        where: {
          id: emailId,
          account: {
            userId: parseInt(userId)
          }
        },
        data: {
          isRead,
          updatedAt: new Date()
        }
      });
      return result.count > 0;
    } catch (err) {
      console.error(`Failed to mark email ${emailId} as read:`, err);
      return false;
    }
  }

  async archiveEmail(emailId: string, userId: string): Promise<boolean> {
    const email = await this.getEmailById(emailId, userId);
    if (!email) return false;

    let labels = (email.labelIds as string[]) || [];
    if (!labels.includes('ARCHIVE')) {
      labels.push('ARCHIVE');
    }
    labels = labels.filter((l) => l !== 'INBOX' && l !== 'TRASH' && l !== 'SPAM' && l !== 'JUNK');

    try {
      const result = await prisma.email.updateMany({
        where: {
          id: emailId,
          account: {
            userId: parseInt(userId)
          }
        },
        data: {
          labelIds: labels as any,
          updatedAt: new Date()
        }
      });
      return result.count > 0;
    } catch (err) {
      console.error(`Failed to archive email ${emailId}:`, err);
      return false;
    }
  }

  async unarchiveEmail(emailId: string, userId: string): Promise<boolean> {
    const email = await this.getEmailById(emailId, userId);
    if (!email) return false;

    let labels = (email.labelIds as string[]) || [];
    labels = labels.filter((l) => l !== 'ARCHIVE');
    if (!labels.includes('INBOX')) {
      labels.push('INBOX');
    }

    try {
      const result = await prisma.email.updateMany({
        where: {
          id: emailId,
          account: {
            userId: parseInt(userId)
          }
        },
        data: {
          labelIds: labels as any,
          updatedAt: new Date()
        }
      });
      return result.count > 0;
    } catch (err) {
      console.error(`Failed to unarchive email ${emailId}:`, err);
      return false;
    }
  }

  async trashEmail(emailId: string, userId: string): Promise<boolean> {
    const email = await this.getEmailById(emailId, userId);
    if (!email) return false;

    let labels = (email.labelIds as string[]) || [];
    labels = labels.filter((l) => l !== 'INBOX' && l !== 'ARCHIVE' && l !== 'SPAM' && l !== 'JUNK');
    if (!labels.includes('TRASH')) {
      labels.push('TRASH');
    }

    try {
      const result = await prisma.email.updateMany({
        where: {
          id: emailId,
          account: {
            userId: parseInt(userId)
          }
        },
        data: {
          labelIds: labels as any,
          updatedAt: new Date()
        }
      });
      return result.count > 0;
    } catch (err) {
      console.error(`Failed to trash email ${emailId}:`, err);
      return false;
    }
  }

  async restoreFromTrash(emailId: string, userId: string): Promise<boolean> {
    const email = await this.getEmailById(emailId, userId);
    if (!email) return false;

    let labels = (email.labelIds as string[]) || [];
    labels = labels.filter((l) => l !== 'TRASH');

    // Determine target folder based on email properties
    let targetFolder = 'INBOX';
    if (labels.includes('SENT') || !email.isIncoming) {
      targetFolder = 'SENT';
      if (!labels.includes('SENT')) labels.push('SENT');
    } else if (labels.includes('DRAFT')) {
      targetFolder = 'DRAFT';
      // Draft label already preserved if present
    } else {
      if (!labels.includes('INBOX')) labels.push('INBOX');
    }

    try {
      const result = await prisma.email.updateMany({
        where: {
          id: emailId,
          account: {
            userId: parseInt(userId)
          }
        },
        data: {
          labelIds: labels as any,
          folder: targetFolder,
          updatedAt: new Date()
        }
      });
      return result.count > 0;
    } catch (err) {
      console.error(`Failed to restore email ${emailId}:`, err);
      return false;
    }
  }

  async deleteEmailPermanently(emailId: string, userId: string): Promise<boolean> {
    const email = await this.getEmailById(emailId, userId);
    if (!email) return false;

    await prisma.email.delete({
      where: { id: emailId }
    });

    const otherUsage = await prisma.email.count({
      where: { messageId: email.messageId }
    });

    if (otherUsage === 0) {
      await prisma.emailContent.delete({
        where: { messageId: email.messageId }
      });
    }

    return true;
  }

  async getTrashEmails(userId: string): Promise<Email[]> {
    const rows = await prisma.email.findMany({
      where: {
        account: {
          userId: parseInt(userId)
        },
        labelIds: {
          array_contains: 'TRASH'
        }
      },
      include: {
        content: true
      },
      orderBy: { receivedAt: 'desc' }
    });
    return rows.map((row: any) => this.mapRowToEmail(row));
  }

  async getTrashEmailsOlderThan(daysOld: number = 30): Promise<{ emailId: string; userId: string; accountId: string }[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const rows = await prisma.email.findMany({
      where: {
        labelIds: {
          array_contains: 'TRASH'
        },
        updatedAt: {
          lt: cutoffDate
        }
      },
      select: {
        id: true,
        accountId: true,
        account: {
          select: {
            userId: true
          }
        }
      }
    });

    return rows.map((row: any) => ({
      emailId: row.id,
      userId: row.account.userId.toString(),
      accountId: row.accountId
    }));
  }

  async purgeOldTrashEmails(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const emailsToPurge = await prisma.email.findMany({
      where: {
        labelIds: {
          array_contains: 'TRASH'
        },
        updatedAt: {
          lt: cutoffDate
        }
      },
      select: {
        id: true,
        messageId: true
      }
    });

    if (emailsToPurge.length === 0) return 0;

    const emailIds = emailsToPurge.map((e: any) => e.id);
    const messageIds = Array.from(new Set(emailsToPurge.map((e: any) => e.messageId)));

    await prisma.email.deleteMany({
      where: {
        id: { in: emailIds }
      }
    });

    // Only delete content if no other emails use it
    for (const msgId of messageIds) {
      const usage = await prisma.email.count({ where: { messageId: msgId } });
      if (usage === 0) {
        await prisma.emailContent.delete({ where: { messageId: msgId } });
      }
    }

    return emailIds.length;
  }

  async updateEmail(emailId: string, updates: Partial<Email>): Promise<boolean> {
    const data: any = {};
    if (updates.isRead !== undefined) data.isRead = updates.isRead;
    if (updates.contactIds !== undefined) data.contactIds = updates.contactIds as any;
    if (updates.dealIds !== undefined) data.dealIds = updates.dealIds as any;
    if (updates.accountEntityIds !== undefined) data.accountEntityIds = updates.accountEntityIds as any;
    if (updates.labelIds !== undefined) data.labelIds = updates.labelIds as any;
    if (updates.folder !== undefined) data.folder = updates.folder;
    if (updates.uid !== undefined) data.uid = updates.uid;
    if (updates.providerId !== undefined) data.providerId = updates.providerId;
    if (updates.sentAt !== undefined) data.sentAt = updates.sentAt;
    if (updates.updatedAt !== undefined) data.updatedAt = updates.updatedAt;
    else data.updatedAt = new Date();

    if (updates.body !== undefined) data.body = updates.body;
    if (updates.htmlBody !== undefined) data.htmlBody = updates.htmlBody;
    if (updates.attachments !== undefined) data.attachments = updates.attachments as any;

    if (Object.keys(data).length === 0) return false;

    try {
      // 1. Update the email record itself
      const updatedEmail = await prisma.email.update({
        where: { id: emailId },
        data
      });

      // 2. Also update the associated EmailContent if body/htmlBody/attachments provided
      if (updates.body || updates.htmlBody || updates.attachments) {
        await prisma.emailContent.update({
          where: { messageId: updatedEmail.messageId },
          data: {
            ...(updates.body ? { body: updates.body } : {}),
            ...(updates.htmlBody ? { htmlBody: updates.htmlBody } : {}),
            ...(updates.attachments ? { attachments: updates.attachments as any } : {}),
            updatedAt: new Date()
          }
        });
      }
      return true;
    } catch (err) {
      console.error(`Failed to update email ${emailId}:`, err);
      return false;
    }
  }

  /**
   * Batch update multiple emails efficiently
   * Uses a transaction for atomicity
   */
  async batchUpdateEmails(updates: { id: string; updates: Partial<Email> }[]): Promise<number> {
    if (updates.length === 0) return 0;

    let successCount = 0;
    const now = new Date();

    // Process in batches of 50 to avoid overwhelming the database
    const BATCH_SIZE = 50;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);

      const operations = batch.flatMap(({ id, updates: upd }) => {
        const data: any = { updatedAt: now };
        if (upd.isRead !== undefined) data.isRead = upd.isRead;
        if (upd.labelIds !== undefined) data.labelIds = upd.labelIds as any;
        if (upd.folder !== undefined) data.folder = upd.folder;
        if (upd.uid !== undefined) data.uid = upd.uid;
        if (upd.providerId !== undefined) data.providerId = upd.providerId;
        if (upd.sentAt !== undefined) data.sentAt = upd.sentAt;
        if (upd.body !== undefined) data.body = upd.body;
        if (upd.htmlBody !== undefined) data.htmlBody = upd.htmlBody;
        if (upd.attachments !== undefined) data.attachments = upd.attachments as any;

        const ops = [];
        ops.push(prisma.email.update({
          where: { id },
          data
        }));

        // If messageId is available and we are updating content fields, update EmailContent too
        const messageId = (upd as any).messageId;
        if (messageId && (upd.body || upd.htmlBody || upd.attachments)) {
          ops.push(prisma.emailContent.update({
            where: { messageId },
            data: {
              ...(upd.body ? { body: upd.body } : {}),
              ...(upd.htmlBody ? { htmlBody: upd.htmlBody } : {}),
              ...(upd.attachments ? { attachments: upd.attachments as any } : {}),
              updatedAt: now
            }
          }));
        }

        return ops;
      });

      try {
        await prisma.$transaction(operations);
        successCount += batch.length;
      } catch (err) {
        // Fallback to individual updates on transaction failure
        for (const { id, updates: upd } of batch) {
          try {
            await this.updateEmail(id, upd);
            successCount++;
          } catch (e) {
            // Skip failed updates
          }
        }
      }
    }

    return successCount;
  }


  async getLastSyncedUid(accountId: string, folder: string): Promise<number | null> {
    const row = await prisma.emailSyncState.findUnique({
      where: {
        accountId_folder: {
          accountId,
          folder
        }
      }
    });
    return row?.lastSyncedUid || null;
  }

  async updateLastSyncedUid(accountId: string, folder: string, uid: number): Promise<void> {
    await prisma.emailSyncState.upsert({
      where: {
        accountId_folder: {
          accountId,
          folder
        }
      },
      create: {
        accountId,
        folder,
        lastSyncedUid: uid,
        updatedAt: new Date()
      },
      update: {
        lastSyncedUid: uid,
        updatedAt: new Date()
      }
    });
  }

  async getUnreadUids(accountId: string, folder: string): Promise<number[]> {
    const rows = await prisma.email.findMany({
      where: {
        accountId,
        folder,
        isRead: false,
        uid: { not: null }
      },
      select: { uid: true }
    });
    return rows.map((r: any) => r.uid as number);
  }

  async getRecentUids(accountId: string, folder: string, limit: number = 50): Promise<number[]> {
    const rows = await prisma.email.findMany({
      where: {
        accountId,
        folder,
        uid: { not: null }
      },
      orderBy: { sentAt: 'desc' },
      take: limit,
      select: { uid: true }
    });
    return rows.map((r: any) => r.uid as number);
  }


  async getRecentIncomingEmails(userId: string, limit: number = 5): Promise<Email[]> {
    const rows = await prisma.email.findMany({
      where: {
        account: { userId: parseInt(userId) },
        isIncoming: true,
        isRead: false
      },
      include: { content: true },
      orderBy: { sentAt: 'desc' },
      take: limit
    });
    return rows.map((row: any) => this.mapRowToEmail(row));
  }

  async getAllFolderEmails(accountId: string, folder: string): Promise<{ uid: number }[]> {
    const rows = await prisma.email.findMany({
      where: { accountId, folder },
      select: { uid: true }
    });
    return rows.map((r: any) => ({ uid: r.uid || 0 }));
  }

  private mapRowToEmail(row: any): Email {
    const content = row.content || {};
    return {
      id: row.id,
      messageId: row.messageId,
      threadId: row.threadId || undefined,
      accountId: row.accountId,
      from: row.from || row.from_address || "",
      to: (row.to as any) || (row.to_addresses as any) || [],
      cc: (row.cc as any) || (row.cc_addresses as any) || undefined,
      bcc: (row.bcc as any) || (row.bcc_addresses as any) || undefined,
      subject: row.subject,
      snippet: row.snippet || undefined,
      body: (content.body && content.body !== "Error parsing email content.") ? content.body : (row.body || ""),
      htmlBody: content.htmlBody || row.htmlBody || undefined,
      attachments: (content.attachments as any) || (row.attachments as any) || [],
      isRead: row.isRead,
      isIncoming: row.isIncoming,
      sentAt: row.sentAt,
      receivedAt: row.receivedAt || undefined,
      contactIds: (row.contactIds as any) || [],
      dealIds: (row.dealIds as any) || [],
      accountEntityIds: (row.accountEntityIds as any) || [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      labelIds: (row.labelIds as any) || [],
      uid: row.uid || undefined,
      folder: row.folder || undefined,
      providerId: row.providerId || undefined,
      threadCount: row.threadCount ? Number(row.threadCount) : undefined,
      opens: row.opens || 0,
      clicks: row.clicks || 0,
      lastOpenedAt: row.lastOpenedAt || undefined,
      lastClickedAt: row.lastClickedAt || undefined,
      trackingEvents: row.trackingEvents || undefined,
    };
  }

  async logTrackingEvent(data: {
    emailId: string;
    type: 'open' | 'click';
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }): Promise<void> {
    await (prisma as any).emailTrackingEvent.create({
      data: {
        emailId: data.emailId,
        type: data.type,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata ? (data.metadata as any) : (Prisma as any).JsonNull,
      }
    });
  }

  async incrementOpens(emailId: string): Promise<void> {
    await (prisma as any).email.update({
      where: { id: emailId },
      data: {
        opens: { increment: 1 },
        lastOpenedAt: new Date()
      }
    });
  }

  async incrementClicks(emailId: string): Promise<void> {
    await (prisma as any).email.update({
      where: { id: emailId },
      data: {
        clicks: { increment: 1 },
        lastClickedAt: new Date()
      }
    });
  }
}
