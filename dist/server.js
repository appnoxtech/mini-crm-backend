"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const auth_1 = require("./shared/middleware/auth");
const summarizeThreads_1 = require("./cron/summarizeThreads");
const emailSync_1 = require("./cron/emailSync");
const tokenRefresh_1 = require("./cron/tokenRefresh");
const runpodJobProcessor_1 = require("./cron/runpodJobProcessor");
const os_1 = __importDefault(require("os"));
// Load environment variables
dotenv_1.default.config();
// Import models
const User_1 = require("./modules/auth/models/User");
const Lead_1 = require("./modules/leads/models/Lead");
const emailModel_1 = require("./modules/email/models/emailModel");
const Pipeline_1 = require("./modules/pipelines/models/Pipeline");
const PipelineStage_1 = require("./modules/pipelines/models/PipelineStage");
const Deal_1 = require("./modules/pipelines/models/Deal");
const DealHistory_1 = require("./modules/pipelines/models/DealHistory");
const DealActivity_1 = require("./modules/pipelines/models/DealActivity");
const Organisation_1 = require("./modules/management/organisations/models/Organisation");
const Person_1 = require("./modules/management/persons/models/Person");
const Product_1 = require("./modules/pipelines/models/Product");
// Import services
const authService_1 = require("./modules/auth/services/authService");
const leadService_1 = require("./modules/leads/services/leadService");
const emailService_1 = require("./modules/email/services/emailService");
const emailConnectorService_1 = require("./modules/email/services/emailConnectorService");
const oauthService_1 = require("./modules/email/services/oauthService");
const emailQueueService_1 = require("./modules/email/services/emailQueueService");
const realTimeNotificationService_1 = require("./modules/email/services/realTimeNotificationService");
const pipelineService_1 = require("./modules/pipelines/services/pipelineService");
const pipelineStageService_1 = require("./modules/pipelines/services/pipelineStageService");
const dealService_1 = require("./modules/pipelines/services/dealService");
const productService_1 = require("./modules/pipelines/services/productService");
const dealActivityService_1 = require("./modules/pipelines/services/dealActivityService");
const PersonService_1 = require("./modules/management/persons/services/PersonService");
// Import enhanced email services
const mailSystemConfig_1 = require("./modules/email/services/mailSystemConfig");
const quotaValidationService_1 = require("./modules/email/services/quotaValidationService");
const enhancedEmailComposer_1 = require("./modules/email/services/enhancedEmailComposer");
const enhancedGmailService_1 = require("./modules/email/services/enhancedGmailService");
const emailTrackingService_1 = require("./modules/email/services/emailTrackingService");
const errorHandlingService_1 = require("./modules/email/services/errorHandlingService");
const bulkEmailService_1 = require("./modules/email/services/bulkEmailService");
// Import controllers
const authController_1 = require("./modules/auth/controllers/authController");
const leadController_1 = require("./modules/leads/controllers/leadController");
const emailController_1 = require("./modules/email/controllers/emailController");
const pipelineController_1 = require("./modules/pipelines/controllers/pipelineController");
const dealController_1 = require("./modules/pipelines/controllers/dealController");
const productController_1 = require("./modules/pipelines/controllers/productController");
const activityController_1 = require("./modules/pipelines/controllers/activityController");
const OrganisationController_1 = require("./modules/management/organisations/controllers/OrganisationController");
const PersonController_1 = require("./modules/management/persons/controllers/PersonController");
// Import routes
const authRoutes_1 = require("./modules/auth/routes/authRoutes");
const leadRoutes_1 = require("./modules/leads/routes/leadRoutes");
const emailRoutes_1 = require("./modules/email/routes/emailRoutes");
const summarizationRoutes_1 = require("./modules/email/routes/summarizationRoutes");
const pipelineRoutes_1 = require("./modules/pipelines/routes/pipelineRoutes");
const dealRoutes_1 = require("./modules/pipelines/routes/dealRoutes");
const productRoutes_1 = require("./modules/pipelines/routes/productRoutes");
const activityRoutes_1 = require("./modules/pipelines/routes/activityRoutes");
const organisationRoutes_1 = require("./modules/management/organisations/routes/organisationRoutes");
const personRoutes_1 = require("./modules/management/persons/routes/personRoutes");
const lavelRoutes_1 = require("./modules/pipelines/routes/lavelRoutes");
// Import summarization services
const summarizationController_1 = require("./modules/email/controllers/summarizationController");
const lavelService_1 = require("./modules/pipelines/services/lavelService");
const Lavel_1 = require("./modules/pipelines/models/Lavel");
const lavelController_1 = require("./modules/pipelines/controllers/lavelController");
const OrganizationService_1 = require("./modules/management/organisations/services/OrganizationService");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*", // Allow all origins
        methods: ["GET", "POST"]
    }
});
const PORT = Number(process.env.PORT) || 4000;
const DB_PATH = './data.db';
// Initialize database
const db = new better_sqlite3_1.default('data.db');
db.pragma('foreign_keys = ON');
// Initialize models
const userModel = new User_1.UserModel(db);
const leadModel = new Lead_1.LeadModel(db);
const emailModel = new emailModel_1.EmailModel(db);
const pipelineModel = new Pipeline_1.PipelineModel(db);
const pipelineStageModel = new PipelineStage_1.PipelineStageModel(db);
const dealModel = new Deal_1.DealModel(db);
const dealHistoryModel = new DealHistory_1.DealHistoryModel(db);
const dealActivityModel = new DealActivity_1.DealActivityModel(db);
const organisationModel = new Organisation_1.OrganizationModel(db);
const personModel = new Person_1.PersonModel(db);
const productModel = new Product_1.ProductModel(db);
const lavelModel = new Lavel_1.LavelModel(db);
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
lavelModel.initialize();
productModel.initialize();
// db.exec(`DROP TABLE IF EXISTS deals`);
// Initialize services
const authService = new authService_1.AuthService(userModel);
const leadService = new leadService_1.LeadService(leadModel);
const oauthService = new oauthService_1.OAuthService();
const emailConnectorService = new emailConnectorService_1.EmailConnectorService(oauthService);
const notificationService = new realTimeNotificationService_1.RealTimeNotificationService();
const emailService = new emailService_1.EmailService(emailModel, emailConnectorService, notificationService);
const emailQueueService = new emailQueueService_1.EmailQueueService(emailService, emailModel);
const pipelineService = new pipelineService_1.PipelineService(pipelineModel, pipelineStageModel);
const pipelineStageService = new pipelineStageService_1.PipelineStageService(pipelineStageModel, pipelineModel);
const dealService = new dealService_1.DealService(dealModel, dealHistoryModel, pipelineModel, pipelineStageModel, productModel, organisationModel, personModel);
const productService = new productService_1.ProductService(productModel);
const dealActivityService = new dealActivityService_1.DealActivityService(dealActivityModel, dealModel);
const organisationService = new OrganizationService_1.OrganizationService(organisationModel);
const personService = new PersonService_1.PersonService(personModel, organisationModel);
const lavelService = new lavelService_1.LavelService(lavelModel);
// Initialize enhanced email services
const configService = new mailSystemConfig_1.MailSystemConfigService();
const quotaService = new quotaValidationService_1.QuotaValidationService();
const composerService = new enhancedEmailComposer_1.EnhancedEmailComposer();
const gmailService = new enhancedGmailService_1.EnhancedGmailService();
const trackingService = new emailTrackingService_1.EmailTrackingService(undefined, notificationService);
const errorService = new errorHandlingService_1.ErrorHandlingService();
const bulkEmailService = new bulkEmailService_1.BulkEmailService(composerService, gmailService, trackingService, quotaService, errorService);
// Initialize Socket.IO with notification service
notificationService.initialize(io);
// Initialize enhanced mail system
configService.initializeSystem().then(result => {
    console.log('Enhanced mail system initialization:', result);
}).catch(error => {
    console.error('Failed to initialize enhanced mail system:', error);
});
// Initialize controllers
const authController = new authController_1.AuthController(authService, userModel);
const leadController = new leadController_1.LeadController(leadService);
const emailController = new emailController_1.EmailController(emailService, oauthService, emailQueueService, notificationService);
const summarizationController = new summarizationController_1.SummarizationController(emailModel, DB_PATH);
const pipelineController = new pipelineController_1.PipelineController(pipelineService, pipelineStageService);
const dealController = new dealController_1.DealController(dealService);
const productController = new productController_1.ProductController(productService);
const activityController = new activityController_1.ActivityController(dealActivityService);
const organisationController = new OrganisationController_1.OrganisationController(organisationService);
const personController = new PersonController_1.PersonController(personService);
const lavelController = new lavelController_1.LavelController(lavelService);
// Middleware
app.use(express_1.default.json());
app.use(auth_1.corsMiddleware);
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS')
        return res.sendStatus(200);
    next();
});
// Routes
app.use('/api/auth', (0, authRoutes_1.createAuthRoutes)(authController));
app.use('/api/leads', (0, leadRoutes_1.createLeadRoutes)(leadController));
app.use('/api/emails', (0, emailRoutes_1.createEmailRoutes)(emailController));
app.use('/api/summarization', (0, summarizationRoutes_1.createSummarizationRoutes)(summarizationController));
// Pipeline module routes
app.use('/api/pipelines', (0, pipelineRoutes_1.createPipelineRoutes)(pipelineController));
app.use('/api/lavel', (0, lavelRoutes_1.createLavelRoutes)(lavelController));
app.use('/api/deals', (0, dealRoutes_1.createDealRoutes)(dealController));
app.use('/api/products', (0, productRoutes_1.createProductRoutes)(productController));
app.use('/api/deals', (0, activityRoutes_1.createActivityRoutes)(activityController)); // Deal-specific activities
app.use('/api/activities', (0, activityRoutes_1.createActivityRoutes)(activityController)); // User-level activities
// Management module routes
app.use('/api/organisations', (0, organisationRoutes_1.createOrganisationRoutes)(organisationController));
app.use('/api/persons', (0, personRoutes_1.createPersonRoutes)(personController));
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
function getLocalIP() {
    const interfaces = os_1.default.networkInterfaces();
    for (const name in interfaces) {
        const nets = interfaces[name];
        if (!nets)
            continue;
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
(0, summarizeThreads_1.startThreadSummaryJob)(DB_PATH);
// Start email sync cron job (syncs every 5 minutes)
(0, emailSync_1.startEmailSyncJob)(DB_PATH, notificationService);
console.log('Email sync cron job started');
// Start token refresh cron job (refreshes every 6 hours to prevent expiration)
(0, tokenRefresh_1.startTokenRefreshJob)(DB_PATH);
console.log('Token refresh cron job started');
// Start RunPod async job processor (NO REDIS REQUIRED!)
// This uses RunPod's built-in async queue for cost-efficient serverless processing
try {
    (0, runpodJobProcessor_1.startRunPodJobProcessor)(DB_PATH);
    console.log('📧 RunPod async job processor started (no Redis needed!)');
}
catch (error) {
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
//# sourceMappingURL=server.js.map