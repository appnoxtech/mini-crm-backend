import Database from 'better-sqlite3';
import { BaseEntity } from '../../../shared/types';
/**
 * Call direction - whether the call is outgoing (from CRM to contact) or incoming
 */
export type CallDirection = 'inbound' | 'outbound';
/**
 * Call status lifecycle
 * - initiated: Call has been requested but not yet connected
 * - ringing: Call is ringing on the recipient's end
 * - in-progress: Call is currently active
 * - completed: Call ended normally
 * - busy: Recipient's line was busy
 * - no-answer: Call was not answered
 * - failed: Call failed due to technical issues
 * - canceled: Call was canceled before being answered
 * - voicemail: Call went to voicemail
 */
export type CallStatus = 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'no-answer' | 'failed' | 'canceled' | 'voicemail';
/**
 * Call disposition - outcome/result of the call for CRM tracking
 */
export type CallDisposition = 'connected' | 'left-voicemail' | 'no-answer' | 'busy' | 'wrong-number' | 'callback-requested' | 'not-interested' | 'interested' | 'follow-up-scheduled' | 'other';
/**
 * Main Call interface
 */
export interface Call extends BaseEntity {
    twilioCallSid: string;
    twilioAccountSid: string;
    direction: CallDirection;
    status: CallStatus;
    fromNumber: string;
    toNumber: string;
    startTime?: string;
    answerTime?: string;
    endTime?: string;
    duration: number;
    ringDuration?: number;
    userId: number;
    contactId?: number;
    dealId?: number;
    leadId?: number;
    disposition?: CallDisposition;
    notes?: string;
    summary?: string;
    queueName?: string;
    assignedAgentId?: number;
    deletedAt?: string;
}
/**
 * Call participant for multi-party calls
 */
export interface CallParticipant extends BaseEntity {
    callId: number;
    participantSid?: string;
    phoneNumber: string;
    name?: string;
    role: 'caller' | 'callee' | 'transfer' | 'conference';
    joinTime?: string;
    leaveTime?: string;
    muted: boolean;
    hold: boolean;
}
/**
 * Call recording metadata
 */
export interface CallRecording extends BaseEntity {
    callId: number;
    recordingSid: string;
    recordingUrl?: string;
    localFilePath?: string;
    duration: number;
    fileSize?: number;
    channels: number;
    status: 'processing' | 'completed' | 'failed' | 'deleted';
    transcriptionSid?: string;
    transcriptionText?: string;
    transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
    transcriptionUrl?: string;
}
/**
 * Call event/log for tracking call lifecycle
 */
export interface CallEvent extends BaseEntity {
    callId: number;
    eventType: string;
    eventData?: string;
    triggeredBy?: number;
}
export declare class CallModel {
    private db;
    constructor(db: Database.Database);
    /**
     * Initialize all call-related tables with proper indexes
     */
    initialize(): void;
    /**
     * Create indexes for optimal query performance
     */
    private createIndexes;
    /**
     * Create a new call record
     */
    createCall(callData: Omit<Call, 'id' | 'createdAt' | 'updatedAt'>): Call;
    /**
     * Find call by ID
     */
    findById(id: number): Call | undefined;
    /**
     * Find call by Twilio Call SID
     */
    findByTwilioSid(twilioCallSid: string): Call | undefined;
    /**
     * Get calls for a user with pagination and filters
     */
    findByUserId(userId: number, options?: {
        direction?: CallDirection;
        status?: CallStatus;
        contactId?: number;
        dealId?: number;
        startDate?: string;
        endDate?: string;
        search?: string;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    }): {
        calls: Call[];
        count: number;
        total: number;
    };
    /**
     * Update call status
     */
    updateStatus(id: number, status: CallStatus, additionalData?: Partial<Call>): Call | null;
    /**
     * Update call notes and disposition
     */
    updateCallDetails(id: number, userId: number, data: {
        notes?: string;
        disposition?: CallDisposition;
        summary?: string;
    }): Call | null;
    /**
     * Soft delete a call
     */
    softDelete(id: number, userId: number): boolean;
    addParticipant(participantData: Omit<CallParticipant, 'id' | 'createdAt' | 'updatedAt'>): CallParticipant;
    getParticipantById(id: number): CallParticipant | undefined;
    getParticipantsByCallId(callId: number): CallParticipant[];
    addRecording(recordingData: Omit<CallRecording, 'id' | 'createdAt' | 'updatedAt'>): CallRecording;
    getRecordingById(id: number): CallRecording | undefined;
    getRecordingByCallId(callId: number): CallRecording | undefined;
    getRecordingByRecordingSid(recordingSid: string): CallRecording | undefined;
    updateRecording(id: number, data: Partial<CallRecording>): CallRecording | null;
    addEvent(callId: number, eventType: string, eventData?: string, triggeredBy?: number): CallEvent;
    getEventById(id: number): CallEvent | undefined;
    getEventsByCallId(callId: number): CallEvent[];
    getCallStats(userId: number, options?: {
        startDate?: string;
        endDate?: string;
    }): {
        totalCalls: number;
        inboundCalls: number;
        outboundCalls: number;
        completedCalls: number;
        missedCalls: number;
        totalDuration: number;
        averageDuration: number;
    };
    /**
     * Get recent calls for a contact
     */
    getCallsByContactId(contactId: number, limit?: number): Call[];
    /**
     * Get calls associated with a deal
     */
    getCallsByDealId(dealId: number): Call[];
    /**
     * Find contact by phone number (for incoming call lookup)
     */
    findContactByPhoneNumber(phoneNumber: string): {
        contactId: number;
        name: string;
        company?: string;
    } | undefined;
}
//# sourceMappingURL=Call.d.ts.map