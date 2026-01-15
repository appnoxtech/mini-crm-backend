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
import { OrganisationModel } from './modules/management/organisations/models/Organisation';
import { PersonModel } from './modules/management/persons/models/Person';

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
import { DealActivityService } from './modules/pipelines/services/dealActivityService';
import { OrganisationService } from './modules/management/organisations/services/OrganisationService';
import { PersonService } from './modules/management/persons/services/PersonService';

// Import enhanced email services
import { MailSystemConfigService } from './modules/email/services/mailSystemConfig';
import { QuotaValidationService } from './modules/email/services/quotaValidationService';
import { EnhancedEmailComposer } from './modules/email/services/enhancedEmailComposer';
import { EnhancedGmailService } from './modules/email/services/enhancedGmailService';
import { EmailTrackingService } from './modules/email/services/emailTrackingService';
import { ErrorHandlingService } from './modules/email/services/errorHandlingService';
import { BulkEmailService } from './modules/email/services/bulkEmailService';

// Import controllers
import { AuthController } from './modules/auth/controllers/authController';
import { LeadController } from './modules/leads/controllers/leadController';
import { EmailController } from './modules/email/controllers/emailController';
import { PipelineController } from './modules/pipelines/controllers/pipelineController';
import { DealController } from './modules/pipelines/controllers/dealController';
import { ActivityController } from './modules/pipelines/controllers/activityController';
import { OrganisationController } from './modules/management/organisations/controllers/OrganisationController';
import { PersonController } from './modules/management/persons/controllers/PersonController';

// Import routes
import { createAuthRoutes } from './modules/auth/routes/authRoutes';
import { createLeadRoutes } from './modules/leads/routes/leadRoutes';
import { createEmailRoutes } from './modules/email/routes/emailRoutes';
import { createSummarizationRoutes } from './modules/email/routes/summarizationRoutes';
import { createPipelineRoutes } from './modules/pipelines/routes/pipelineRoutes';
import { createDealRoutes } from './modules/pipelines/routes/dealRoutes';
import { createActivityRoutes } from './modules/pipelines/routes/activityRoutes';
import { createOrganisationRoutes } from './modules/management/organisations/routes/organisationRoutes';
import { createPersonRoutes } from './modules/management/persons/routes/personRoutes';

// Import summarization services
import { SummarizationController } from './modules/email/controllers/summarizationController';
import { startSummarizationScheduler } from './modules/email/services/summarizationSchedulerService';


const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
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
const organisationModel = new OrganisationModel(db);
const personModel = new PersonModel(db);

// Initialize database tables
userModel.initialize();
leadModel.initialize();
emailModel.initialize();
pipelineModel.initialize();
pipelineStageModel.initialize();
dealModel.initialize();
dealHistoryModel.initialize();
dealActivityModel.initialize();
organisationModel.initialize();
personModel.initialize();

// Initialize services
const authService = new AuthService(userModel);
const leadService = new LeadService(leadModel);
const oauthService = new OAuthService();
const emailConnectorService = new EmailConnectorService(oauthService);
const notificationService = new RealTimeNotificationService();
const emailService = new EmailService(emailModel, emailConnectorService, notificationService);
const emailQueueService = new EmailQueueService(emailService, emailModel);
const pipelineService = new PipelineService(pipelineModel, pipelineStageModel);
const pipelineStageService = new PipelineStageService(pipelineStageModel, pipelineModel);
const dealService = new DealService(dealModel, dealHistoryModel, pipelineModel, pipelineStageModel);
const dealActivityService = new DealActivityService(dealActivityModel, dealModel);
const organisationService = new OrganisationService(organisationModel);
const personService = new PersonService(personModel, organisationModel);

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
  console.log('Enhanced mail system initialization:', result);
}).catch(error => {
  console.error('Failed to initialize enhanced mail system:', error);
});

// Initialize controllers
const authController = new AuthController(authService, userModel);
const leadController = new LeadController(leadService);
const emailController = new EmailController(emailService, oauthService, emailQueueService, notificationService);
const summarizationController = new SummarizationController(emailModel, DB_PATH);
const pipelineController = new PipelineController(pipelineService, pipelineStageService);
const dealController = new DealController(dealService);
const activityController = new ActivityController(dealActivityService);
const organisationController = new OrganisationController(organisationService);
const personController = new PersonController(personService);

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
app.use('/api/deals', createDealRoutes(dealController));
app.use('/api/deals', createActivityRoutes(activityController)); // Deal-specific activities
app.use('/api/activities', createActivityRoutes(activityController)); // User-level activities

// Management module routes
app.use('/api/organisations', createOrganisationRoutes(organisationController));
app.use('/api/persons', createPersonRoutes(personController));

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
  console.log(`Server running on port ${PORT}`);
  console.log(`➡ Local:   http://localhost:${PORT}`);
  console.log(`➡ Network: http://${localIP}:${PORT}`);
  console.log('Socket.IO initialized for real-time notifications');
});


// Start cron jobs

startThreadSummaryJob(DB_PATH);

// Start email sync cron job (syncs every 5 minutes)
startEmailSyncJob(DB_PATH, notificationService);
console.log('Email sync cron job started');

// Start token refresh cron job (refreshes every 6 hours to prevent expiration)
startTokenRefreshJob(DB_PATH);
console.log('Token refresh cron job started');

// Start RunPod async job processor (NO REDIS REQUIRED!)
// This uses RunPod's built-in async queue for cost-efficient serverless processing
try {
  startRunPodJobProcessor(DB_PATH);
  console.log('📧 RunPod async job processor started (no Redis needed!)');
} catch (error) {
  console.warn('⚠️ RunPod job processor failed to start:', error);
}

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

