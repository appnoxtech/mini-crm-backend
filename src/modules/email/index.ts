// Email module exports
export { EmailModel } from './models/emailModel';
export { EmailService } from './services/emailService';
export { EmailConnectorService } from './services/emailConnectorService';
export { EmailController } from './controllers/emailController';
export { createEmailRoutes } from './routes/emailRoutes';


// Enhanced email functionality exports
export { MailSystemConfigService } from './services/mailSystemConfig';
export { QuotaValidationService } from './services/quotaValidationService';
export { EnhancedEmailComposer } from './services/enhancedEmailComposer';
export { EnhancedGmailService } from './services/enhancedGmailService';
export { EmailTrackingService } from './services/emailTrackingService';
export { ErrorHandlingService } from './services/errorHandlingService';
export { BulkEmailService } from './services/bulkEmailService';

export type { 
  Email, 
  EmailAccount, 
  EmailAttachment, 
  Contact, 
  Deal 
} from './models/types';


// Enhanced types exports
export type {
  EmailRequest,
  GmailMessage,
  CompositionResult
} from './services/enhancedEmailComposer';

export type {
  QuotaCheckRequest,
  QuotaValidationResult,
  QuotaStatus
} from './services/quotaValidationService';

export type {
  BulkEmailRequest,
  BulkSendStatus,
  BulkSendResult
} from './services/bulkEmailService';

export type {
  EmailAnalytics,
  EngagementMetrics,
  CampaignAnalytics
} from './services/emailTrackingService';
