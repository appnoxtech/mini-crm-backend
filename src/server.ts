import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { corsMiddleware } from './shared/middleware/auth';
import { startTokenRefreshJob } from './cron/tokenRefresh'; import { startEmailSyncJob } from './cron/emailSync';
import { startTrashCleanupJob } from './cron/trashCleanup';
import os from 'os';

// Import Draft module (need to import these specifically if not already)
import { DraftModel, DraftService, DraftController, createDraftRoutes } from './modules/email';

// Load environment variables
dotenv.config();

// Import models
import { UserModel } from './modules/auth/models/User';
import { OtpModel } from './modules/auth/models/Otp';
import { LeadModel } from './modules/leads/models/Lead';
import { EmailModel } from './modules/email/models/emailModel';
import { PipelineModel } from './modules/pipelines/models/Pipeline';
import { PipelineStageModel } from './modules/pipelines/models/PipelineStage';
import { DealModel } from './modules/pipelines/models/Deal';
import { DealHistoryModel } from './modules/pipelines/models/DealHistory';
import { DealActivityModel } from './modules/pipelines/models/DealActivity';
import { OrganizationModel } from './modules/management/organisations/models/Organization';
import { PersonModel } from './modules/management/persons/models/Person';
import { ProductModel } from './modules/pipelines/models/Product';
import { LabelModel } from './modules/pipelines/models/Label';

// Import call module
import { CallModel } from './modules/calls/models/Call';
import { CallService } from './modules/calls/services/callService';
import { CallController } from './modules/calls/controllers/callController';
import { WebhookController } from './modules/calls/controllers/webhookController';
import { createCallRoutes } from './modules/calls/routes/callRoutes';
import { createWebhookRoutes } from './modules/calls/routes/webhookRoutes';

// Import services
import { AuthService } from './modules/auth/services/authService';
import { LeadService } from './modules/leads/services/leadService';
import { EmailService } from './modules/email/services/emailService';
import { EmailConnectorService } from './modules/email/services/emailConnectorService';
import { OAuthService } from './modules/email/services/oauthService';
import { EmailQueueService } from './modules/email/services/emailQueueService';
import { RealTimeNotificationService } from './modules/email/services/realTimeNotificationService';
import { PipelineService } from './modules/pipelines/services/pipelineService';
import { PipelineStageService } from './modules/pipelines/services/pipelineStageService';
import { DealService } from './modules/pipelines/services/dealService';
import { ProductService } from './modules/pipelines/services/productService';
import { DealActivityService } from './modules/pipelines/services/dealActivityService';
import { PersonService } from './modules/management/persons/services/PersonService';
import { ProfileService } from './modules/management/persons/services/profileService';
import { OrganizationService } from './modules/management/organisations/services/OrganizationService';
import { LabelService } from './modules/pipelines/services/labelService';

// Import enhanced email services
import { MailSystemConfigService } from './modules/email/services/mailSystemConfig';
import { QuotaValidationService } from './modules/email/services/quotaValidationService';
import { EnhancedEmailComposer } from './modules/email/services/enhancedEmailComposer';
import { EnhancedGmailService } from './modules/email/services/enhancedGmailService';
import { ErrorHandlingService } from './modules/email/services/errorHandlingService';

// Import instant notification services
import { imapIdleService } from './modules/email/services/imapIdleService';
import { gmailPushService } from './modules/email/services/gmailPushService';

// Import controllers
import { AuthController } from './modules/auth/controllers/authController';
import { LeadController } from './modules/leads/controllers/leadController';
import { EmailController } from './modules/email/controllers/emailController';
import { PipelineController } from './modules/pipelines/controllers/pipelineController';
import { DealController } from './modules/pipelines/controllers/dealController';
import { ProductController } from './modules/pipelines/controllers/productController';
import { ActivityController } from './modules/pipelines/controllers/activityController';
import { PersonController } from './modules/management/persons/controllers/PersonController';
import { OrganizationController } from './modules/management/organisations/controllers/OrganizationController';
import { LabelController } from './modules/pipelines/controllers/labelController';
import { ProfileController } from './modules/management/persons/controllers/profileController';

// Import routes
import { createAuthRoutes } from './modules/auth/routes/authRoutes';
import { createLeadRoutes } from './modules/leads/routes/leadRoutes';
import { createEmailRoutes } from './modules/email/routes/emailRoutes';
import { createSummarizationRoutes } from './modules/email/routes/summarizationRoutes';
import { createPipelineRoutes } from './modules/pipelines/routes/pipelineRoutes';
import { createDealRoutes } from './modules/pipelines/routes/dealRoutes';
import { createProductRoutes } from './modules/pipelines/routes/productRoutes';
import { createActivityRoutes } from './modules/pipelines/routes/activityRoutes';
import { createOrganizationRoutes } from './modules/management/organisations/routes/organizationRoutes';
import { createPersonRoutes } from './modules/management/persons/routes/personRoutes';
import { createLabelRoutes } from './modules/pipelines/routes/labelRoutes';
import { createProfileRoutes } from './modules/management/persons/routes/profileRoutes';
import { createEmailWebhookRoutes } from './modules/email/routes/emailWebhookRoutes';

