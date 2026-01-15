import Database from "better-sqlite3";
import { Email, EmailAccount, Contact, Deal } from "./types";

export class EmailModel {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  initialize(): void {
    // Create email_accounts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS email_accounts (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        email TEXT NOT NULL,
        provider TEXT NOT NULL,
        accessToken TEXT,
        refreshToken TEXT,
        imapConfig TEXT,
        smtpConfig TEXT,
        isActive BOOLEAN DEFAULT 1,
        lastSyncAt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // Create emails table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS emails (
        id TEXT PRIMARY KEY,
        messageId TEXT UNIQUE NOT NULL,
        threadId TEXT,
        accountId TEXT NOT NULL,
        from_address TEXT NOT NULL,
        to_addresses TEXT NOT NULL,
        cc_addresses TEXT,
        bcc_addresses TEXT,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        htmlBody TEXT,
        isRead BOOLEAN DEFAULT 0,
        isIncoming BOOLEAN DEFAULT 1,
        sentAt TEXT NOT NULL,
        receivedAt TEXT,
        contactIds TEXT,
        dealIds TEXT,
        accountEntityIds TEXT,
        trackingPixelId TEXT,
        opens INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        labelIds TEXT,
        FOREIGN KEY (accountId) REFERENCES email_accounts(id)
      )
    `);
    // Create thread_summaries table
    this.db.exec(`
        CREATE TABLE IF NOT EXISTS thread_summaries (
        threadId TEXT PRIMARY KEY,
        summary TEXT NOT NULL,
        lastSummarizedAt TEXT NOT NULL
        )
      `);

    // Create indexes
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_emails_accountId ON emails(accountId)"
    );
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_emails_messageId ON emails(messageId)"
    );
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_emails_sentAt ON emails(sentAt)"
    );
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_email_accounts_userId ON email_accounts(userId)"
    );

    // Add labelIds column if it doesn't exist (for existing databases)
    try {
      this.db.exec("ALTER TABLE emails ADD COLUMN labelIds TEXT");
      console.log("Added labelIds column to emails table");
    } catch (error) {
      // Column already exists, ignore error
    }
  }

  async createEmail(email: Email): Promise<Email> {
    const stmt = this.db.prepare(`
      INSERT INTO emails (
        id, messageId, threadId, accountId, from_address, to_addresses, cc_addresses, bcc_addresses,
        subject, body, htmlBody, isRead, isIncoming, sentAt, receivedAt, contactIds, dealIds,
        accountEntityIds, trackingPixelId, opens, clicks, createdAt, updatedAt, labelIds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      email.id,
      email.messageId,
      email.threadId || null,
      email.accountId,
      email.from,
      JSON.stringify(email.to),
      email.cc ? JSON.stringify(email.cc) : null,
      email.bcc ? JSON.stringify(email.bcc) : null,
      email.subject,
      email.body,
      email.htmlBody || null,
      email.isRead ? 1 : 0,
      email.isIncoming ? 1 : 0,
      email.sentAt.toISOString(),
      email.receivedAt?.toISOString() || null,
      JSON.stringify(email.contactIds),
      JSON.stringify(email.dealIds),
      JSON.stringify(email.accountEntityIds),
      email.trackingPixelId || null,
      email.opens,
      email.clicks,
      email.createdAt.toISOString(),
      email.updatedAt.toISOString(),
      email.labelIds ? JSON.stringify(email.labelIds) : null
    );

