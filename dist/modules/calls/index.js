"use strict";
/**
 * Calls Module
 *
 * This module handles all call-related functionality including:
 * - Initiating and receiving calls via Twilio
 * - Call recording and transcription
 * - Real-time call updates via WebSocket
 * - Call history and analytics
 *
 * Components:
 * - Model: Database operations for calls, recordings, participants, events
 * - Services: Business logic for call operations and Twilio integration
 * - Controllers: HTTP request handlers
 * - Routes: API endpoint definitions
 * - Socket: Real-time WebSocket events
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebhookRoutes = exports.createCallRoutes = exports.WebhookController = exports.CallController = exports.getCallSocketService = exports.CallSocketService = exports.CallService = exports.getTwilioService = exports.TwilioService = exports.getWebhookUrls = exports.validateTwilioConfig = exports.getTwilioConfig = exports.CallModel = void 0;
// Models
var Call_1 = require("./models/Call");
Object.defineProperty(exports, "CallModel", { enumerable: true, get: function () { return Call_1.CallModel; } });
// Types
__exportStar(require("./types"), exports);
// Config
var twilioConfig_1 = require("./config/twilioConfig");
Object.defineProperty(exports, "getTwilioConfig", { enumerable: true, get: function () { return twilioConfig_1.getTwilioConfig; } });
Object.defineProperty(exports, "validateTwilioConfig", { enumerable: true, get: function () { return twilioConfig_1.validateTwilioConfig; } });
Object.defineProperty(exports, "getWebhookUrls", { enumerable: true, get: function () { return twilioConfig_1.getWebhookUrls; } });
// Services
var twilioService_1 = require("./services/twilioService");
Object.defineProperty(exports, "TwilioService", { enumerable: true, get: function () { return twilioService_1.TwilioService; } });
Object.defineProperty(exports, "getTwilioService", { enumerable: true, get: function () { return twilioService_1.getTwilioService; } });
var callService_1 = require("./services/callService");
Object.defineProperty(exports, "CallService", { enumerable: true, get: function () { return callService_1.CallService; } });
var callSocketService_1 = require("./services/callSocketService");
Object.defineProperty(exports, "CallSocketService", { enumerable: true, get: function () { return callSocketService_1.CallSocketService; } });
Object.defineProperty(exports, "getCallSocketService", { enumerable: true, get: function () { return callSocketService_1.getCallSocketService; } });
// Controllers
var callController_1 = require("./controllers/callController");
Object.defineProperty(exports, "CallController", { enumerable: true, get: function () { return callController_1.CallController; } });
var webhookController_1 = require("./controllers/webhookController");
Object.defineProperty(exports, "WebhookController", { enumerable: true, get: function () { return webhookController_1.WebhookController; } });
// Routes
var callRoutes_1 = require("./routes/callRoutes");
Object.defineProperty(exports, "createCallRoutes", { enumerable: true, get: function () { return callRoutes_1.createCallRoutes; } });
var webhookRoutes_1 = require("./routes/webhookRoutes");
Object.defineProperty(exports, "createWebhookRoutes", { enumerable: true, get: function () { return webhookRoutes_1.createWebhookRoutes; } });
// Validations
__exportStar(require("./validations/callValidation"), exports);
//# sourceMappingURL=index.js.map