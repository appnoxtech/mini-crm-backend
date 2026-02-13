import { Email, EmailAccount, EmailContent, Contact, Deal } from "./types";
import { prisma } from "../../../shared/prisma";
import { Prisma } from "@prisma/client";

export class EmailModel {
  private accountCache = new Map<string, { data: EmailAccount; expires: number }>();
  private readonly CACHE_TTL = 60 * 1000; // 1 minute cache

  constructor() { }

  initialize(): void { }

  async getCompanyIdForUser(userId: string): Promise<number | null> {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { companyId: true }
    });
    return user?.companyId || null;
  }

  async createEmail(email: Email): Promise<Email> {
    // ⚠️ CRITICAL: Validate companyId is present
    if (!email.companyId) {
      throw new Error(`Cannot create email ${email.messageId}: companyId is missing`);
    }

    // 1. Save or update unique content
    // Content is now scoped by companyId
    await prisma.emailContent.upsert({
      where: {
        messageId_companyId: {
          messageId: email.messageId,
          companyId: email.companyId
        }
      },
      create: {
        messageId: email.messageId,
        companyId: email.companyId,
        body: email.body || "",
        htmlBody: email.htmlBody || null,
        attachments: (email.attachments as any) || [],
        createdAt: email.createdAt,
        updatedAt: email.updatedAt
      },
      update: {
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
      companyId: email.companyId,
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
      // 1. Prepare unique content data (deduplicate by messageId AND companyId)
      const contentMap = new Map<string, any>();
      for (const email of emails) {
        const contentKey = `${email.messageId}:${email.companyId}`;
        const existing = contentMap.get(contentKey);
        const hasContent = (email.body && email.body.length > 0) || (email.htmlBody && email.htmlBody.length > 0);
        const existingHasContent = existing && ((existing.body && existing.body.length > 0) || (existing.htmlBody && existing.htmlBody.length > 0));

        if (!existing || (!existingHasContent && hasContent)) {
          contentMap.set(contentKey, {
            messageId: email.messageId,
            companyId: email.companyId,
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
          companyId: email.companyId,
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

      // Filter out any entries with missing companyId just in case
      const validContentData = contentData.filter(c => c.companyId !== undefined && c.companyId !== null);
      const validEmailData = emailData.filter(e => e.companyId !== undefined && e.companyId !== null);

      if (validContentData.length === 0 && validEmailData.length === 0) {
        console.warn('[EmailSync] No valid emails to insert - all emails missing companyId');
        return { inserted: 0, skipped: emails.length };
      }

      if (validEmailData.length < emailData.length) {
        console.warn(`[EmailSync] Filtered out ${emailData.length - validEmailData.length} emails with missing companyId`);
      }

      // 3. Find existing content records
      // We need to look up by (messageId, companyId) pairs
      const existingContent = await prisma.emailContent.findMany({
        where: {
          OR: validContentData.map(c => ({
            messageId: c.messageId,
            companyId: c.companyId
          }))
        },
        select: { messageId: true, companyId: true, body: true }
      });

      const existingContentMap = new Map(existingContent.map(c => [`${c.messageId}:${c.companyId}`, c]));
      const contentDataToCreate = [];
      const contentDataToUpdate = [];

      for (const content of validContentData) {
        const contentKey = `${content.messageId}:${content.companyId}`;
        const existing = existingContentMap.get(contentKey);
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

      if (contentDataToCreate.length > 0) {
        operations.push(prisma.emailContent.createMany({
          data: contentDataToCreate,
          skipDuplicates: true
        }));
      }

      for (const content of contentDataToUpdate) {
        operations.push(prisma.emailContent.update({
          where: {
            messageId_companyId: {
              messageId: content.messageId,
              companyId: content.companyId
            }
          },
          data: {
            body: content.body,
            htmlBody: content.htmlBody,
            attachments: content.attachments as any,
            updatedAt: new Date()
          }
        }));
      }

      operations.push(prisma.email.createMany({
        data: validEmailData,
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

  async findContentByMessageId(messageId: string, companyId: number): Promise<EmailContent | null> {
    const row = await prisma.emailContent.findUnique({
      where: {
        messageId_companyId: {
          messageId,
          companyId
        }
      }
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

  async findEmailByImapUid(accountId: string, companyId: number, folder: string, uid: number): Promise<Email | null> {
    const row = await prisma.email.findFirst({
      where: {
        accountId,
        companyId,
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

  async findEmailByProviderId(accountId: string, companyId: number, providerId: string): Promise<Email | null> {
    const row = await prisma.email.findFirst({
      where: {
        accountId,
        companyId,
        providerId
      },
      include: {
        content: true
      }
    });
    if (!row) return null;
    return this.mapRowToEmail(row);
  }

  async findEmailByMessageId(messageId: string, companyId: number, accountId?: string): Promise<Email | null> {
    const row = await prisma.email.findFirst({
      where: {
        messageId,
        companyId,
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
  async findEmailsByMessageIds(messageIds: string[], companyId: number, accountId: string): Promise<Map<string, Email>> {
    if (messageIds.length === 0) return new Map();

    const rows = await prisma.email.findMany({
      where: {
        accountId,
        companyId,
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
  async findExistingImapUids(accountId: string, companyId: number, folderUidPairs: { folder: string; uid: number }[]): Promise<Set<string>> {
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
          companyId,
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
  async findExistingContentByMessageIds(messageIds: string[], companyId: number): Promise<Map<string, EmailContent>> {
    if (messageIds.length === 0) return new Map();

    const rows = await prisma.emailContent.findMany({
      where: {
        messageId: { in: messageIds },
        companyId
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

  async getEmailAccountById(id: string, companyId: number): Promise<EmailAccount | null> {
    // Check cache
    const cached = this.accountCache.get(id);
    if (cached && Date.now() < cached.expires) {
      if (cached.data.companyId === companyId) {
        return cached.data;
      }
    }

    const row = await prisma.emailAccount.findFirst({
      where: {
        id,
        companyId
      }
    });

    if (!row) return null;

    const account = this.mapRowToAccount(row);

    // Set cache
    this.accountCache.set(id, {
      data: account,
      expires: Date.now() + this.CACHE_TTL
    });

    return account;
  }

  async getEmailAccountByUserId(userId: string, companyId: number): Promise<EmailAccount | null> {
    const row = await prisma.emailAccount.findFirst({
      where: {
        userId: parseInt(userId),
        isActive: true,
        companyId
      },
    });

    if (!row) return null;

    return this.mapRowToAccount(row);
  }

  async getEmailAccountByEmail(email: string, companyId: number): Promise<EmailAccount | null> {
    const row = await prisma.emailAccount.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive'
        },
        isActive: true,
        companyId
      },
    });

    if (!row) return null;

    return this.mapRowToAccount(row);
  }

  async createEmailAccount(account: EmailAccount): Promise<EmailAccount> {
    await prisma.emailAccount.create({
      data: {
        id: account.id,
        userId: parseInt(account.userId),
        companyId: account.companyId,
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
    companyId: number,
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

    await prisma.emailAccount.updateMany({
      where: { id: accountId, companyId },
      data
    });
  }

  async getAllActiveAccounts(companyId: number): Promise<EmailAccount[]> {
    const rows = await prisma.emailAccount.findMany({
      where: {
        isActive: true,
        companyId
      },
      orderBy: { createdAt: 'desc' }
    });

    return rows.map((row) => this.mapRowToAccount(row));
  }

  /**
   * Get ALL active accounts across all companies.
   * Used only for background sync scheduling (e.g., queue service).
   */
  async getAllActiveAccountsGlobal(): Promise<EmailAccount[]> {
    const rows = await prisma.emailAccount.findMany({
      where: {
        isActive: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    return rows.map((row) => this.mapRowToAccount(row));
  }

  async getEmailAccounts(userId: string, companyId: number): Promise<EmailAccount[]> {
    const rows = await prisma.emailAccount.findMany({
      where: {
        userId: parseInt(userId),
        companyId
      },
      orderBy: { createdAt: 'desc' }
    });

    return rows.map((row) => this.mapRowToAccount(row));
  }

  async findContactsByEmails(emails: string[]): Promise<Contact[]> {
    // Mock implementation
    return [];
  }

  async saveThreadSummary(threadId: string, companyId: number, summary: string): Promise<void> {
    await prisma.threadSummary.upsert({
      where: { threadId },
      create: {
        threadId,
        companyId,
        summary,
        lastSummarizedAt: new Date()
      },
      update: {
        summary,
        lastSummarizedAt: new Date()
      }
    });
  }

  async getThreadSummary(threadId: string, companyId: number): Promise<{ summary: string; lastSummarizedAt: Date } | null> {
    const row = await prisma.threadSummary.findFirst({
      where: { threadId, companyId }
    });
    if (!row) return null;
    return {
      summary: row.summary,
      lastSummarizedAt: row.lastSummarizedAt,
    };
  }

  async getThreadsNeedingSummary(companyId: number): Promise<string[]> {
    const results = (await prisma.$queryRaw`
      SELECT DISTINCT "threadId" 
      FROM emails 
      WHERE "threadId" IS NOT NULL 
        AND "companyId" = ${companyId}
        AND "threadId" NOT IN (SELECT "threadId" FROM thread_summaries WHERE "companyId" = ${companyId})
    `) as { threadId: string }[];
    return results.map((r: any) => r.threadId);
  }

  async getThreadsNeedingSummaryGlobal(limit: number = 50): Promise<{ threadId: string; companyId: number }[]> {
    const results = (await prisma.$queryRaw`
      SELECT DISTINCT e."threadId", e."companyId"
      FROM emails e
      WHERE e."threadId" IS NOT NULL
        AND e."threadId" NOT IN (SELECT ts."thread_id" FROM thread_summaries ts)
      LIMIT ${limit}
    `) as { threadId: string; companyId: number }[];
    return results;
  }

  async findDealsByContactIds(contactIds: string[]): Promise<Deal[]> {
    // Mock implementation
    return [];
  }

  async getEmailsForContact(contactId: string, companyId: number): Promise<Email[]> {
    const rows = await prisma.email.findMany({
      where: {
        companyId,
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

  async getEmailsForDeal(dealId: string, companyId: number): Promise<Email[]> {
    const rows = await prisma.email.findMany({
      where: {
        companyId,
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

  async getEmailsByAddress(address: string, companyId: number): Promise<Email[]> {
    const rows = await prisma.email.findMany({
      where: {
        companyId,
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

  async getEmailsForThread(threadId: string, companyId: number): Promise<Email[]> {
    const rows = await prisma.email.findMany({
      where: { threadId, companyId },
      include: {
        content: true
      },
      orderBy: { sentAt: 'asc' }
    });
    return rows.map((row: any) => this.mapRowToEmail(row));
  }

  async getAllEmails(companyId: number, options: { limit?: number } = {}): Promise<{ emails: Email[]; total: number }> {
    const { limit = 1000 } = options;
    const rows = await prisma.email.findMany({
      where: { companyId },
      take: limit,
      include: {
        content: true
      }
    });

    return { emails: rows.map((r: any) => this.mapRowToEmail(r)), total: rows.length };
  }

  async getEmailsForUser(
    userId: string,
    companyId: number,
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

    let rawWhere = `ea."userId" = ${parseInt(userId)} AND e."companyId" = ${companyId}`;
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

    // JOIN email_contents with companyId scope
    const joinContent = search ? 'JOIN email_contents ec ON e."messageId" = ec."messageId" AND e."companyId" = ec."companyId"' : '';

    if (search) {
      rawWhere += ` AND (e."subject" ILIKE '%${search}%' OR e."from_address" ILIKE '%${search}%' OR ec."body" ILIKE '%${search}%')`;
    }

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

    const rows = (await prisma.$queryRawUnsafe(`
      SELECT * FROM (
        SELECT ${distinctClause} e.*, 
          (SELECT COUNT(*)::int FROM emails e2 WHERE e2."threadId" = e."threadId" AND e."threadId" IS NOT NULL AND e2."companyId" = e."companyId") as "threadCount"
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

  async getEmailsPaginated(userId: string, companyId: number, options: {
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

    const result = await this.getEmailsForUser(userId, companyId, {
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

  async getEmailById(emailId: string, userId: string, companyId: number): Promise<Email | null> {
    const row = await prisma.email.findFirst({
      where: {
        id: emailId,
        companyId,
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

  async findEmailById(id: string, companyId: number): Promise<Email | null> {
    const row = await prisma.email.findFirst({
      where: { id, companyId },
      include: { content: true }
    });
    if (!row) return null;
    return this.mapRowToEmail(row);
  }

  /**
   * Find email by ID without company scoping.
   * Used ONLY for public tracking endpoints (pixel/click) where no auth context exists.
   */
  async findEmailByIdGlobal(id: string): Promise<Email | null> {
    const row = await prisma.email.findFirst({
      where: { id },
      include: { content: true }
    });
    if (!row) return null;
    return this.mapRowToEmail(row);
  }

  async markEmailAsRead(emailId: string, userId: string, companyId: number, isRead: boolean): Promise<boolean> {
    try {
      const result = await prisma.email.updateMany({
        where: {
          id: emailId,
          companyId,
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

  async archiveEmail(emailId: string, userId: string, companyId: number): Promise<boolean> {
    const email = await this.getEmailById(emailId, userId, companyId);
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
          companyId,
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

  async unarchiveEmail(emailId: string, userId: string, companyId: number): Promise<boolean> {
    const email = await this.getEmailById(emailId, userId, companyId);
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
          companyId,
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

  async trashEmail(emailId: string, userId: string, companyId: number): Promise<boolean> {
    const email = await this.getEmailById(emailId, userId, companyId);
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
          companyId,
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

  async restoreFromTrash(emailId: string, userId: string, companyId: number): Promise<boolean> {
    const email = await this.getEmailById(emailId, userId, companyId);
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
          companyId,
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

  async deleteEmailPermanently(emailId: string, userId: string, companyId: number): Promise<boolean> {
    const email = await this.getEmailById(emailId, userId, companyId);
    if (!email) return false;

    await prisma.email.deleteMany({
      where: { id: emailId, companyId }
    });

    const otherUsage = await prisma.email.count({
      where: { messageId: email.messageId, companyId }
    });

    if (otherUsage === 0) {
      await prisma.emailContent.deleteMany({
        where: { messageId: email.messageId, companyId }
      });
    }

    return true;
  }

  async getTrashEmails(userId: string, companyId: number): Promise<Email[]> {
    const rows = await prisma.email.findMany({
      where: {
        companyId,
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

  async getTrashEmailsOlderThan(daysOld: number = 30, companyId?: number): Promise<{ emailId: string; userId: string; accountId: string; companyId: number }[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const rows = await prisma.email.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        labelIds: {
          array_contains: 'TRASH'
        },
        updatedAt: {
          lt: cutoffDate
        }
      },
      select: {
        id: true,
        companyId: true,
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
      accountId: row.accountId,
      companyId: row.companyId
    }));
  }

  async purgeOldTrashEmails(daysOld: number = 30, companyId?: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const emailsToPurge = await prisma.email.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
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
        id: { in: emailIds },
        ...(companyId ? { companyId } : {})
      }
    });

    // Only delete content if no other emails use it
    for (const msgId of messageIds) {
      const usage = await prisma.email.count({ where: { messageId: msgId, ...(companyId ? { companyId } : {}) } });
      if (usage === 0) {
        await prisma.emailContent.deleteMany({ where: { messageId: msgId, ...(companyId ? { companyId } : {}) } });
      }
    }

    return emailIds.length;
  }

  async updateEmail(emailId: string, companyId: number, updates: Partial<Email>): Promise<boolean> {
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
      const updateResult = await prisma.email.updateMany({
        where: { id: emailId, companyId },
        data
      });

      if (updateResult.count === 0) return false;

      // 2. Also update the associated EmailContent if body/htmlBody/attachments provided
      const messageId = updates.messageId || (await prisma.email.findUnique({ where: { id: emailId }, select: { messageId: true } }))?.messageId;

      if (messageId && (updates.body || updates.htmlBody || updates.attachments)) {
        await prisma.emailContent.updateMany({
          where: { messageId, companyId },
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
  async batchUpdateEmails(updates: { id: string; companyId: number; updates: Partial<Email> }[]): Promise<number> {
    if (updates.length === 0) return 0;

    let successCount = 0;
    const now = new Date();

    // Process in batches of 50 to avoid overwhelming the database
    const BATCH_SIZE = 50;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);

      const operations = batch.flatMap(({ id, companyId, updates: upd }) => {
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
        ops.push(prisma.email.updateMany({
          where: { id, companyId },
          data
        }));

        // If content fields are being updated, we need the messageId to update EmailContent
        const messageId = upd.messageId;
        if (messageId && (upd.body || upd.htmlBody || upd.attachments)) {
          ops.push(prisma.emailContent.updateMany({
            where: { messageId, companyId },
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
        for (const { id, companyId, updates: upd } of batch) {
          try {
            await this.updateEmail(id, companyId, upd);
            successCount++;
          } catch (e) {
            // Skip failed updates
          }
        }
      }
    }

    return successCount;
  }


  async getLastSyncedUid(accountId: string, companyId: number, folder: string): Promise<number | null> {
    const row = await prisma.emailSyncState.findFirst({
      where: {
        accountId,
        companyId,
        folder
      }
    });
    return row?.lastSyncedUid || null;
  }

  async updateLastSyncedUid(accountId: string, companyId: number, folder: string, uid: number): Promise<void> {
    await prisma.emailSyncState.upsert({
      where: {
        accountId_folder_companyId: {
          accountId,
          folder,
          companyId
        }
      },
      create: {
        accountId,
        companyId,
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

  async getUnreadUids(accountId: string, companyId: number, folder: string): Promise<number[]> {
    const rows = await prisma.email.findMany({
      where: {
        accountId,
        companyId,
        folder,
        isRead: false,
        uid: { not: null }
      },
      select: { uid: true }
    });
    return rows.map((r: any) => r.uid as number);
  }

  async getRecentUids(accountId: string, companyId: number, folder: string, limit: number = 50): Promise<number[]> {
    const rows = await prisma.email.findMany({
      where: {
        accountId,
        companyId,
        folder,
        uid: { not: null }
      },
      orderBy: { sentAt: 'desc' },
      take: limit,
      select: { uid: true }
    });
    return rows.map((r: any) => r.uid as number);
  }


  async getRecentIncomingEmails(userId: string, companyId: number, limit: number = 5): Promise<Email[]> {
    const rows = await prisma.email.findMany({
      where: {
        companyId,
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

  async getAllFolderEmails(accountId: string, companyId: number, folder: string): Promise<{ uid: number }[]> {
    const rows = await prisma.email.findMany({
      where: { accountId, companyId, folder },
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
      companyId: row.companyId,
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
    companyId: number;
    type: 'open' | 'click';
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }): Promise<void> {
    await (prisma as any).emailTrackingEvent.create({
      data: {
        emailId: data.emailId,
        companyId: data.companyId,
        type: data.type,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata ? (data.metadata as any) : (Prisma as any).JsonNull,
      }
    });
  }

  async incrementOpens(emailId: string, companyId: number): Promise<void> {
    await (prisma as any).email.updateMany({
      where: { id: emailId, companyId },
      data: {
        opens: { increment: 1 },
        lastOpenedAt: new Date()
      }
    });
  }

  async incrementClicks(emailId: string, companyId: number): Promise<void> {
    await (prisma as any).email.updateMany({
      where: { id: emailId, companyId },
      data: {
        clicks: { increment: 1 },
        lastClickedAt: new Date()
      }
    });
  }

  private mapRowToAccount(row: any): EmailAccount {
    return {
      id: row.id,
      userId: row.userId.toString(),
      companyId: row.companyId,
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
  }
}
