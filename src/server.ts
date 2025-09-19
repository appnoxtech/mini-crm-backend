import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Database from 'better-sqlite3';
import { corsMiddleware } from './shared/middleware/auth';

// Load environment variables
dotenv.config();

// Import models
import { UserModel } from './modules/auth/models/User';
import { LeadModel } from './modules/leads/models/Lead';
import { EmailModel } from './modules/email/models/emailModel';

// Import services
import { AuthService } from './modules/auth/services/authService';
import { LeadService } from './modules/leads/services/leadService';
import { EmailService } from './modules/email/services/emailService';
import { EmailConnectorService } from './modules/email/services/emailConnectorService';
import { OAuthService } from './modules/email/services/oauthService';
import { EmailQueueService } from './modules/email/services/emailQueueService';
import { RealTimeNotificationService } from './modules/email/services/realTimeNotificationService';

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

// Import routes
import { createAuthRoutes } from './modules/auth/routes/authRoutes';
import { createLeadRoutes } from './modules/leads/routes/leadRoutes';
import { createEmailRoutes } from './modules/email/routes/emailRoutes';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});
const PORT = Number(process.env.PORT) || 3000;

// Initialize database
const db = new Database('data.db');
db.pragma('foreign_keys = ON');

// Initialize models
const userModel = new UserModel(db);
const leadModel = new LeadModel(db);
const emailModel = new EmailModel(db);

// Initialize database tables
userModel.initialize();
leadModel.initialize();
emailModel.initialize();

// Initialize services
const authService = new AuthService(userModel);
const leadService = new LeadService(leadModel);
const oauthService = new OAuthService();
const emailConnectorService = new EmailConnectorService(oauthService);
const notificationService = new RealTimeNotificationService();
const emailService = new EmailService(emailModel, emailConnectorService, notificationService);
const emailQueueService = new EmailQueueService(emailService, emailModel);

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
// app.use('/api/emails/enhanced', createEnhancedEmailRoutes(enhancedEmailController));

// Health check endpoint
app.get('/health', (req, res) => {
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Socket.IO initialized for real-time notifications');
});


