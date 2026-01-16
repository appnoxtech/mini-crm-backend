import { z } from 'zod';

// ============================================
// Call Validation Schemas
// ============================================

/**
 * Phone number validation - supports E.164 format and common formats
 */
export const phoneNumberSchema = z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(20, 'Phone number must not exceed 20 characters')
    .regex(
        /^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/,
        'Invalid phone number format'
    );

/**
 * Initiate call request validation
 */
export const initiateCallSchema = z.object({
    toNumber: phoneNumberSchema,
    contactId: z.number().int().positive().optional(),
    dealId: z.number().int().positive().optional(),
    leadId: z.number().int().positive().optional(),
    notes: z.string().max(1000).optional()
});

/**
 * Update call request validation
 */
export const updateCallSchema = z.object({
    notes: z.string().max(5000).optional(),
    disposition: z.enum([
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
    summary: z.string().max(5000).optional()
});

/**
 * Call list query validation
 */
export const callListQuerySchema = z.object({
    direction: z.enum(['inbound', 'outbound']).optional(),
    status: z.enum([
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
    contactId: z.coerce.number().int().positive().optional(),
    dealId: z.coerce.number().int().positive().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    search: z.string().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
});

/**
 * Twilio webhook validation - basic structure
 */
export const twilioVoiceWebhookSchema = z.object({
    CallSid: z.string(),
    AccountSid: z.string(),
    From: z.string(),
    To: z.string(),
    CallStatus: z.string(),
    Direction: z.string().optional(),
    CallDuration: z.string().optional(),
    RecordingUrl: z.string().url().optional(),
    RecordingSid: z.string().optional(),
    RecordingDuration: z.string().optional(),
    Digits: z.string().optional()
}).passthrough(); // Allow additional Twilio fields

/**
 * Recording webhook validation
 */
export const twilioRecordingWebhookSchema = z.object({
    RecordingSid: z.string(),
    RecordingUrl: z.string(),
    RecordingStatus: z.enum(['in-progress', 'completed', 'failed']),
    RecordingDuration: z.string(),
    RecordingChannels: z.string().optional(),
    CallSid: z.string(),
    AccountSid: z.string()
}).passthrough();

// Type exports
export type InitiateCallInput = z.infer<typeof initiateCallSchema>;
export type UpdateCallInput = z.infer<typeof updateCallSchema>;
export type CallListQueryInput = z.infer<typeof callListQuerySchema>;
export type TwilioVoiceWebhookInput = z.infer<typeof twilioVoiceWebhookSchema>;
export type TwilioRecordingWebhookInput = z.infer<typeof twilioRecordingWebhookSchema>;