    return email;
  }

  async findEmailByMessageId(messageId: string): Promise<Email | null> {
    const stmt = this.db.prepare("SELECT * FROM emails WHERE messageId = ?");
    const row = stmt.get(messageId) as any;

    if (!row) return null;

    const email: Email = {
      id: row.id,
      messageId: row.messageId,
      threadId: row.threadId,
      accountId: row.accountId,
      from: row.from_address,
      to: JSON.parse(row.to_addresses),
      cc: row.cc_addresses ? JSON.parse(row.cc_addresses) : undefined,
      bcc: row.bcc_addresses ? JSON.parse(row.bcc_addresses) : undefined,
      subject: row.subject,
      body: row.body,
      htmlBody: row.htmlBody || undefined,
      isRead: Boolean(row.isRead),
      isIncoming: Boolean(row.isIncoming),
      sentAt: new Date(row.sentAt),
      contactIds: JSON.parse(row.contactIds),
      dealIds: JSON.parse(row.dealIds),
      accountEntityIds: JSON.parse(row.accountEntityIds),
      trackingPixelId: row.trackingPixelId || undefined,
      opens: Number(row.opens) || 0,
      clicks: Number(row.clicks) || 0,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };

    if (row.receivedAt) {
      email.receivedAt = new Date(row.receivedAt);
    }

    return email;
  }

  async getEmailAccountById(accountId: string): Promise<EmailAccount | null> {
    const stmt = this.db.prepare(
      "SELECT * FROM email_accounts WHERE id = ? AND isActive = 1"
    );
    const row = stmt.get(accountId) as any;

    if (!row) return null;

    const account: EmailAccount = {
      id: row.id,
      userId: row.userId,
      email: row.email,
      provider: row.provider,
      isActive: Boolean(row.isActive),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };

    if (row.accessToken) account.accessToken = row.accessToken;
    if (row.refreshToken) account.refreshToken = row.refreshToken;
    if (row.imapConfig) account.imapConfig = JSON.parse(row.imapConfig);
    if (row.smtpConfig) account.smtpConfig = JSON.parse(row.smtpConfig);
    if (row.lastSyncAt) account.lastSyncAt = new Date(row.lastSyncAt);

    return account;
  }

  async getEmailAccountByUserId(userId: string): Promise<EmailAccount | null> {
    const stmt = this.db.prepare(
      "SELECT * FROM email_accounts WHERE userId = ? AND isActive = 1 LIMIT 1"
    );
    const row = stmt.get(userId) as any;

    if (!row) return null;

    const account: EmailAccount = {
      id: row.id,
      userId: row.userId,
      email: row.email,
      provider: row.provider,
      isActive: Boolean(row.isActive),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };

    if (row.accessToken) account.accessToken = row.accessToken;
    if (row.refreshToken) account.refreshToken = row.refreshToken;
    if (row.imapConfig) account.imapConfig = JSON.parse(row.imapConfig);
    if (row.smtpConfig) account.smtpConfig = JSON.parse(row.smtpConfig);
    if (row.lastSyncAt) account.lastSyncAt = new Date(row.lastSyncAt);

    return account;
  }

  async getEmailAccountByEmail(email: string): Promise<EmailAccount | null> {
    const stmt = this.db.prepare(
      "SELECT * FROM email_accounts WHERE email = ? AND isActive = 1 LIMIT 1"
    );
    const row = stmt.get(email) as any;

    if (!row) return null;

    const account: EmailAccount = {
      id: row.id,
      userId: row.userId,
      email: row.email,
      provider: row.provider,
      isActive: Boolean(row.isActive),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };

    if (row.accessToken) account.accessToken = row.accessToken;
    if (row.refreshToken) account.refreshToken = row.refreshToken;
    if (row.imapConfig) account.imapConfig = JSON.parse(row.imapConfig);
    if (row.smtpConfig) account.smtpConfig = JSON.parse(row.smtpConfig);
    if (row.lastSyncAt) account.lastSyncAt = new Date(row.lastSyncAt);

    return account;
  }

  async createEmailAccount(account: EmailAccount): Promise<EmailAccount> {
    const stmt = this.db.prepare(`
      INSERT INTO email_accounts (
        id, userId, email, provider, accessToken, refreshToken, imapConfig, smtpConfig, 
        isActive, lastSyncAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      account.id,
      account.userId,
      account.email,
      account.provider,
      account.accessToken || null,
      account.refreshToken || null,
      account.imapConfig ? JSON.stringify(account.imapConfig) : null,
      account.smtpConfig ? JSON.stringify(account.smtpConfig) : null,
      account.isActive ? 1 : 0,
      account.lastSyncAt?.toISOString() || null,
      account.createdAt.toISOString(),
      account.updatedAt.toISOString()
    );

    return account;
  }

  async updateEmailAccount(
    accountId: string,
    updates: Partial<EmailAccount>
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.accessToken !== undefined) {
      fields.push("accessToken = ?");
      values.push(updates.accessToken);
    }

    if (updates.refreshToken !== undefined) {
      fields.push("refreshToken = ?");
      values.push(updates.refreshToken);
    }

    if (updates.imapConfig !== undefined) {
      fields.push("imapConfig = ?");
      values.push(JSON.stringify(updates.imapConfig));
    }

    if (updates.smtpConfig !== undefined) {
      fields.push("smtpConfig = ?");
      values.push(JSON.stringify(updates.smtpConfig));
    }

    if (updates.isActive !== undefined) {
      fields.push("isActive = ?");
      values.push(updates.isActive ? 1 : 0);
    }

    if (updates.lastSyncAt !== undefined) {
      fields.push("lastSyncAt = ?");
      values.push(updates.lastSyncAt.toISOString());
    }

    if (fields.length === 0) return;

    fields.push("updatedAt = ?");
    values.push(new Date().toISOString());
    values.push(accountId);

    const stmt = this.db.prepare(
      `UPDATE email_accounts SET ${fields.join(", ")} WHERE id = ?`
    );
    stmt.run(...values);
  }

  async getEmailAccounts(userId: string): Promise<EmailAccount[]> {
    const stmt = this.db.prepare(
      "SELECT * FROM email_accounts WHERE userId = ? ORDER BY createdAt DESC"
    );
    const rows = stmt.all(userId) as any[];

    return rows.map((row) => {
      const account: EmailAccount = {
        id: row.id,
        userId: row.userId,
        email: row.email,
        provider: row.provider,
        isActive: Boolean(row.isActive),
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      };

      if (row.accessToken) account.accessToken = row.accessToken;
      if (row.refreshToken) account.refreshToken = row.refreshToken;
      if (row.imapConfig) account.imapConfig = JSON.parse(row.imapConfig);
      if (row.smtpConfig) account.smtpConfig = JSON.parse(row.smtpConfig);
      if (row.lastSyncAt) account.lastSyncAt = new Date(row.lastSyncAt);

      return account;
    });
  }

  async findContactsByEmails(emails: string[]): Promise<Contact[]> {
    // Mock implementation
    return [];
  }

  async saveThreadSummary(threadId: string, summary: string): Promise<void> {
    const stmt = this.db.prepare(`
    INSERT INTO thread_summaries (threadId, summary, lastSummarizedAt)
    VALUES (?, ?, ?)
    ON CONFLICT(threadId) DO UPDATE SET
      summary = excluded.summary,
      lastSummarizedAt = excluded.lastSummarizedAt
  `);
    stmt.run(threadId, summary, new Date().toISOString());
  }

  async getThreadSummary(
    threadId: string
  ): Promise<{ summary: string; lastSummarizedAt: Date } | null> {
    const stmt = this.db.prepare(
      "SELECT * FROM thread_summaries WHERE threadId = ?"
    );
    const row = stmt.get(threadId) as any;
    if (!row) return null;
    return {
      summary: row.summary,
      lastSummarizedAt: new Date(row.lastSummarizedAt),
    };
  }
  async getThreadsNeedingSummary(): Promise<string[]> {
    const stmt = this.db.prepare(`
    SELECT DISTINCT threadId 
    FROM emails 
    WHERE threadId IS NOT NULL 
      AND threadId NOT IN (SELECT threadId FROM thread_summaries)
  `);
    const rows = stmt.all() as any[];
    return rows.map((r) => r.threadId);
  }

  async findDealsByContactIds(contactIds: string[]): Promise<Deal[]> {
    // Mock implementation
    return [];
  }

  async getEmailsForContact(contactId: string): Promise<Email[]> {
    // Mock implementation
    return [];
  }

  async getEmailsForDeal(dealId: string): Promise<Email[]> {
    // Mock implementation
    return [];
  }

  async getAllEmails(
    options: { limit?: number } = {}
  ): Promise<{ emails: Email[]; total: number }> {
    const { limit = 1000 } = options;
    const stmt = this.db.prepare(`SELECT * FROM emails LIMIT ?`);
    const rows = stmt.all(limit) as any[];

    const emails: Email[] = rows.map((row) => ({
      id: row.id,
      messageId: row.messageId,
      threadId: row.threadId,
      accountId: row.accountId,
      from: row.from_address,
      to: row.to_addresses ? JSON.parse(row.to_addresses) : [],
      cc: row.cc_addresses ? JSON.parse(row.cc_addresses) : undefined,
      bcc: row.bcc_addresses ? JSON.parse(row.bcc_addresses) : undefined,
      subject: row.subject,
      body: row.body,
      htmlBody: row.htmlBody,
      isRead: Boolean(row.isRead),
      isIncoming: Boolean(row.isIncoming),
      sentAt: new Date(row.sentAt),
      receivedAt: row.receivedAt ? new Date(row.receivedAt) : undefined,
      contactIds: row.contactIds ? JSON.parse(row.contactIds) : [],
      dealIds: row.dealIds ? JSON.parse(row.dealIds) : [],
      accountEntityIds: row.accountEntityIds
        ? JSON.parse(row.accountEntityIds)
        : [],
      trackingPixelId: row.trackingPixelId,
      opens: row.opens || 0,
      clicks: row.clicks || 0,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      labelIds: row.labelIds ? JSON.parse(row.labelIds) : undefined,
    }));

    return { emails, total: emails.length };
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
    const {
      limit = 50,
      offset = 0,
      folder = "inbox",
      search,
      unreadOnly = false,
    } = options;

    // Build the WHERE clause
    let whereClause =
      "WHERE e.accountId IN (SELECT id FROM email_accounts WHERE userId = ?)";
    const params: any[] = [userId];

    // Add folder filter
    if (folder === "inbox") {
      whereClause += " AND e.isIncoming = 1";
      console.log("Filtering for INBOX emails (isIncoming = 1)");
    } else if (folder === "sent") {
      whereClause += " AND e.isIncoming = 0";
      console.log("Filtering for SENT emails (isIncoming = 0)");
    } else if (folder === "spam") {
      // For spam, we'll filter by Gmail SPAM label or similar
      whereClause +=
        ' AND (e.labelIds LIKE "%SPAM%" OR e.labelIds LIKE "%JUNK%")';
      console.log("Filtering for SPAM emails");
    } else if (folder === "archive") {
      // For archive, we'll filter by Gmail ARCHIVE label or similar
      whereClause +=
        ' AND (e.labelIds LIKE "%ARCHIVE%" OR e.labelIds LIKE "%ALL_MAIL%")';
      console.log("Filtering for ARCHIVE emails");
    } else if (folder === "drafts") {
      // For drafts, we'll filter by Gmail DRAFT label
      whereClause += ' AND e.labelIds LIKE "%DRAFT%"';
      console.log("Filtering for DRAFT emails");
    } else {
      console.log(`No folder filter applied for folder: ${folder}`);
    }

    // Add unread filter
    if (unreadOnly) {
      whereClause += " AND e.isRead = 0";
    }

    // Add search filter
    if (search) {
      whereClause +=
        " AND (e.subject LIKE ? OR e.from_address LIKE ? OR e.body LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Get total count
    const countStmt = this.db.prepare(
      `SELECT COUNT(*) as total FROM emails e ${whereClause}`
    );
    const countResult = countStmt.get(...params) as { total: number };
    const total = countResult.total;

    // Get emails with pagination
    const query = `
      SELECT e.*, ea.email as accountEmail 
      FROM emails e 
      LEFT JOIN email_accounts ea ON e.accountId = ea.id 
      ${whereClause} 
      ORDER BY e.sentAt DESC 
      LIMIT ? OFFSET ?
    `;

    console.log("Email query:", query);
    console.log("Query params:", [...params, limit, offset]);

    const emailsStmt = this.db.prepare(query);
    const emailRows = emailsStmt.all(...params, limit, offset) as any[];

    console.log(`Found ${emailRows.length} emails for folder: ${folder}`);

    const emails: Email[] = emailRows.map((row) => ({
      id: row.id,
      messageId: row.messageId,
      threadId: row.threadId,
      accountId: row.accountId,
      from: row.from_address,
      to: row.to_addresses ? JSON.parse(row.to_addresses) : [],
      cc: row.cc_addresses ? JSON.parse(row.cc_addresses) : undefined,
      bcc: row.bcc_addresses ? JSON.parse(row.bcc_addresses) : undefined,
      subject: row.subject,
      body: row.body,
      htmlBody: row.htmlBody,
      attachments: row.attachments ? JSON.parse(row.attachments) : undefined,
      isRead: Boolean(row.isRead),
      isIncoming: Boolean(row.isIncoming),
      sentAt: new Date(row.sentAt),
      receivedAt: row.receivedAt ? new Date(row.receivedAt) : undefined,
      contactIds: row.contactIds ? JSON.parse(row.contactIds) : [],
      dealIds: row.dealIds ? JSON.parse(row.dealIds) : [],
      accountEntityIds: row.accountEntityIds
        ? JSON.parse(row.accountEntityIds)
        : [],
      trackingPixelId: row.trackingPixelId,
      opens: row.opens || 0,
      clicks: row.clicks || 0,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      labelIds: row.labelIds ? JSON.parse(row.labelIds) : undefined,
    }));

    return { emails, total };
  }

  // Get a specific email by ID
  async getEmailById(emailId: string, userId: string): Promise<Email | null> {
    const stmt = this.db.prepare(`
      SELECT e.*, ea.email as accountEmail 
      FROM emails e 
      LEFT JOIN email_accounts ea ON e.accountId = ea.id 
      WHERE e.id = ? AND e.accountId IN (SELECT id FROM email_accounts WHERE userId = ?)
    `);

    const row = stmt.get(emailId, userId) as any;
    if (!row) return null;

    return {
      id: row.id,
      messageId: row.messageId,
      threadId: row.threadId,
      accountId: row.accountId,
      from: row.from_address,
      to: row.to_addresses ? JSON.parse(row.to_addresses) : [],
      cc: row.cc_addresses ? JSON.parse(row.cc_addresses) : undefined,
      bcc: row.bcc_addresses ? JSON.parse(row.bcc_addresses) : undefined,
      subject: row.subject,
      body: row.body,
      htmlBody: row.htmlBody,
      attachments: row.attachments ? JSON.parse(row.attachments) : undefined,
      isRead: Boolean(row.isRead),
      isIncoming: Boolean(row.isIncoming),
      sentAt: new Date(row.sentAt),
      receivedAt: row.receivedAt ? new Date(row.receivedAt) : undefined,
      contactIds: row.contactIds ? JSON.parse(row.contactIds) : [],
      dealIds: row.dealIds ? JSON.parse(row.dealIds) : [],
      accountEntityIds: row.accountEntityIds
        ? JSON.parse(row.accountEntityIds)
        : [],
      trackingPixelId: row.trackingPixelId,
      opens: row.opens || 0,
      clicks: row.clicks || 0,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  // Mark email as read/unread
  async markEmailAsRead(
    emailId: string,
    userId: string,
    isRead: boolean
  ): Promise<boolean> {
    const stmt = this.db.prepare(`
      UPDATE emails 
      SET isRead = ?, updatedAt = ? 
      WHERE id = ? AND accountId IN (SELECT id FROM email_accounts WHERE userId = ?)
    `);

    const result = stmt.run(
      isRead ? 1 : 0,
      new Date().toISOString(),
      emailId,
      userId
    );
    return result.changes > 0;
  }
}
