"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkEmailService = exports.ErrorHandlingService = exports.EmailTrackingService = exports.EnhancedGmailService = exports.EnhancedEmailComposer = exports.QuotaValidationService = exports.MailSystemConfigService = exports.createDraftRoutes = exports.DraftController = exports.DraftService = exports.DraftModel = exports.createEmailRoutes = exports.EmailController = exports.EmailConnectorService = exports.EmailService = exports.EmailModel = void 0;
// Email module exports
var emailModel_1 = require("./models/emailModel");
Object.defineProperty(exports, "EmailModel", { enumerable: true, get: function () { return emailModel_1.EmailModel; } });
var emailService_1 = require("./services/emailService");
Object.defineProperty(exports, "EmailService", { enumerable: true, get: function () { return emailService_1.EmailService; } });
var emailConnectorService_1 = require("./services/emailConnectorService");
Object.defineProperty(exports, "EmailConnectorService", { enumerable: true, get: function () { return emailConnectorService_1.EmailConnectorService; } });
var emailController_1 = require("./controllers/emailController");
Object.defineProperty(exports, "EmailController", { enumerable: true, get: function () { return emailController_1.EmailController; } });
var emailRoutes_1 = require("./routes/emailRoutes");
Object.defineProperty(exports, "createEmailRoutes", { enumerable: true, get: function () { return emailRoutes_1.createEmailRoutes; } });
// Draft module exports
var draftModel_1 = require("./models/draftModel");
Object.defineProperty(exports, "DraftModel", { enumerable: true, get: function () { return draftModel_1.DraftModel; } });
var draftService_1 = require("./services/draftService");
Object.defineProperty(exports, "DraftService", { enumerable: true, get: function () { return draftService_1.DraftService; } });
var draftController_1 = require("./controllers/draftController");
Object.defineProperty(exports, "DraftController", { enumerable: true, get: function () { return draftController_1.DraftController; } });
var draftRoutes_1 = require("./routes/draftRoutes");
Object.defineProperty(exports, "createDraftRoutes", { enumerable: true, get: function () { return draftRoutes_1.createDraftRoutes; } });
// Enhanced email functionality exports
var mailSystemConfig_1 = require("./services/mailSystemConfig");
Object.defineProperty(exports, "MailSystemConfigService", { enumerable: true, get: function () { return mailSystemConfig_1.MailSystemConfigService; } });
var quotaValidationService_1 = require("./services/quotaValidationService");
Object.defineProperty(exports, "QuotaValidationService", { enumerable: true, get: function () { return quotaValidationService_1.QuotaValidationService; } });
var enhancedEmailComposer_1 = require("./services/enhancedEmailComposer");
Object.defineProperty(exports, "EnhancedEmailComposer", { enumerable: true, get: function () { return enhancedEmailComposer_1.EnhancedEmailComposer; } });
var enhancedGmailService_1 = require("./services/enhancedGmailService");
Object.defineProperty(exports, "EnhancedGmailService", { enumerable: true, get: function () { return enhancedGmailService_1.EnhancedGmailService; } });
var emailTrackingService_1 = require("./services/emailTrackingService");
Object.defineProperty(exports, "EmailTrackingService", { enumerable: true, get: function () { return emailTrackingService_1.EmailTrackingService; } });
var errorHandlingService_1 = require("./services/errorHandlingService");
Object.defineProperty(exports, "ErrorHandlingService", { enumerable: true, get: function () { return errorHandlingService_1.ErrorHandlingService; } });
var bulkEmailService_1 = require("./services/bulkEmailService");
Object.defineProperty(exports, "BulkEmailService", { enumerable: true, get: function () { return bulkEmailService_1.BulkEmailService; } });
//# sourceMappingURL=index.js.map