// Import summarization module
import { SummarizationController } from './modules/email/controllers/summarizationController';
import { startSummarizationScheduler } from './modules/email/services/summarizationSchedulerService';

import { EmailTrackingController } from './modules/email/controllers/emailTrackingController';

// Import data import module
import { ImportModel, ImportService, ImportController, createImportRoutes } from './modules/import';

// Import AI agent module
import { SuggestionOrchestratorService } from './modules/ai-agent/services/suggestionOrchestratorService';
import { SuggestionController } from './modules/ai-agent/controllers/suggestionController';
import { AIConfigController } from './modules/ai-agent/controllers/aiConfigController';
import { createSuggestionRoutes } from './modules/ai-agent/routes/suggestionRoutes';
import { PricingModel } from './modules/ai-agent/models/PricingModel';
import { BrandGuidelinesModel } from './modules/ai-agent/models/BrandGuidelinesModel';
import { KnowledgeBaseModel } from './modules/ai-agent/models/KnowledgeBaseModel';

// Import calendar module
import { CalendarEventModel } from './modules/calendar/models/CalendarEvent';
import { EventReminderModel } from './modules/calendar/models/EventReminder';
import { EventShareModel } from './modules/calendar/models/EventShare';
import { EventNotificationModel } from './modules/calendar/models/EventNotification';
import { CalendarService } from './modules/calendar/services/calendarService';
import { ReminderService } from './modules/calendar/services/reminderService';
import { NotificationSchedulerService } from './modules/calendar/services/notificationSchedulerService';
import { NotificationDispatcherService } from './modules/calendar/services/notificationDispatcherService';
import { CalendarController } from './modules/calendar/controllers/calendarController';
import { ReminderController } from './modules/calendar/controllers/reminderController';
import { NotificationController } from './modules/calendar/controllers/notificationController';
import { createCalendarRoutes } from './modules/calendar/routes/calendarRoutes';
import { startReminderProcessor } from './cron/reminderProcessor';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const PORT = Number(process.env.PORT) || 4000;


// Initialize models
const userModel = new UserModel();
const otpModel = new OtpModel();
const leadModel = new LeadModel();
const emailModel = new EmailModel();
const pipelineModel = new PipelineModel();
const pipelineStageModel = new PipelineStageModel();
const dealModel = new DealModel();
const dealHistoryModel = new DealHistoryModel();
const dealActivityModel = new DealActivityModel();
const organisationModel = new OrganizationModel();
const personModel = new PersonModel();
const productModel = new ProductModel();
const callModel = new CallModel();
const labelModel = new LabelModel();
const importModel = new ImportModel();
const draftModel = new DraftModel();

// Initialize calendar models
const calendarEventModel = new CalendarEventModel();
const eventReminderModel = new EventReminderModel();
const eventShareModel = new EventShareModel();
const eventNotificationModel = new EventNotificationModel();

// Initialize services
const leadService = new LeadService(leadModel);
const oauthService = new OAuthService();
const emailConnectorService = new EmailConnectorService(oauthService);
const notificationService = new RealTimeNotificationService();
const emailService = new EmailService(emailModel, emailConnectorService, notificationService, dealActivityModel);
const authService = new AuthService(userModel, otpModel, emailService, personModel);
const emailQueueService = new EmailQueueService(emailService, emailModel);
const pipelineService = new PipelineService(pipelineModel, pipelineStageModel);
const pipelineStageService = new PipelineStageService(pipelineStageModel, pipelineModel);
const dealService = new DealService(dealModel, dealHistoryModel, pipelineModel, pipelineStageModel, productModel, organisationModel, personModel, labelModel);
const productService = new ProductService(productModel);
const dealActivityService = new DealActivityService(dealActivityModel, dealModel, dealHistoryModel);
const organizationService = new OrganizationService(organisationModel);
const personService = new PersonService(personModel, organisationModel);
const labelService = new LabelService(labelModel);
const profileService = new ProfileService(userModel);
const callService = new CallService(callModel);
const importService = new ImportService();
const draftService = new DraftService(draftModel, emailService);

// Initialize calendar services
const notificationSchedulerService = new NotificationSchedulerService(eventNotificationModel, eventShareModel);
const calendarEventService = new CalendarService(calendarEventModel, eventReminderModel, eventShareModel, notificationSchedulerService);
const reminderCalendarService = new ReminderService(eventReminderModel, calendarEventModel, notificationSchedulerService);
const notificationDispatcherService = new NotificationDispatcherService(eventNotificationModel, calendarEventModel, emailService as any, userModel as any);
notificationDispatcherService.setSocketIO(io);

