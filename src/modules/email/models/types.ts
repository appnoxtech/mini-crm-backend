export interface EmailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;      // For inline images (CID references)
  url?: string;            // URL to fetch the file from (S3, etc.)
  content?: string;        // Base64 encoded content (same as Gmail)
  encoding?: 'base64';     // Encoding type
}

export interface Email {
  id: string;
  messageId: string;
  threadId?: string;
  accountId: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
  isRead: boolean;
  isIncoming: boolean;
  sentAt: Date;
  receivedAt?: Date;
  snippet?: string;        // Short preview of the email body
  contactIds: string[];
  dealIds: string[];
  accountEntityIds: string[];
  createdAt: Date;
  updatedAt: Date;
  // Gmail-specific fields
  labelIds?: string[];
  // IMAP-specific fields for UID tracking
  uid?: number;
  folder?: string;
  providerId?: string;
  threadCount?: number;
  opens?: number;
  clicks?: number;
  lastOpenedAt?: Date;
  lastClickedAt?: Date;
}

export interface EmailContent {
  messageId: string;
  body: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailAccount {
  id: string;
  userId: string;
  email: string;
  provider: 'gmail' | 'outlook' | 'imap' | 'custom';
  accessToken?: string;
  refreshToken?: string;
  imapConfig?: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  };
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  };
  isActive: boolean;
  lastSyncAt?: Date;
  lastHistoryId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Contact {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  stage: string;
  contactIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
