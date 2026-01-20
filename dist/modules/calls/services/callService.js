"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallService = void 0;
const twilioService_1 = require("./twilioService");
/**
 * CallService
 *
 * Business logic layer for call operations.
 * Coordinates between the database model and Twilio service.
 */
class CallService {
    callModel;
    twilioService;
    constructor(callModel) {
        this.callModel = callModel;
        this.twilioService = (0, twilioService_1.getTwilioService)();
    }
    /**
     * Generate a Twilio access token for browser calling
     */
    generateToken(userId, userEmail) {
        return this.twilioService.generateAccessToken(userId, userEmail);
    }
    /**
     * Initiate an outbound call
     */
    async initiateCall(userId, request) {
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
            direction: 'outbound',
            status: 'initiated',
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
            const twilioResult = await this.twilioService.initiateCall(request.toNumber, call.id, userId);
            // Update the call record with Twilio SID
            this.callModel.updateStatus(call.id, 'initiated', {});
            // Update the twilioCallSid directly
            const db = this.callModel.db;
            const stmt = db.prepare('UPDATE calls SET twilioCallSid = ?, updatedAt = ? WHERE id = ?');
            stmt.run(twilioResult.callSid, new Date().toISOString(), call.id);
            const updatedCall = this.callModel.findById(call.id);
            return {
                call: updatedCall,
                token: token.token
            };
        }
        catch (error) {
            // If Twilio call failed, update our record
            this.callModel.updateStatus(call.id, 'failed');
            throw error;
        }
    }
    /**
     * Handle incoming call from Twilio webhook
     */
    handleIncomingCall(twilioCallSid, fromNumber, toNumber, assignedUserId) {
        // Try to find the caller in our contacts
        const contactInfo = this.callModel.findContactByPhoneNumber(fromNumber);
        // Create call record
        const call = this.callModel.createCall({
            twilioCallSid,
            twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
            direction: 'inbound',
            status: 'ringing',
            fromNumber,
            toNumber,
            duration: 0,
            userId: assignedUserId || 1, // Default to user 1 if no routing
            contactId: contactInfo?.contactId,
        });
        // Generate TwiML to route the call
        // For now, we'll route to a default identity
        const identity = assignedUserId ? `user-${assignedUserId}` : 'default-agent';
        const twiml = this.twilioService.generateIncomingTwiML(identity, call.id, { name: contactInfo?.name });
        return { call, twiml };
    }
    /**
     * Update call status from Twilio webhook
     */
    updateCallStatus(twilioCallSid, twilioStatus, duration) {
        const call = this.callModel.findByTwilioSid(twilioCallSid);
        if (!call) {
            console.warn(`[CallService] Call not found for SID: ${twilioCallSid}`);
            return null;
        }
        const mappedStatus = this.twilioService.mapTwilioStatus(twilioStatus);
        return this.callModel.updateStatus(call.id, mappedStatus, {
            duration: duration !== undefined ? duration : undefined
        });
    }
    /**
     * Handle recording ready webhook
     */
    handleRecordingReady(twilioCallSid, recordingSid, recordingUrl, duration, channels = 1) {
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
    getCallById(callId, userId) {
        const call = this.callModel.findById(callId);
        if (!call || call.userId !== userId) {
            return null;
        }
        return this.enrichCallWithDetails(call);
    }
    /**
     * Get call by Twilio SID
     */
    getCallByTwilioSid(twilioCallSid) {
        return this.callModel.findByTwilioSid(twilioCallSid);
    }
    /**
     * List calls with pagination and filters
     */
    listCalls(userId, query) {
        const limit = query.limit || 20;
        const page = query.page || 1;
        const offset = (page - 1) * limit;
        const result = this.callModel.findByUserId(userId, {
            direction: query.direction,
            status: query.status,
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
    updateCallDetails(callId, userId, data) {
        return this.callModel.updateCallDetails(callId, userId, data);
    }
    /**
     * End an active call
     */
    async endCall(callId, userId) {
        const call = this.callModel.findById(callId);
        if (!call || call.userId !== userId) {
            return null;
        }
        // End the call via Twilio if we have an active SID
        if (call.twilioCallSid && ['initiated', 'ringing', 'in-progress'].includes(call.status)) {
            try {
                await this.twilioService.endCall(call.twilioCallSid);
            }
            catch (error) {
                console.error('[CallService] Failed to end call via Twilio:', error);
            }
        }
        // Update our record
        return this.callModel.updateStatus(callId, 'completed');
    }
    /**
     * Soft delete a call
     */
    deleteCall(callId, userId) {
        return this.callModel.softDelete(callId, userId);
    }
    /**
     * Get call statistics for a user
     */
    getCallStats(userId, options) {
        return this.callModel.getCallStats(userId, options);
    }
    /**
     * Get calls for a specific contact
     */
    getCallsForContact(contactId, limit = 10) {
        const calls = this.callModel.getCallsByContactId(contactId, limit);
        return calls.map(call => this.enrichCallWithDetails(call));
    }
    /**
     * Get calls for a specific deal
     */
    getCallsForDeal(dealId) {
        const calls = this.callModel.getCallsByDealId(dealId);
        return calls.map(call => this.enrichCallWithDetails(call));
    }
    /**
     * Get call events/history
     */
    getCallEvents(callId) {
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
    getCallRecording(callId) {
        return this.callModel.getRecordingByCallId(callId);
    }
    /**
     * Add call event
     */
    addCallEvent(callId, eventType, eventData, triggeredBy) {
        this.callModel.addEvent(callId, eventType, eventData ? JSON.stringify(eventData) : undefined, triggeredBy);
    }
    /**
     * Enrich a call with related data (contact, recording, etc.)
     */
    enrichCallWithDetails(call) {
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
exports.CallService = CallService;
//# sourceMappingURL=callService.js.map