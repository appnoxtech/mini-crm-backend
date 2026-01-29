import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Database from 'better-sqlite3';
import { corsMiddleware } from './shared/middleware/auth';
import { startThreadSummaryJob } from './cron/summarizeThreads';
import { startEmailSyncJob } from './cron/emailSync';
import { startTokenRefreshJob } from './cron/tokenRefresh';
import { startRunPodJobProcessor } from './cron/runpodJobProcessor';
import os from 'os';

// Load environment variables
dotenv.config();

// Import models
import { UserModel } from './modules/auth/models/User';
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

// Import enhanced email services
import { MailSystemConfigService } from './modules/email/services/mailSystemConfig';
import { QuotaValidationService } from './modules/email/services/quotaValidationService';
import { EnhancedEmailComposer } from './modules/email/services/enhancedEmailComposer';
import { EnhancedGmailService } from './modules/email/services/enhancedGmailService';
import { EmailTrackingService } from './modules/email/services/emailTrackingService';
import { ErrorHandlingService } from './modules/email/services/errorHandlingService';
import { BulkEmailService } from './modules/email/services/bulkEmailService';

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

// Import summarization services
import { SummarizationController } from './modules/email/controllers/summarizationController';
import { startSummarizationScheduler } from './modules/email/services/summarizationSchedulerService';
import { LabelService } from './modules/pipelines/services/labelService';
import { LabelModel } from './modules/pipelines/models/Label';
import { LabelController } from './modules/pipelines/controllers/labelController';
import { OrganizationService } from './modules/management/organisations/services/OrganizationService';

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


const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*", // Allow all origins
    methods: ["GET", "POST"]
  }
});
const PORT = Number(process.env.PORT) || 4000;
const DB_PATH = './data.db';

// Initialize database
const db = new Database('data.db');
db.pragma('foreign_keys = ON');

// Initialize models
const userModel = new UserModel(db);
const leadModel = new LeadModel(db);
const emailModel = new EmailModel(db);
const pipelineModel = new PipelineModel(db);
const pipelineStageModel = new PipelineStageModel(db);
const dealModel = new DealModel(db);
const dealHistoryModel = new DealHistoryModel(db);
const dealActivityModel = new DealActivityModel(db);
const organisationModel = new OrganizationModel(db);
const personModel = new PersonModel(db);
const productModel = new ProductModel(db);
const callModel = new CallModel(db);
const labelModel = new LabelModel(db);



// db.exec(`DROP TABLE IF EXISTS deals`);
// db.exec(`DROP TABLE IF EXISTS emails`);
// db.exec(`DROP TABLE IF EXISTS email_accounts`);

// Initialize database tables
userModel.initialize();
leadModel.initialize();
emailModel.initialize();
emailModel.initializeHistoricalSyncSchema(); // Initialize UID tracking for historical sync
pipelineModel.initialize();
pipelineStageModel.initialize();
dealModel.initialize();
dealHistoryModel.initialize();
dealActivityModel.initialize();
organisationModel.initialize();
personModel.initialize();
labelModel.initialize();
productModel.initialize();
callModel.initialize();

// Initialize import model
const importModel = new ImportModel(db);
importModel.initialize();



// Initialize services
const authService = new AuthService(userModel);
const leadService = new LeadService(leadModel);
const oauthService = new OAuthService();
const emailConnectorService = new EmailConnectorService(oauthService);
const notificationService = new RealTimeNotificationService();
const emailService = new EmailService(emailModel, emailConnectorService, notificationService, dealActivityModel);
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

// Initialize call service
const callService = new CallService(callModel);

// Initialize enhanced email services
const configService = new MailSystemConfigService();
const quotaService = new QuotaValidationService();
const composerService = new EnhancedEmailComposer();
const gmailService = new EnhancedGmailService();
const trackingService = new EmailTrackingService(undefined, notificationService);
const errorService = new ErrorHandlingService();
const bulkEmailService = new BulkEmailService(
  composerService,
  gmailService,
  trackingService,
  quotaService,
  errorService
);

// Initialize Socket.IO with notification service
notificationService.initialize(io);

// Initialize enhanced mail system
configService.initializeSystem().then(result => {

}).catch(error => {
  console.error('Failed to initialize enhanced mail system:', error);
});

// Initialize instant notification services
imapIdleService.initialize(emailService, notificationService);
gmailPushService.initialize(emailService, notificationService);

// Initialize controllers
const authController = new AuthController(authService, userModel);
const leadController = new LeadController(leadService);
const emailController = new EmailController(emailService, oauthService, emailQueueService, notificationService);
const summarizationController = new SummarizationController(emailModel, DB_PATH);
const pipelineController = new PipelineController(pipelineService, pipelineStageService);
const dealController = new DealController(dealService);
const productController = new ProductController(productService);
const activityController = new ActivityController(dealActivityService);
const organizationController = new OrganizationController(organizationService);
const personController = new PersonController(personService);
const labelController = new LabelController(labelService);
const profileController = new ProfileController(profileService);

