/**
 * Call Module TypeScript Types and Interfaces
 * These types are used across the call module for type safety
 */
/**
 * Request to initiate an outbound call
 */
export interface InitiateCallRequest {
    toNumber: string;
    contactId?: number;
    dealId?: number;
    leadId?: number;
    notes?: string;
}
/**
 * Response after initiating a call
 */
export interface InitiateCallResponse {
    callId: number;
    twilioCallSid: string;
    status: string;
    token: string;
}
/**
 * Request to update call details
 */
export interface UpdateCallRequest {
    notes?: string;
    disposition?: string;
    summary?: string;
}
/**
 * Call list query parameters
 */
export interface CallListQuery {
    direction?: 'inbound' | 'outbound';
    status?: string;
    contactId?: number;
    dealId?: number;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
}
/**
 * Call with related data (for API responses)
 */
export interface CallWithDetails {
    id: number;
    twilioCallSid: string;
    direction: 'inbound' | 'outbound';
    status: string;
    fromNumber: string;
    toNumber: string;
    startTime?: string;
    answerTime?: string;
    endTime?: string;
    duration: number;
    disposition?: string;
    notes?: string;
    summary?: string;
    createdAt: string;
    contact?: {
        id: number;
        name: string;
        company?: string;
        email?: string;
        phone?: string;
    };
    deal?: {
        id: number;
        title: string;
        value?: number;
    };
    user?: {
        id: number;
        name: string;
        email: string;
    };
    recording?: {
        id: number;
        recordingUrl?: string;
        duration: number;
        transcriptionText?: string;
    };
    participants?: Array<{
        id: number;
        phoneNumber: string;
        name?: string;
        role: string;
    }>;
}
/**
 * Twilio Voice webhook payload
 */
export interface TwilioVoiceWebhook {
    CallSid: string;
    AccountSid: string;
    From: string;
    To: string;
    CallStatus: string;
    ApiVersion: string;
    Direction: string;
    ForwardedFrom?: string;
    CallerName?: string;
    ParentCallSid?: string;
    CallDuration?: string;
    RecordingUrl?: string;
    RecordingSid?: string;
    RecordingDuration?: string;
    Digits?: string;
}
/**
 * Twilio Recording status callback payload
 */
export interface TwilioRecordingWebhook {
    RecordingSid: string;
    RecordingUrl: string;
    RecordingStatus: 'in-progress' | 'completed' | 'failed';
    RecordingDuration: string;
    RecordingChannels: string;
    RecordingSource: string;
    CallSid: string;
    AccountSid: string;
}
/**
 * Twilio Transcription callback payload
 */
export interface TwilioTranscriptionWebhook {
    TranscriptionSid: string;
    TranscriptionText: string;
    TranscriptionStatus: 'completed' | 'failed';
    TranscriptionUrl: string;
    RecordingSid: string;
    RecordingUrl: string;
    CallSid: string;
    AccountSid: string;
}
/**
 * Incoming call notification event
 */
export interface IncomingCallEvent {
    type: 'call:incoming';
    callId: number;
    twilioCallSid: string;
    fromNumber: string;
    toNumber: string;
    contact?: {
        id: number;
        name: string;
        company?: string;
    };
    timestamp: string;
}
/**
 * Call status update event
 */
export interface CallStatusEvent {
    type: 'call:status';
    callId: number;
    twilioCallSid: string;
    previousStatus: string;
    currentStatus: string;
    duration?: number;
    timestamp: string;
}
/**
 * Call started event (call connected)
 */
export interface CallStartedEvent {
    type: 'call:started';
    callId: number;
    twilioCallSid: string;
    direction: 'inbound' | 'outbound';
    timestamp: string;
}
/**
 * Call ended event
 */
export interface CallEndedEvent {
    type: 'call:ended';
    callId: number;
    twilioCallSid: string;
    duration: number;
    disposition?: string;
    timestamp: string;
}
/**
 * Recording ready event
 */
export interface RecordingReadyEvent {
    type: 'call:recording-ready';
    callId: number;
    recordingId: number;
    recordingUrl: string;
    duration: number;
    timestamp: string;
}
/**
 * Agent status event
 */
export interface AgentStatusEvent {
    type: 'agent:status';
    userId: number;
    status: 'online' | 'offline' | 'busy' | 'away';
    timestamp: string;
}
/**
 * Union type for all call-related socket events
 */
export type CallSocketEvent = IncomingCallEvent | CallStatusEvent | CallStartedEvent | CallEndedEvent | RecordingReadyEvent | AgentStatusEvent;
export interface AcceptCallPayload {
    callId: number;
}
export interface RejectCallPayload {
    callId: number;
    reason?: string;
}
export interface AddCallNotePayload {
    callId: number;
    note: string;
}
export interface SetAgentStatusPayload {
    status: 'online' | 'offline' | 'busy' | 'away';
}
export interface TwilioToken {
    token: string;
    identity: string;
    expiresAt: string;
}
export interface TwilioDeviceConfig {
    edge?: string;
    logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
    closeProtection?: boolean;
    codecPreferences?: Array<'opus' | 'pcmu'>;
}
//# sourceMappingURL=index.d.ts.map