// Initialize enhanced email services
const configService = new MailSystemConfigService();
const quotaService = new QuotaValidationService();
const errorService = new ErrorHandlingService();

// Initialize Socket.IO
notificationService.initialize(io);

// Initialize enhanced mail system
configService.initializeSystem().catch(error => {
  console.error('Failed to initialize enhanced mail system:', error);
});

// Initialize instant notification services
imapIdleService.initialize(emailService, notificationService);
gmailPushService.initialize(emailService, notificationService);

// Initialize controllers
const authController = new AuthController(authService, userModel);
const leadController = new LeadController(leadService);
const emailController = new EmailController(emailService, oauthService, emailQueueService, notificationService, quotaService, draftService);
const trackingController = new EmailTrackingController(emailModel, notificationService);
const summarizationController = new SummarizationController(emailModel);
const pipelineController = new PipelineController(pipelineService, pipelineStageService);
const dealController = new DealController(dealService);
const productController = new ProductController(productService);
const activityController = new ActivityController(dealActivityService);
const organizationController = new OrganizationController(organizationService);
const personController = new PersonController(personService);
const labelController = new LabelController(labelService);
const profileController = new ProfileController(profileService);
const importController = new ImportController(importService);
const callController = new CallController(callService);
const draftController = new DraftController(draftService);
const webhookController = new WebhookController(callService);
webhookController.setSocketIO(io);

// Initialize AI agent module
const suggestionOrchestrator = new SuggestionOrchestratorService();
const suggestionController = new SuggestionController(suggestionOrchestrator);
const aiConfigController = new AIConfigController(new PricingModel(), new BrandGuidelinesModel(), new KnowledgeBaseModel());

// Initialize calendar controllers
const calendarController = new CalendarController(calendarEventService);
const reminderCalendarController = new ReminderController(reminderCalendarService);
const notificationCalendarController = new NotificationController(eventNotificationModel);

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(corsMiddleware);

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Routes
app.use('/api/auth', createAuthRoutes(authController));
app.use('/api/leads', createLeadRoutes(leadController));
app.use('/api/emails', createEmailRoutes(emailController, trackingController));
app.use('/api/email/drafts', createDraftRoutes(draftController));
app.use('/api/summarization', createSummarizationRoutes(summarizationController));
app.use('/api/pipelines', createPipelineRoutes(pipelineController));
app.use('/api/label', createLabelRoutes(labelController));
app.use('/api/deals', createDealRoutes(dealController));
app.use('/api/products', createProductRoutes(productController));
app.use('/api/activities', createActivityRoutes(activityController));
app.use('/api/organisations', createOrganizationRoutes(organizationController));
app.use('/api/persons', createPersonRoutes(personController));
app.use('/api/profile', createProfileRoutes(profileController));
app.use('/api/calls', createCallRoutes(callController));
app.use('/api/webhooks/twilio', createWebhookRoutes(webhookController));
app.use('/api/import', createImportRoutes(importController));
app.use('/api/ai', createSuggestionRoutes(suggestionController, aiConfigController));
app.use('/api/webhooks/email', createEmailWebhookRoutes());
app.use('/api/calendar', createCalendarRoutes(calendarController, reminderCalendarController, notificationCalendarController));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});


// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Start cron jobs
startTokenRefreshJob();
startEmailSyncJob(notificationService);
startReminderProcessor(notificationDispatcherService);
startTrashCleanupJob();

// Helper function to get all active email accounts via EmailModel
const getActiveEmailAccounts = async () => {
  return await emailModel.getAllActiveAccounts();
};

// Start IMAP IDLE for all IMAP accounts
imapIdleService.startMonitoringAllAccounts(getActiveEmailAccounts).catch(error => {
  console.warn('⚠️ IMAP IDLE failed to start:', error);
});

// Start Gmail Push notifications
if (process.env.GMAIL_PUBSUB_TOPIC) {
  gmailPushService.startWatchingAllAccounts(getActiveEmailAccounts).catch(error => {
    console.warn('⚠️ Gmail Push failed to start:', error);
  });
}

// Optional: Start Redis-based queue if available
try {
  const summarizationScheduler = startSummarizationScheduler();
  console.log('📧 Summarization scheduler started');

  process.on('SIGTERM', () => {
    summarizationScheduler.stop();
  });
} catch (error) {
  console.log('ℹ️ Redis not available - summarization scheduler skipped');
}

// Graceful shutdown handler
const shutdown = async () => {
  console.log('Shutting down gracefully...');
  await imapIdleService.stopAll();
  await gmailPushService.stopAll();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
