// Email module exports
export { EmailModel } from './models/emailModel';
export { EmailService } from './services/emailService';
export { EmailConnectorService } from './services/emailConnectorService';
export { EmailController } from './controllers/emailController';
export { createEmailRoutes } from './routes/emailRoutes';

// Draft module exports
export { DraftModel } from './models/draftModel';
export { DraftService } from './services/draftService';
export { DraftController } from './controllers/draftController';
export { createDraftRoutes } from './routes/draftRoutes';


// Enhanced email functionality exports
export { MailSystemConfigService } from './services/mailSystemConfig';
export { QuotaValidationService } from './services/quotaValidationService';
export { EnhancedEmailComposer } from './services/enhancedEmailComposer';
export { EnhancedGmailService } from './services/enhancedGmailService';
export { ErrorHandlingService } from './services/errorHandlingService';

export type {
  Email,
  EmailAccount,
  EmailAttachment,
  Contact,
  Deal
} from './models/types';

// Draft types
export type {
  EmailDraft,
  CreateDraftInput,
  UpdateDraftInput,
  ListDraftsOptions,
} from './models/draftTypes';


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
