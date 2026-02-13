import { CallModel, Call, CallDirection, CallStatus, CallDisposition, CallRecording } from '../models/Call';
import { TwilioService, getTwilioService } from './twilioService';
import { InitiateCallRequest, CallWithDetails, CallListQuery } from '../types';

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
        companyId: number,
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

        const call = await this.callModel.createCall({
            companyId,
            twilioCallSid: tempCallSid,
            twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
            direction: 'outbound' as CallDirection,
            status: 'initiated' as CallStatus,
            fromNumber: process.env.TWILIO_CALLER_ID || '',
            toNumber: request.toNumber,
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
                userId,
                companyId
            );

            // Update the call record with Twilio SID
            // Using a custom update to change SID as updateStatus doesn't normally change SID
            // We can just update it through the model if we add an update method or use the STATUS update with extra fields
            const updatedCall = await this.callModel.updateStatus(call.id, companyId, 'initiated' as CallStatus, {
                twilioCallSid: twilioResult.callSid
            } as any);

            if (!updatedCall) throw new Error('Failed to update call SID');

            return {
                call: updatedCall,
                token: token.token
            };
        } catch (error: any) {
            // If Twilio call failed, update our record
            await this.callModel.updateStatus(call.id, companyId, 'failed' as CallStatus);
            throw error;
        }
    }

    /**
     * Handle incoming call from Twilio webhook
     */
    async handleIncomingCall(
        twilioCallSid: string,
        fromNumber: string,
        toNumber: string,
        companyId: number,
        assignedUserId?: number
    ): Promise<{ call: Call; twiml: string }> {
        // Try to find the caller in our contacts
        const contactInfo = await this.callModel.findContactByPhoneNumber(fromNumber, companyId);

        // Create call record
        const call = await this.callModel.createCall({
            companyId,
            twilioCallSid,
            twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
            direction: 'inbound' as CallDirection,
            status: 'ringing' as CallStatus,
            fromNumber,
            toNumber,
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
    async updateCallStatus(
        twilioCallSid: string,
        twilioStatus: string,
        duration?: number
    ): Promise<Call | null> {
        const call = await this.callModel.findByTwilioSidGlobal(twilioCallSid);
        if (!call) {
            console.warn(`[CallService] Call not found for SID: ${twilioCallSid}`);
            return null;
        }

        const mappedStatus = this.twilioService.mapTwilioStatus(twilioStatus) as CallStatus;

        return await this.callModel.updateStatus(call.id, call.companyId, mappedStatus, {
            duration: duration !== undefined ? duration : undefined
        });
    }

    /**
     * Handle recording ready webhook
     */
    async handleRecordingReady(
        twilioCallSid: string,
        recordingSid: string,
        recordingUrl: string,
        duration: number,
        channels: number = 1
    ): Promise<CallRecording | null> {
        const call = await this.callModel.findByTwilioSidGlobal(twilioCallSid);
        if (!call) {
            console.warn(`[CallService] Call not found for recording: ${twilioCallSid}`);
            return null;
        }

        // Check if recording already exists
        let recording = await this.callModel.getRecordingByRecordingSidGlobal(recordingSid);

        if (recording) {
            // Update existing recording
            return await this.callModel.updateRecording(recording.id, call.companyId, {
                recordingUrl,
                duration,
                status: 'completed'
            });
        }

        // Create new recording
        recording = await this.callModel.addRecording({
            callId: call.id,
            companyId: call.companyId,
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
    async getCallById(callId: number, userId: number, companyId: number): Promise<CallWithDetails | null> {
        const call = await this.callModel.findById(callId, companyId);
        if (!call || call.userId !== userId) {
            return null;
        }

        return await this.enrichCallWithDetails(call);
    }

    /**
     * Get call by Twilio SID
     */
    async getCallByTwilioSid(twilioCallSid: string, companyId: number): Promise<Call | null> {
        return await this.callModel.findByTwilioSid(twilioCallSid, companyId);
    }

    async getCallByTwilioSidGlobal(twilioCallSid: string): Promise<Call | null> {
        return await this.callModel.findByTwilioSidGlobal(twilioCallSid);
    }

    /**
     * List calls with pagination and filters
     */
    async listCalls(userId: number, companyId: number, query: CallListQuery): Promise<{
        calls: CallWithDetails[];
        count: number;
        total: number;
        page: number;
        limit: number;
    }> {
        const limit = query.limit || 20;
        const page = query.page || 1;
        const offset = (page - 1) * limit;

        const result = await this.callModel.findByUserId(userId, companyId, {
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

        const enrichedCalls = await Promise.all(result.calls.map(call => this.enrichCallWithDetails(call)));

        return {
            calls: enrichedCalls,
            count: result.count,
            total: result.total,
            page,
            limit
        };
    }

    /**
     * Update call notes and disposition
     */
    async updateCallDetails(
        callId: number,
        userId: number,
        companyId: number,
        data: { notes?: string; disposition?: CallDisposition; summary?: string }
    ): Promise<Call | null> {
        return await this.callModel.updateCallDetails(callId, userId, companyId, data);
    }

    /**
     * End an active call
     */
    async endCall(callId: number, userId: number, companyId: number): Promise<Call | null> {
        const call = await this.callModel.findById(callId, companyId);
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
        return await this.callModel.updateStatus(callId, companyId, 'completed' as CallStatus);
    }

    /**
     * Soft delete a call
     */
    async deleteCall(callId: number, userId: number, companyId: number): Promise<boolean> {
        return await this.callModel.softDelete(callId, userId, companyId);
    }

    /**
     * Get call statistics for a user
     */
    async getCallStats(userId: number, companyId: number, options?: { startDate?: string; endDate?: string }): Promise<{
        totalCalls: number;
        inboundCalls: number;
        outboundCalls: number;
        completedCalls: number;
        missedCalls: number;
        totalDuration: number;
        averageDuration: number;
    }> {
        return await this.callModel.getCallStats(userId, companyId, options);
    }

    /**
     * Get calls for a specific contact
     */
    async getCallsForContact(contactId: number, companyId: number, limit: number = 10): Promise<CallWithDetails[]> {
        const calls = await this.callModel.getCallsByContactId(contactId, companyId, limit);
        return await Promise.all(calls.map(call => this.enrichCallWithDetails(call)));
    }

    /**
     * Get calls for a specific deal
     */
    async getCallsForDeal(dealId: number, companyId: number): Promise<CallWithDetails[]> {
        const calls = await this.callModel.getCallsByDealId(dealId, companyId);
        return await Promise.all(calls.map(call => this.enrichCallWithDetails(call)));
    }

    /**
     * Get call events/history
     */
    async getCallEvents(callId: number, companyId: number): Promise<Array<{
        id: number;
        eventType: string;
        eventData: any;
        createdAt: string;
    }>> {
        const events = await this.callModel.getEventsByCallId(callId, companyId);
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
    async getCallRecording(callId: number, companyId: number): Promise<CallRecording | null> {
        return await this.callModel.getRecordingByCallId(callId, companyId);
    }

    /**
     * Add call event
     */
    async addCallEvent(callId: number, companyId: number, eventType: string, eventData?: any, triggeredBy?: number): Promise<void> {
        await this.callModel.addEvent(
            callId,
            companyId,
            eventType,
            eventData ? JSON.stringify(eventData) : undefined,
            triggeredBy
        );
    }

    /**
     * Enrich a call with related data (contact, recording, etc.)
     */
    private async enrichCallWithDetails(call: Call): Promise<CallWithDetails> {
        const [recording, participants] = await Promise.all([
            this.callModel.getRecordingByCallId(call.id, call.companyId),
            this.callModel.getParticipantsByCallId(call.id, call.companyId)
        ]);

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
