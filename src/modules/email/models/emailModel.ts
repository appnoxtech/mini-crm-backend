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
        lastHistoryId TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // Create emails table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS emails (
        id TEXT PRIMARY KEY,
        messageId TEXT NOT NULL,
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
        UNIQUE(messageId, accountId),
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

    } catch (error) {
      // Column already exists, ignore error
    }

    // Add lastHistoryId column if it doesn't exist (for existing databases)
    try {
      this.db.exec("ALTER TABLE email_accounts ADD COLUMN lastHistoryId TEXT");

    } catch (error) {
      // Column already exists, ignore error
    }
    // Add attachments column if it doesn't exist
    try {
      this.db.exec("ALTER TABLE emails ADD COLUMN attachments TEXT");

    } catch (error) {
      // Column already exists, ignore error
    }

    // Migration for multi-user email support: remove global UNIQUE constraint on messageId
    // and replace it with composite UNIQUE(messageId, accountId)
    try {
      const schema = this.db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='emails'").get() as any;
      if (schema && schema.sql && schema.sql.includes('messageId TEXT UNIQUE')) {

        this.db.transaction(() => {
          this.db.exec("DROP TABLE IF EXISTS emails_old");
          this.db.exec("ALTER TABLE emails RENAME TO emails_old");
          this.db.exec(`
            CREATE TABLE emails (
              id TEXT PRIMARY KEY,
              messageId TEXT NOT NULL,
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
              attachments TEXT,
              UNIQUE(messageId, accountId),
              FOREIGN KEY (accountId) REFERENCES email_accounts(id)
            )
          `);
          // Note: When migrating old data, attachments column will be null, which is fine
          this.db.exec("INSERT INTO emails SELECT id, messageId, threadId, accountId, from_address, to_addresses, cc_addresses, bcc_addresses, subject, body, htmlBody, isRead, isIncoming, sentAt, receivedAt, contactIds, dealIds, accountEntityIds, trackingPixelId, opens, clicks, createdAt, updatedAt, labelIds, NULL FROM emails_old");
          this.db.exec("DROP TABLE emails_old");

          // Re-create indexes
          this.db.exec("CREATE INDEX IF NOT EXISTS idx_emails_accountId ON emails(accountId)");
          this.db.exec("CREATE INDEX IF NOT EXISTS idx_emails_messageId ON emails(messageId)");
          this.db.exec("CREATE INDEX IF NOT EXISTS idx_emails_sentAt ON emails(sentAt)");
        })();

      }
    } catch (error: any) {
      console.error("Migration to multi-user emails failed:", error.message);
    }
  }

  createEmail(email: Email): Email {
    const stmt = this.db.prepare(`
      INSERT INTO emails (
        id, messageId, threadId, accountId, from_address, to_addresses, cc_addresses, bcc_addresses,
        subject, body, htmlBody, isRead, isIncoming, sentAt, receivedAt, contactIds, dealIds,
        accountEntityIds, trackingPixelId, opens, clicks, createdAt, updatedAt, labelIds, attachments
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      email.labelIds ? JSON.stringify(email.labelIds) : null,
      email.attachments ? JSON.stringify(email.attachments) : null
    );

    return email;
  }

  findEmailByMessageId(messageId: string, accountId?: string): Email | null {
    const query = accountId
      ? "SELECT * FROM emails WHERE messageId = ? AND accountId = ?"
      : "SELECT * FROM emails WHERE messageId = ?"
    const stmt = this.db.prepare(query);
    const row = accountId ? stmt.get(messageId, accountId) : stmt.get(messageId) as any;

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
      attachments: row.attachments ? JSON.parse(row.attachments) : [],
      labelIds: row.labelIds ? JSON.parse(row.labelIds) : [],
    };

    if (row.receivedAt) {
      email.receivedAt = new Date(row.receivedAt);
    }

    return email;
  }

  getEmailAccountById(accountId: string): EmailAccount | null {
    const stmt = this.db.prepare(
      "SELECT * FROM email_accounts WHERE id = ?"
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
    if (row.lastHistoryId) account.lastHistoryId = row.lastHistoryId;

    return account;
  }

  getEmailAccountByUserId(userId: string): EmailAccount | null {
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

  getEmailAccountByEmail(email: string): EmailAccount | null {
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

  createEmailAccount(account: EmailAccount): EmailAccount {
    const stmt = this.db.prepare(`
      INSERT INTO email_accounts (
        id, userId, email, provider, accessToken, refreshToken, imapConfig, smtpConfig, 
        isActive, lastSyncAt, lastHistoryId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      account.lastHistoryId || null,
      account.createdAt.toISOString(),
      account.updatedAt.toISOString()
    );

    return account;
  }

  updateEmailAccount(
    accountId: string,
    updates: Partial<EmailAccount>
  ): void {
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

    if (updates.lastHistoryId !== undefined) {
      fields.push("lastHistoryId = ?");
      values.push(updates.lastHistoryId);
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

  getAllActiveAccounts(): EmailAccount[] {
    const stmt = this.db.prepare(
      "SELECT * FROM email_accounts WHERE isActive = 1"
    );
    const rows = stmt.all() as any[];

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

  getEmailAccounts(userId: string): EmailAccount[] {

    const stmt = this.db.prepare(
      "SELECT * FROM email_accounts WHERE userId = ? AND isActive = 1 ORDER BY createdAt DESC"
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

  findContactsByEmails(emails: string[]): Contact[] {
    // Mock implementation
    return [];
  }

  saveThreadSummary(threadId: string, summary: string): void {
    const stmt = this.db.prepare(`
    INSERT INTO thread_summaries (threadId, summary, lastSummarizedAt)
    VALUES (?, ?, ?)
    ON CONFLICT(threadId) DO UPDATE SET
      summary = excluded.summary,
      lastSummarizedAt = excluded.lastSummarizedAt
  `);
    stmt.run(threadId, summary, new Date().toISOString());
  }

  getThreadSummary(
    threadId: string
  ): { summary: string; lastSummarizedAt: Date } | null {
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
  getThreadsNeedingSummary(): string[] {
    const stmt = this.db.prepare(`
    SELECT DISTINCT threadId 
    FROM emails 
    WHERE threadId IS NOT NULL 
      AND threadId NOT IN (SELECT threadId FROM thread_summaries)
  `);
    const rows = stmt.all() as any[];
    return rows.map((r) => r.threadId);
  }

  findDealsByContactIds(contactIds: string[]): Deal[] {
    // Mock implementation
    return [];
  }

  // private mapRowToEmail(row: any): Email {
  //   return {
  //     id: row.id,
  //     messageId: row.messageId,
  //     threadId: row.threadId,
  //     accountId: row.accountId,
  //     from: row.from_address,
  //     to: row.to_addresses ? JSON.parse(row.to_addresses) : [],
  //     cc: row.cc_addresses ? JSON.parse(row.cc_addresses) : undefined,
  //     bcc: row.bcc_addresses ? JSON.parse(row.bcc_addresses) : undefined,
  //     subject: row.subject,
  //     body: row.body,
  //     htmlBody: row.htmlBody,
  //     attachments: row.attachments ? JSON.parse(row.attachments) : [],
  //     isRead: Boolean(row.isRead),
  //     isIncoming: Boolean(row.isIncoming),
  //     sentAt: new Date(row.sentAt),
  //     receivedAt: row.receivedAt ? new Date(row.receivedAt) : undefined,
  //     contactIds: row.contactIds ? JSON.parse(row.contactIds) : [],
  //     dealIds: row.dealIds ? JSON.parse(row.dealIds) : [],
  //     accountEntityIds: row.accountEntityIds ? JSON.parse(row.accountEntityIds) : [],
  //     trackingPixelId: row.trackingPixelId,
  //     opens: row.opens || 0,
  //     clicks: row.clicks || 0,
  //     createdAt: new Date(row.createdAt),
  //     updatedAt: new Date(row.updatedAt),
  //     labelIds: row.labelIds ? JSON.parse(row.labelIds) : [],
  //   };
  // }

  getEmailsForContact(contactId: string): Email[] {
    const stmt = this.db.prepare(`
      SELECT * FROM emails 
      WHERE contactIds LIKE ? 
      ORDER BY sentAt DESC
    `);
    const rows = stmt.all(`%"${contactId}"%`) as any[];
    return rows.map(row => this.mapRowToEmail(row));
  }

  getEmailsForDeal(dealId: string): Email[] {
    const stmt = this.db.prepare(`
      SELECT * FROM emails 
      WHERE dealIds LIKE ? 
      ORDER BY sentAt DESC
    `);
    const rows = stmt.all(`%"${dealId}"%`) as any[];
    return rows.map(row => this.mapRowToEmail(row));
  }

  getEmailsByAddress(address: string): Email[] {
    const stmt = this.db.prepare(`
      SELECT * FROM emails 
      WHERE from_address = ? OR to_addresses LIKE ? 
      ORDER BY sentAt DESC
    `);
    const rows = stmt.all(address, `%${address}%`) as any[];
    return rows.map(row => this.mapRowToEmail(row));
  }

  getEmailsForThread(threadId: string): Email[] {
    const stmt = this.db.prepare(`
      SELECT * FROM emails 
      WHERE threadId = ? 
      ORDER BY sentAt ASC
    `);
    const rows = stmt.all(threadId) as any[];
    return rows.map(row => this.mapRowToEmail(row));
  }

  getAllEmails(
    options: { limit?: number } = {}
  ): { emails: Email[]; total: number } {
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
  getEmailsForUser(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      folder?: string;
      search?: string;
      unreadOnly?: boolean;
      accountId?: string;
    } = {}
  ): { emails: Email[]; total: number } {
    const {
      limit = 50,
      offset = 0,
      folder = "inbox",
      search,
      unreadOnly = false,
      accountId,
    } = options;

    // Build the WHERE clause
    let whereClause =
      "WHERE e.accountId IN (SELECT id FROM email_accounts WHERE userId = ?)";
    const params: any[] = [userId];

    if (accountId) {
      whereClause += " AND e.accountId = ?";
      params.push(accountId);
    }

    // Add folder filter
    if (folder === "inbox") {
      whereClause += ` AND e.isIncoming = 1 AND (e.labelIds IS NULL OR (e.labelIds NOT LIKE '%SPAM%' AND e.labelIds NOT LIKE '%JUNK%' AND e.labelIds NOT LIKE '%TRASH%' AND e.labelIds NOT LIKE '%ARCHIVE%'))`;

    } else if (folder === "sent") {
      whereClause += ` AND e.isIncoming = 0 AND (e.labelIds IS NULL OR (e.labelIds NOT LIKE '%DRAFT%' AND e.labelIds NOT LIKE '%TRASH%'))`;

    } else if (folder === "spam") {
      whereClause += ` AND (e.labelIds LIKE '%SPAM%' OR e.labelIds LIKE '%JUNK%')`;

    } else if (folder === "drafts" || folder === "drfts") {
      whereClause += ` AND e.labelIds LIKE '%DRAFT%'`;

    } else if (folder === "trash") {
      whereClause += ` AND e.labelIds LIKE '%TRASH%'`;

    } else if (folder === "archive") {
      whereClause += ` AND (e.labelIds LIKE '%ARCHIVE%' OR e.labelIds LIKE '%ALL_MAIL%')`;

    } else {

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



    const emailsStmt = this.db.prepare(query);
    const emailRows = emailsStmt.all(...params, limit, offset) as any[];



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
      attachments: row.attachments ? JSON.parse(row.attachments) : [],
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
      labelIds: row.labelIds ? JSON.parse(row.labelIds) : [],
    }));

    return { emails, total };
  }

  // Get a specific email by ID
  getEmailById(emailId: string, userId: string): Email | null {
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
      attachments: row.attachments ? JSON.parse(row.attachments) : [],
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
      labelIds: row.labelIds ? JSON.parse(row.labelIds) : [],
    };
  }

  archiveEmail(emailId: string, userId: string): boolean {
    const email = this.getEmailById(emailId, userId);
    if (!email) return false;

    let labels = email.labelIds || [];
    if (!labels.includes('ARCHIVE')) {
      labels.push('ARCHIVE');
    }
    // Remove INBOX if present to reflect "Moved out of Inbox" state
    labels = labels.filter((l) => l !== 'INBOX');

    const stmt = this.db.prepare(
      `UPDATE emails SET labelIds = ?, updatedAt = ? WHERE id = ?`
    );
    const result = stmt.run(
      JSON.stringify(labels),
      new Date().toISOString(),
      emailId
    );
    return result.changes > 0;
  }

  unarchiveEmail(emailId: string, userId: string): boolean {
    const email = this.getEmailById(emailId, userId);
    if (!email) return false;

    let labels = email.labelIds || [];
    labels = labels.filter((l) => l !== 'ARCHIVE');
    // We can optionally add INBOX back, or just rely on absence of ARCHIVE
    // For clarity, let's treat it as returning to Inbox mostly often implies adding INBOX label if your system relies on it.
    // But since our INBOX query is "NOT ARCHIVE", it works without explicit INBOX label. 
    // However, if we removed INBOX during archive, adding it back is symmetric.
    if (!labels.includes('INBOX')) {
      labels.push('INBOX');
    }

    const stmt = this.db.prepare(
      `UPDATE emails SET labelIds = ?, updatedAt = ? WHERE id = ?`
    );
    const result = stmt.run(
      JSON.stringify(labels),
      new Date().toISOString(),
      emailId
    );
    return result.changes > 0;
  }

  // Mark email as read/unread
  markEmailAsRead(
    emailId: string,
    userId: string,
    isRead: boolean
  ): boolean {
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

  // ========== NEW METHODS FOR HISTORICAL SYNC ==========

  /**
   * Initialize UID tracking table and add new columns
   */
  initializeHistoricalSyncSchema(): void {
    // Add uid column to emails table
    try {
      this.db.exec("ALTER TABLE emails ADD COLUMN uid INTEGER");
    } catch (error) {
      // Column already exists
    }

    // Add folder column to emails table
    try {
      this.db.exec("ALTER TABLE emails ADD COLUMN folder TEXT");
    } catch (error) {
      // Column already exists
    }

    // Create UID tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS email_sync_state (
        id TEXT PRIMARY KEY,
        accountId TEXT NOT NULL,
        folder TEXT NOT NULL,
        lastSyncedUid INTEGER DEFAULT 0,
        updatedAt TEXT NOT NULL,
        UNIQUE(accountId, folder)
      )
    `);

    // Create indexes for efficient querying
    try {
      this.db.exec("CREATE INDEX IF NOT EXISTS idx_emails_uid ON emails(uid)");
      this.db.exec("CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(folder)");
      this.db.exec("CREATE INDEX IF NOT EXISTS idx_emails_accountId_folder ON emails(accountId, folder)");
    } catch (error) {
      // Indexes may already exist
    }
  }

  /**
   * Bulk insert emails with duplicate prevention
   */
  bulkCreateEmails(emails: Email[]): { inserted: number; skipped: number } {
    let inserted = 0;
    let skipped = 0;

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO emails (
        id, messageId, threadId, accountId, from_address, to_addresses, cc_addresses, bcc_addresses,
        subject, body, htmlBody, isRead, isIncoming, sentAt, receivedAt, contactIds, dealIds,
        accountEntityIds, trackingPixelId, opens, clicks, createdAt, updatedAt, labelIds, attachments, uid, folder
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((emails: Email[]) => {
      for (const email of emails) {
        const result = insertStmt.run(
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
          email.sentAt instanceof Date ? email.sentAt.toISOString() : email.sentAt,
          email.receivedAt instanceof Date ? email.receivedAt.toISOString() : email.receivedAt,
          JSON.stringify(email.contactIds || []),
          JSON.stringify(email.dealIds || []),
          JSON.stringify(email.accountEntityIds || []),
          email.trackingPixelId || null,
          email.opens || 0,
          email.clicks || 0,
          email.createdAt instanceof Date ? email.createdAt.toISOString() : email.createdAt,
          email.updatedAt instanceof Date ? email.updatedAt.toISOString() : email.updatedAt,
          email.labelIds ? JSON.stringify(email.labelIds) : null,
          email.attachments ? JSON.stringify(email.attachments) : null,
          email.uid || null,
          email.folder || null
        );

        if (result.changes > 0) {
          inserted++;
        } else {
          skipped++;
        }
      }
    });

    transaction(emails);
    return { inserted, skipped };
  }

  /**
   * Get last synced UID for an account/folder combination
   */
  getLastSyncedUid(accountId: string, folder: string): number | null {
    const stmt = this.db.prepare(`
      SELECT lastSyncedUid FROM email_sync_state 
      WHERE accountId = ? AND folder = ?
    `);
    const result = stmt.get(accountId, folder) as any;
    return result?.lastSyncedUid || null;
  }

  /**
   * Update last synced UID for an account/folder combination
   */
  updateLastSyncedUid(accountId: string, folder: string, uid: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO email_sync_state (id, accountId, folder, lastSyncedUid, updatedAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(accountId, folder) DO UPDATE SET 
        lastSyncedUid = excluded.lastSyncedUid,
        updatedAt = excluded.updatedAt
    `);
    stmt.run(`${accountId}-${folder}`, accountId, folder, uid, new Date().toISOString());
  }

  /**
   * Get paginated emails for a user with filtering options
   */
  getEmailsPaginated(userId: string, options: {
    page?: number;
    limit?: number;
    folder?: string;
    accountId?: string;
    search?: string;
    unreadOnly?: boolean;
  }): { emails: Email[]; total: number; page: number; limit: number; totalPages: number } {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE ea.userId = ?";
    const params: any[] = [userId];

    if (options.accountId) {
      whereClause += " AND e.accountId = ?";
      params.push(options.accountId);
    }

    if (options.folder) {
      const folderUpper = options.folder.toUpperCase();
      if (folderUpper === 'INBOX') {
        whereClause += " AND (e.folder = 'INBOX' OR e.labelIds LIKE '%INBOX%') AND (e.labelIds NOT LIKE '%ARCHIVE%' OR e.labelIds IS NULL)";
      } else if (folderUpper === 'SENT') {
        whereClause += " AND (e.folder = 'SENT' OR e.isIncoming = 0)";
      } else if (folderUpper === 'ARCHIVE') {
        whereClause += " AND e.labelIds LIKE '%ARCHIVE%'";
      } else {
        whereClause += " AND (e.folder = ? OR e.labelIds LIKE ?)";
        params.push(folderUpper, `%${folderUpper}%`);
      }
    }

    if (options.search) {
      whereClause += " AND (e.subject LIKE ? OR e.from_address LIKE ? OR e.body LIKE ?)";
      const searchTerm = `%${options.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (options.unreadOnly) {
      whereClause += " AND e.isRead = 0";
    }

    // Get total count
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total FROM emails e
      JOIN email_accounts ea ON e.accountId = ea.id
      ${whereClause}
    `);
    const countResult = countStmt.get(...params) as any;
    const total = countResult?.total || 0;

    // Get paginated emails
    const selectStmt = this.db.prepare(`
      SELECT e.* FROM emails e
      JOIN email_accounts ea ON e.accountId = ea.id
      ${whereClause}
      ORDER BY e.sentAt DESC
      LIMIT ? OFFSET ?
    `);
    const rows = selectStmt.all(...params, limit, offset) as any[];

    const emails = rows.map((row) => this.mapRowToEmail(row));

    return {
      emails,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Helper method to map DB row to Email object
  private mapRowToEmail(row: any): Email {
    return {
      id: row.id,
      messageId: row.messageId,
      threadId: row.threadId,
      accountId: row.accountId,
      from: row.from_address,
      to: JSON.parse(row.to_addresses || '[]'),
      cc: row.cc_addresses ? JSON.parse(row.cc_addresses) : undefined,
      bcc: row.bcc_addresses ? JSON.parse(row.bcc_addresses) : undefined,
      subject: row.subject,
      body: row.body,
      htmlBody: row.htmlBody,
      isRead: !!row.isRead,
      isIncoming: !!row.isIncoming,
      sentAt: new Date(row.sentAt),
      receivedAt: row.receivedAt ? new Date(row.receivedAt) : undefined,
      contactIds: JSON.parse(row.contactIds || '[]'),
      dealIds: JSON.parse(row.dealIds || '[]'),
      accountEntityIds: JSON.parse(row.accountEntityIds || '[]'),
      trackingPixelId: row.trackingPixelId,
      opens: row.opens || 0,
      clicks: row.clicks || 0,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      labelIds: row.labelIds ? JSON.parse(row.labelIds) : undefined,
      attachments: row.attachments ? JSON.parse(row.attachments) : undefined,
      uid: row.uid,
      folder: row.folder
    };
  }
}