// Initialize import service and controller
const importService = new ImportService(db);
const importController = new ImportController(importService);

// Initialize call controllers
const callController = new CallController(callService);
const webhookController = new WebhookController(callService);
webhookController.setSocketIO(io);

// Initialize AI agent module
const suggestionOrchestrator = new SuggestionOrchestratorService(db);
const suggestionController = new SuggestionController(suggestionOrchestrator);
const aiConfigController = new AIConfigController(new PricingModel(db), new BrandGuidelinesModel(db), new KnowledgeBaseModel(db));

// Middleware
app.use(express.json());
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
app.use('/api/emails', createEmailRoutes(emailController));
app.use('/api/summarization', createSummarizationRoutes(summarizationController));




// Pipeline module routes
app.use('/api/pipelines', createPipelineRoutes(pipelineController));
app.use('/api/label', createLabelRoutes(labelController));
app.use('/api/deals', createDealRoutes(dealController));
app.use('/api/products', createProductRoutes(productController));
app.use('/api/deals-activities', createActivityRoutes(activityController)); // Deal-specific activities
app.use('/api/activities', createActivityRoutes(activityController)); // User-level activities

// Management module routes
app.use('/api/organisations', createOrganizationRoutes(organizationController));
app.use('/api/persons', createPersonRoutes(personController));
app.use('/api/profile', createProfileRoutes(profileController));

// Call module routes
app.use('/api/calls', createCallRoutes(callController));
app.use('/api/webhooks/twilio', createWebhookRoutes(webhookController));

// Import module routes
app.use('/api/import', createImportRoutes(importController));

// AI agent module routes
app.use('/api/ai', createSuggestionRoutes(suggestionController, aiConfigController));
// Email webhook routes (Gmail Pub/Sub push notifications)
app.use('/api/webhooks/email', createEmailWebhookRoutes());

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



function getLocalIP(): string {
  const interfaces = os.networkInterfaces();

  for (const name in interfaces) {
    const nets = interfaces[name];
    if (!nets) continue;

    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }

  return 'localhost';
}


const localIP = getLocalIP();

// Start the server
server.listen(PORT, '0.0.0.0', () => {

});


// Start cron jobs

// startThreadSummaryJob(DB_PATH);

// // Start email sync cron job (syncs every 5 minutes)
// startEmailSyncJob(DB_PATH, notificationService);


// Start token refresh cron job (refreshes every 6 hours to prevent expiration)
startTokenRefreshJob(DB_PATH);


// Start RunPod async job processor (NO REDIS REQUIRED!)
// This uses RunPod's built-in async queue for cost-efficient serverless processing
// try {
//   startRunPodJobProcessor(DB_PATH);

// } catch (error) {
//   console.warn('⚠️ RunPod job processor failed to start:', error);
// }

// Start instant email notification services
// Helper function to get all active email accounts
const getActiveEmailAccounts = async () => {
  const accounts = db.prepare(`
    SELECT * FROM email_accounts WHERE isActive = 1
  `).all() as any[];

  return accounts.map((row: any) => ({
    id: row.id,
    userId: row.userId,
    email: row.email,
    provider: row.provider,
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    imapConfig: row.imapConfig ? JSON.parse(row.imapConfig) : undefined,
    smtpConfig: row.smtpConfig ? JSON.parse(row.smtpConfig) : undefined,
    isActive: Boolean(row.isActive),
    lastSyncAt: row.lastSyncAt ? new Date(row.lastSyncAt) : undefined,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }));
};

// Start IMAP IDLE for all IMAP accounts (instant notifications)
imapIdleService.startMonitoringAllAccounts(getActiveEmailAccounts).then(() => {

}).catch(error => {
  console.warn('⚠️ IMAP IDLE failed to start:', error);
});

// Start Gmail Push notifications (if GMAIL_PUBSUB_TOPIC is configured)
if (process.env.GMAIL_PUBSUB_TOPIC) {
  gmailPushService.startWatchingAllAccounts(getActiveEmailAccounts).then(() => {

  }).catch(error => {
    console.warn('⚠️ Gmail Push failed to start:', error);
  });
} else {

}

// Graceful shutdown handler for instant notification services
process.on('SIGTERM', async () => {

  await imapIdleService.stopAll();
  await gmailPushService.stopAll();
  process.exit(0);
});

process.on('SIGINT', async () => {

  await imapIdleService.stopAll();
  await gmailPushService.stopAll();
  process.exit(0);
});

// Optional: Also try to start Redis-based queue if available
// try {
//   const summarizationScheduler = startSummarizationScheduler(DB_PATH);
//   console.log('📧 Redis-based summarization scheduler also started');

//   // Graceful shutdown handler
//   process.on('SIGTERM', () => {
//     console.log('SIGTERM received, shutting down gracefully...');
//     summarizationScheduler.stop();
//     process.exit(0);
//   });
// } catch (error) {
//   console.log('ℹ️  Redis not available - using RunPod async mode only (this is fine!)');
// }

