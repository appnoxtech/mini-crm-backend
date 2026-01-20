import { z } from 'zod';
/**
 * Phone number validation - supports E.164 format and common formats
 */
export declare const phoneNumberSchema: z.ZodString;
/**
 * Initiate call request validation
 */
export declare const initiateCallSchema: z.ZodObject<{
    toNumber: z.ZodString;
    contactId: z.ZodOptional<z.ZodNumber>;
    dealId: z.ZodOptional<z.ZodNumber>;
    leadId: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * Update call request validation
 */
export declare const updateCallSchema: z.ZodObject<{
    notes: z.ZodOptional<z.ZodString>;
    disposition: z.ZodOptional<z.ZodEnum<{
        busy: "busy";
        other: "other";
        "no-answer": "no-answer";
        connected: "connected";
        "left-voicemail": "left-voicemail";
        "wrong-number": "wrong-number";
        "callback-requested": "callback-requested";
        "not-interested": "not-interested";
        interested: "interested";
        "follow-up-scheduled": "follow-up-scheduled";
    }>>;
    summary: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * Call list query validation
 */
export declare const callListQuerySchema: z.ZodObject<{
    direction: z.ZodOptional<z.ZodEnum<{
        inbound: "inbound";
        outbound: "outbound";
    }>>;
    status: z.ZodOptional<z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        busy: "busy";
        initiated: "initiated";
        ringing: "ringing";
        "in-progress": "in-progress";
        "no-answer": "no-answer";
        canceled: "canceled";
        voicemail: "voicemail";
    }>>;
    contactId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    dealId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
/**
 * Twilio webhook validation - basic structure
 */
export declare const twilioVoiceWebhookSchema: z.ZodObject<{
    CallSid: z.ZodString;
    AccountSid: z.ZodString;
    From: z.ZodString;
    To: z.ZodString;
    CallStatus: z.ZodString;
    Direction: z.ZodOptional<z.ZodString>;
    CallDuration: z.ZodOptional<z.ZodString>;
    RecordingUrl: z.ZodOptional<z.ZodString>;
    RecordingSid: z.ZodOptional<z.ZodString>;
    RecordingDuration: z.ZodOptional<z.ZodString>;
    Digits: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
/**
 * Recording webhook validation
 */
export declare const twilioRecordingWebhookSchema: z.ZodObject<{
    RecordingSid: z.ZodString;
    RecordingUrl: z.ZodString;
    RecordingStatus: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        "in-progress": "in-progress";
    }>;
    RecordingDuration: z.ZodString;
    RecordingChannels: z.ZodOptional<z.ZodString>;
    CallSid: z.ZodString;
    AccountSid: z.ZodString;
}, z.core.$loose>;
export type InitiateCallInput = z.infer<typeof initiateCallSchema>;
export type UpdateCallInput = z.infer<typeof updateCallSchema>;
export type CallListQueryInput = z.infer<typeof callListQuerySchema>;
export type TwilioVoiceWebhookInput = z.infer<typeof twilioVoiceWebhookSchema>;
export type TwilioRecordingWebhookInput = z.infer<typeof twilioRecordingWebhookSchema>;
//# sourceMappingURL=callValidation.d.ts.map