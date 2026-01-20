import { CallModel, Call, CallDisposition, CallRecording } from '../models/Call';
import { InitiateCallRequest, CallWithDetails, CallListQuery } from '../types';
/**
 * CallService
 *
 * Business logic layer for call operations.
 * Coordinates between the database model and Twilio service.
 */
export declare class CallService {
    private callModel;
    private twilioService;
    constructor(callModel: CallModel);
    /**
     * Generate a Twilio access token for browser calling
     */
    generateToken(userId: number, userEmail: string): {
        token: string;
        identity: string;
        expiresAt: string;
    };
    /**
     * Initiate an outbound call
     */
    initiateCall(userId: number, request: InitiateCallRequest): Promise<{
        call: Call;
        token: string;
    }>;
    /**
     * Handle incoming call from Twilio webhook
     */
    handleIncomingCall(twilioCallSid: string, fromNumber: string, toNumber: string, assignedUserId?: number): {
        call: Call;
        twiml: string;
    };
    /**
     * Update call status from Twilio webhook
     */
    updateCallStatus(twilioCallSid: string, twilioStatus: string, duration?: number): Call | null;
    /**
     * Handle recording ready webhook
     */
    handleRecordingReady(twilioCallSid: string, recordingSid: string, recordingUrl: string, duration: number, channels?: number): CallRecording | null;
    /**
     * Get call by ID with full details
     */
    getCallById(callId: number, userId: number): CallWithDetails | null;
    /**
     * Get call by Twilio SID
     */
    getCallByTwilioSid(twilioCallSid: string): Call | undefined;
    /**
     * List calls with pagination and filters
     */
    listCalls(userId: number, query: CallListQuery): {
        calls: CallWithDetails[];
        count: number;
        total: number;
        page: number;
        limit: number;
    };
    /**
     * Update call notes and disposition
     */
    updateCallDetails(callId: number, userId: number, data: {
        notes?: string;
        disposition?: CallDisposition;
        summary?: string;
    }): Call | null;
    /**
     * End an active call
     */
    endCall(callId: number, userId: number): Promise<Call | null>;
    /**
     * Soft delete a call
     */
    deleteCall(callId: number, userId: number): boolean;
    /**
     * Get call statistics for a user
     */
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
     * Get calls for a specific contact
     */
    getCallsForContact(contactId: number, limit?: number): CallWithDetails[];
    /**
     * Get calls for a specific deal
     */
    getCallsForDeal(dealId: number): CallWithDetails[];
    /**
     * Get call events/history
     */
    getCallEvents(callId: number): Array<{
        id: number;
        eventType: string;
        eventData: any;
        createdAt: string;
    }>;
    /**
     * Get recording for a call
     */
    getCallRecording(callId: number): CallRecording | undefined;
    /**
     * Add call event
     */
    addCallEvent(callId: number, eventType: string, eventData?: any, triggeredBy?: number): void;
    /**
     * Enrich a call with related data (contact, recording, etc.)
     */
    private enrichCallWithDetails;
}
//# sourceMappingURL=callService.d.ts.map