"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.twilioRecordingWebhookSchema = exports.twilioVoiceWebhookSchema = exports.callListQuerySchema = exports.updateCallSchema = exports.initiateCallSchema = exports.phoneNumberSchema = void 0;
const zod_1 = require("zod");
// ============================================
// Call Validation Schemas
// ============================================
/**
 * Phone number validation - supports E.164 format and common formats
 */
exports.phoneNumberSchema = zod_1.z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(20, 'Phone number must not exceed 20 characters')
    .regex(/^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/, 'Invalid phone number format');
/**
 * Initiate call request validation
 */
exports.initiateCallSchema = zod_1.z.object({
    toNumber: exports.phoneNumberSchema,
    contactId: zod_1.z.number().int().positive().optional(),
    dealId: zod_1.z.number().int().positive().optional(),
    leadId: zod_1.z.number().int().positive().optional(),
    notes: zod_1.z.string().max(1000).optional()
});
/**
 * Update call request validation
 */
exports.updateCallSchema = zod_1.z.object({
    notes: zod_1.z.string().max(5000).optional(),
    disposition: zod_1.z.enum([
        'connected',
        'left-voicemail',
        'no-answer',
        'busy',
        'wrong-number',
        'callback-requested',
        'not-interested',
        'interested',
        'follow-up-scheduled',
        'other'
    ]).optional(),
    summary: zod_1.z.string().max(5000).optional()
});
/**
 * Call list query validation
 */
exports.callListQuerySchema = zod_1.z.object({
    direction: zod_1.z.enum(['inbound', 'outbound']).optional(),
    status: zod_1.z.enum([
        'initiated',
        'ringing',
        'in-progress',
        'completed',
        'busy',
        'no-answer',
        'failed',
        'canceled',
        'voicemail'
    ]).optional(),
    contactId: zod_1.z.coerce.number().int().positive().optional(),
    dealId: zod_1.z.coerce.number().int().positive().optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    search: zod_1.z.string().max(100).optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20)
});
/**
 * Twilio webhook validation - basic structure
 */
exports.twilioVoiceWebhookSchema = zod_1.z.object({
    CallSid: zod_1.z.string(),
    AccountSid: zod_1.z.string(),
    From: zod_1.z.string(),
    To: zod_1.z.string(),
    CallStatus: zod_1.z.string(),
    Direction: zod_1.z.string().optional(),
    CallDuration: zod_1.z.string().optional(),
    RecordingUrl: zod_1.z.string().url().optional(),
    RecordingSid: zod_1.z.string().optional(),
    RecordingDuration: zod_1.z.string().optional(),
    Digits: zod_1.z.string().optional()
}).passthrough(); // Allow additional Twilio fields
/**
 * Recording webhook validation
 */
exports.twilioRecordingWebhookSchema = zod_1.z.object({
    RecordingSid: zod_1.z.string(),
    RecordingUrl: zod_1.z.string(),
    RecordingStatus: zod_1.z.enum(['in-progress', 'completed', 'failed']),
    RecordingDuration: zod_1.z.string(),
    RecordingChannels: zod_1.z.string().optional(),
    CallSid: zod_1.z.string(),
    AccountSid: zod_1.z.string()
}).passthrough();
//# sourceMappingURL=callValidation.js.map