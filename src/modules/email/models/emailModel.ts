import { Email, EmailAccount, EmailContent, Contact, Deal } from "./types";
import { prisma } from "../../../shared/prisma";
import { Prisma } from "@prisma/client";

export class EmailModel {
  constructor() { }

  initialize(): void { }

  async createEmail(email: Email): Promise<Email> {
    // 1. Save or update unique content
    await prisma.emailContent.upsert({
      where: { messageId: email.messageId },
      create: {
        messageId: email.messageId,
        body: email.body,
        htmlBody: email.htmlBody || null,
        attachments: (email.attachments as any) || [],
        createdAt: email.createdAt,
        updatedAt: email.updatedAt
      },
      update: {}
    });

    // 2. Save account-specific metadata
    const snippet = email.snippet || email.body.substring(0, 200).replace(/(\r\n|\n|\r)/gm, " ");

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
      body: email.body,
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
    let inserted = 0;
    let skipped = 0;

    for (const email of emails) {
      try {
        await this.createEmail(email);
        inserted++;
      } catch (err) {
        skipped++;
      }
    }
    return { inserted, skipped };
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

  async getEmailAccountById(id: string): Promise<EmailAccount | null> {
    const row = await prisma.emailAccount.findUnique({
      where: { id }
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
      lastHistoryId: row.lastHistoryId || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
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
    if (updates.updatedAt !== undefined) data.updatedAt = updates.updatedAt;

    if (Object.keys(data).length === 0) return false;

    try {
      await prisma.email.update({
        where: { id: emailId },
        data
      });
      return true;
    } catch (err) {
      return false;
    }
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
      body: content.body || row.body || "",
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
