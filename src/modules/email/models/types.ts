export interface EmailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
  url: string;
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
  contactIds: string[];
  dealIds: string[];
  accountEntityIds: string[];
  trackingPixelId?: string;
  opens: number;
  clicks: number;
  createdAt: Date;
  updatedAt: Date;
  // Gmail-specific fields
  labelIds?: string[];
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
