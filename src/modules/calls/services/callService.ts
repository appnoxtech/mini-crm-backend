import { CallModel, Call, CallDirection, CallStatus, CallDisposition, CallRecording } from '../models/Call';
import { TwilioService, getTwilioService } from './twilioService';
import { InitiateCallRequest, CallWithDetails, CallListQuery } from '../types';
import Database from 'better-sqlite3';

/**
 * CallService
 * 
 * Business logic layer for call operations.
 * Coordinates between the database model and Twilio service.
 */
export class CallService {
    private callModel: CallModel;
    private twilioService: TwilioService;

    constructor(callModel: CallModel) {
        this.callModel = callModel;
        this.twilioService = getTwilioService();
    }

    /**
     * Generate a Twilio access token for browser calling
     */
    generateToken(userId: number, userEmail: string): { token: string; identity: string; expiresAt: string } {
        return this.twilioService.generateAccessToken(userId, userEmail);
    }

    /**
     * Initiate an outbound call
     */
    async initiateCall(
        userId: number,
        request: InitiateCallRequest
    ): Promise<{ call: Call; token: string }> {
        // Check if Twilio is configured
        if (!this.twilioService.isConfigured()) {
            throw new Error('Twilio is not configured. Please set up Twilio credentials.');
        }

        // Get user email for token generation (we'll need this from the controller)
        const token = this.twilioService.generateAccessToken(userId, `user-${userId}@crm.local`);

        // Create call record in database first with a temporary unique SID
        // This will be replaced with the real Twilio SID once the call is initiated
        const tempCallSid = `pending-${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        const call = this.callModel.createCall({
            twilioCallSid: tempCallSid,
            twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
            direction: 'outbound' as CallDirection,
            status: 'initiated' as CallStatus,
            fromNumber: process.env.TWILIO_CALLER_ID || '',
            toNumber: request.toNumber,
            duration: 0,
            userId,
            contactId: request.contactId,
            dealId: request.dealId,
            leadId: request.leadId,
            notes: request.notes
        });

        try {
            // Initiate the actual call via Twilio
            const twilioResult = await this.twilioService.initiateCall(
                request.toNumber,
                call.id,
                userId
            );

            // Update the call record with Twilio SID
            this.callModel.updateStatus(call.id, 'initiated' as CallStatus, {});

            // Update the twilioCallSid directly
            const db = (this.callModel as any).db as Database.Database;
            const stmt = db.prepare('UPDATE calls SET twilioCallSid = ?, updatedAt = ? WHERE id = ?');
            stmt.run(twilioResult.callSid, new Date().toISOString(), call.id);

            const updatedCall = this.callModel.findById(call.id)!;

            return {
                call: updatedCall,
                token: token.token
            };
        } catch (error: any) {
            // If Twilio call failed, update our record
            this.callModel.updateStatus(call.id, 'failed' as CallStatus);
            throw error;
        }
    }

    /**
     * Handle incoming call from Twilio webhook
     */
    handleIncomingCall(
        twilioCallSid: string,
        fromNumber: string,
        toNumber: string,
        assignedUserId?: number
    ): { call: Call; twiml: string } {
        // Try to find the caller in our contacts
        const contactInfo = this.callModel.findContactByPhoneNumber(fromNumber);

        // Create call record
        const call = this.callModel.createCall({
            twilioCallSid,
            twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
            direction: 'inbound' as CallDirection,
            status: 'ringing' as CallStatus,
            fromNumber,
            toNumber,
            duration: 0,
            userId: assignedUserId || 1, // Default to user 1 if no routing
            contactId: contactInfo?.contactId,
        });

        // Generate TwiML to route the call
        // For now, we'll route to a default identity
        const identity = assignedUserId ? `user-${assignedUserId}` : 'default-agent';
        const twiml = this.twilioService.generateIncomingTwiML(
            identity,
            call.id,
            { name: contactInfo?.name }
        );

        return { call, twiml };
    }

    /**
     * Update call status from Twilio webhook
     */
    updateCallStatus(
        twilioCallSid: string,
        twilioStatus: string,
        duration?: number
    ): Call | null {
        const call = this.callModel.findByTwilioSid(twilioCallSid);
        if (!call) {
            console.warn(`[CallService] Call not found for SID: ${twilioCallSid}`);
            return null;
        }

        const mappedStatus = this.twilioService.mapTwilioStatus(twilioStatus) as CallStatus;

        return this.callModel.updateStatus(call.id, mappedStatus, {
            duration: duration !== undefined ? duration : undefined
        });
    }

    /**
     * Handle recording ready webhook
     */
    handleRecordingReady(
        twilioCallSid: string,
        recordingSid: string,
        recordingUrl: string,
        duration: number,
        channels: number = 1
    ): CallRecording | null {
        const call = this.callModel.findByTwilioSid(twilioCallSid);
        if (!call) {
            console.warn(`[CallService] Call not found for recording: ${twilioCallSid}`);
            return null;
        }

        // Check if recording already exists
        let recording = this.callModel.getRecordingByRecordingSid(recordingSid);

        if (recording) {
            // Update existing recording
            return this.callModel.updateRecording(recording.id, {
                recordingUrl,
                duration,
                status: 'completed'
            });
        }

        // Create new recording
        recording = this.callModel.addRecording({
            callId: call.id,
            recordingSid,
            recordingUrl,
            duration,
            channels,
            status: 'completed'
        });

        return recording;
    }

    /**
     * Get call by ID with full details
     */
    getCallById(callId: number, userId: number): CallWithDetails | null {
        const call = this.callModel.findById(callId);
        if (!call || call.userId !== userId) {
            return null;
        }

        return this.enrichCallWithDetails(call);
    }

    /**
     * Get call by Twilio SID
     */
    getCallByTwilioSid(twilioCallSid: string): Call | undefined {
        return this.callModel.findByTwilioSid(twilioCallSid);
    }

    /**
     * List calls with pagination and filters
     */
    listCalls(userId: number, query: CallListQuery): {
        calls: CallWithDetails[];
        count: number;
        total: number;
        page: number;
        limit: number;
    } {
        const limit = query.limit || 20;
        const page = query.page || 1;
        const offset = (page - 1) * limit;

        const result = this.callModel.findByUserId(userId, {
            direction: query.direction as CallDirection | undefined,
            status: query.status as CallStatus | undefined,
            contactId: query.contactId,
            dealId: query.dealId,
            startDate: query.startDate,
            endDate: query.endDate,
            search: query.search,
            limit,
            offset
        });

        return {
            calls: result.calls.map(call => this.enrichCallWithDetails(call)),
            count: result.count,
            total: result.total,
            page,
            limit
        };
    }

    /**
     * Update call notes and disposition
     */
    updateCallDetails(
        callId: number,
        userId: number,
        data: { notes?: string; disposition?: CallDisposition; summary?: string }
    ): Call | null {
        return this.callModel.updateCallDetails(callId, userId, data);
    }

    /**
     * End an active call
     */
    async endCall(callId: number, userId: number): Promise<Call | null> {
        const call = this.callModel.findById(callId);
        if (!call || call.userId !== userId) {
            return null;
        }

        // End the call via Twilio if we have an active SID
        if (call.twilioCallSid && ['initiated', 'ringing', 'in-progress'].includes(call.status)) {
            try {
                await this.twilioService.endCall(call.twilioCallSid);
            } catch (error) {
                console.error('[CallService] Failed to end call via Twilio:', error);
            }
        }

        // Update our record
        return this.callModel.updateStatus(callId, 'completed' as CallStatus);
    }

    /**
     * Soft delete a call
     */
    deleteCall(callId: number, userId: number): boolean {
        return this.callModel.softDelete(callId, userId);
    }

    /**
     * Get call statistics for a user
     */
    getCallStats(userId: number, options?: { startDate?: string; endDate?: string }): {
        totalCalls: number;
        inboundCalls: number;
        outboundCalls: number;
        completedCalls: number;
        missedCalls: number;
        totalDuration: number;
        averageDuration: number;
    } {
        return this.callModel.getCallStats(userId, options);
    }

    /**
     * Get calls for a specific contact
     */
    getCallsForContact(contactId: number, limit: number = 10): CallWithDetails[] {
        const calls = this.callModel.getCallsByContactId(contactId, limit);
        return calls.map(call => this.enrichCallWithDetails(call));
    }

    /**
     * Get calls for a specific deal
     */
    getCallsForDeal(dealId: number): CallWithDetails[] {
        const calls = this.callModel.getCallsByDealId(dealId);
        return calls.map(call => this.enrichCallWithDetails(call));
    }

    /**
     * Get call events/history
     */
    getCallEvents(callId: number): Array<{
        id: number;
        eventType: string;
        eventData: any;
        createdAt: string;
    }> {
        const events = this.callModel.getEventsByCallId(callId);
        return events.map(event => ({
            id: event.id,
            eventType: event.eventType,
            eventData: event.eventData ? JSON.parse(event.eventData) : null,
            createdAt: event.createdAt
        }));
    }

    /**
     * Get recording for a call
     */
    getCallRecording(callId: number): CallRecording | undefined {
        return this.callModel.getRecordingByCallId(callId);
    }

    /**
     * Add call event
     */
    addCallEvent(callId: number, eventType: string, eventData?: any, triggeredBy?: number): void {
        this.callModel.addEvent(
            callId,
            eventType,
            eventData ? JSON.stringify(eventData) : undefined,
            triggeredBy
        );
    }

    /**
     * Enrich a call with related data (contact, recording, etc.)
     */
    private enrichCallWithDetails(call: Call): CallWithDetails {
        const recording = this.callModel.getRecordingByCallId(call.id);
        const participants = this.callModel.getParticipantsByCallId(call.id);

        // TODO: Fetch contact and deal info from their respective services
        // For now, we'll return what we have

        return {
            id: call.id,
            twilioCallSid: call.twilioCallSid,
            direction: call.direction,
            status: call.status,
            fromNumber: call.fromNumber,
            toNumber: call.toNumber,
            startTime: call.startTime,
            answerTime: call.answerTime,
            endTime: call.endTime,
            duration: call.duration,
            disposition: call.disposition,
            notes: call.notes,
            summary: call.summary,
            createdAt: call.createdAt,
            contact: call.contactId ? {
                id: call.contactId,
                name: 'Contact', // Would be fetched from PersonModel
            } : undefined,
            deal: call.dealId ? {
                id: call.dealId,
                title: 'Deal', // Would be fetched from DealModel
            } : undefined,
            recording: recording ? {
                id: recording.id,
                recordingUrl: recording.recordingUrl,
                duration: recording.duration,
                transcriptionText: recording.transcriptionText
            } : undefined,
            participants: participants.map(p => ({
                id: p.id,
                phoneNumber: p.phoneNumber,
                name: p.name,
                role: p.role
            }))
        };
    }
}
