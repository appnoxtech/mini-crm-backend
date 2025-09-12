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
// Load environment variables
dotenv_1.default.config();
// Import models
const User_1 = require("./modules/auth/models/User");
const Lead_1 = require("./modules/leads/models/Lead");
const emailModel_1 = require("./modules/email/models/emailModel");
// Import services
const authService_1 = require("./modules/auth/services/authService");
const leadService_1 = require("./modules/leads/services/leadService");
const emailService_1 = require("./modules/email/services/emailService");
const emailConnectorService_1 = require("./modules/email/services/emailConnectorService");
const oauthService_1 = require("./modules/email/services/oauthService");
const emailQueueService_1 = require("./modules/email/services/emailQueueService");
const realTimeNotificationService_1 = require("./modules/email/services/realTimeNotificationService");
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
// Import routes
const authRoutes_1 = require("./modules/auth/routes/authRoutes");
const leadRoutes_1 = require("./modules/leads/routes/leadRoutes");
const emailRoutes_1 = require("./modules/email/routes/emailRoutes");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});
const PORT = Number(process.env.PORT) || 3000;
// Initialize database
const db = new better_sqlite3_1.default('data.db');
db.pragma('foreign_keys = ON');
// Initialize models
const userModel = new User_1.UserModel(db);
const leadModel = new Lead_1.LeadModel(db);
const emailModel = new emailModel_1.EmailModel(db);
// Initialize database tables
userModel.initialize();
leadModel.initialize();
emailModel.initialize();
// Initialize services
const authService = new authService_1.AuthService(userModel);
const leadService = new leadService_1.LeadService(leadModel);
const oauthService = new oauthService_1.OAuthService();
const emailConnectorService = new emailConnectorService_1.EmailConnectorService(oauthService);
const notificationService = new realTimeNotificationService_1.RealTimeNotificationService();
const emailService = new emailService_1.EmailService(emailModel, emailConnectorService, notificationService);
const emailQueueService = new emailQueueService_1.EmailQueueService(emailService, emailModel);
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
// const enhancedEmailController = new EnhancedEmailController(
//   emailService,
//   configService,
//   quotaService,
//   composerService,
//   gmailService,
//   trackingService,
//   errorService
// );
// Middleware
app.use(express_1.default.json());
app.use(auth_1.corsMiddleware);
// Routes
app.use('/api/auth', (0, authRoutes_1.createAuthRoutes)(authController));
app.use('/api/leads', (0, leadRoutes_1.createLeadRoutes)(leadController));
app.use('/api/emails', (0, emailRoutes_1.createEmailRoutes)(emailController));
// app.use('/api/emails/enhanced', createEnhancedEmailRoutes(enhancedEmailController));
// Health check endpoint
app.get('/health', (req, res) => {
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
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check (localhost): http://localhost:${PORT}/health`);
    console.log(`Health check (network): http://192.168.68.110:${PORT}/health`);
    console.log('Socket.IO initialized for real-time notifications');
});
//# sourceMappingURL=server.js.map