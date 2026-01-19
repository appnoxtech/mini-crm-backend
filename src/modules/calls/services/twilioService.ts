import Twilio from 'twilio';
import AccessToken = require('twilio/lib/jwt/AccessToken');
import { getTwilioConfig, getWebhookUrls, validateTwilioConfig } from '../config/twilioConfig';
import { TwilioToken } from '../types';
import crypto from 'crypto';

const VoiceGrant = AccessToken.VoiceGrant;

/**
 * TwilioService
 * 
 * Handles all Twilio Voice API interactions including:
 * - Generating access tokens for browser calling
 * - Initiating outbound calls
 * - Generating TwiML responses
 * - Webhook signature validation
 * - Fetching recordings
 */
export class TwilioService {
    private client: Twilio.Twilio | null = null;
    private _config: ReturnType<typeof getTwilioConfig> | null = null;
    private initialized = false;

    constructor() {
        this.initialize();
    }

    /**
     * Get config lazily to ensure dotenv is loaded first
     */
    private getConfig() {
        if (!this._config) {
            this._config = getTwilioConfig();
        }
        return this._config;
    }

    /**
     * Initialize the Twilio client
     */
    private initialize(): void {
        const validation = validateTwilioConfig();

        if (!validation.valid) {
            console.warn('[TwilioService] Missing configuration:', validation.missing.join(', '));
            console.warn('[TwilioService] Twilio features will be disabled');
            return;
        }

        try {
            const config = this.getConfig();
            this.client = Twilio(config.accountSid, config.authToken);
            this.initialized = true;
            console.log('[TwilioService] Initialized successfully');
        } catch (error) {
            console.error('[TwilioService] Failed to initialize:', error);
        }
    }

    /**
     * Check if Twilio is properly configured
     */
    isConfigured(): boolean {
        return this.initialized && this.client !== null;
    }

    /**
     * Generate an access token for the Twilio Voice SDK in the browser
     * 
     * @param userId - User ID to use as identity
     * @param userEmail - User email for identity
     * @param ttl - Token time-to-live in seconds (default: 1 hour)
     */
    generateAccessToken(userId: number, userEmail: string, ttl: number = 3600): TwilioToken {
        if (!this.isConfigured()) {
            throw new Error('Twilio is not configured');
        }

        const identity = `user-${userId}-${userEmail.split('@')[0]}`;
        const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

        // Create access token
        const config = this.getConfig();
        const accessToken = new AccessToken(
            config.accountSid,
            config.apiKeySid,
            config.apiKeySecret,
            { identity, ttl }
        );

        // Create Voice grant
        const voiceGrant = new VoiceGrant({
            outgoingApplicationSid: config.twimlAppSid,
            incomingAllow: true // Allow incoming calls to this identity
        });

        accessToken.addGrant(voiceGrant);

        return {
            token: accessToken.toJwt(),
            identity,
            expiresAt
        };
    }

    /**
     * Initiate an outbound call via Twilio
     * 
     * @param toNumber - Phone number to call
     * @param callId - Internal call ID for tracking
     * @param userId - User ID initiating the call
     */
    async initiateCall(toNumber: string, callId: number, userId: number): Promise<{
        callSid: string;
        status: string;
    }> {
        if (!this.client) {
            throw new Error('Twilio client not initialized');
        }

        const webhookUrls = getWebhookUrls();

        const config = this.getConfig();
        try {
            const call = await this.client.calls.create({
                url: `${webhookUrls.voice}?callId=${callId}&userId=${userId}&direction=outbound`,
                to: this.formatPhoneNumber(toNumber),
                from: config.outgoingCallerId,
                statusCallback: webhookUrls.voiceStatus,
                statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
                statusCallbackMethod: 'POST',
                record: config.recordingEnabled,
                recordingStatusCallback: webhookUrls.recording,
                recordingStatusCallbackEvent: ['completed'],
                recordingChannels: config.recordingChannels
            });

            console.log(`[TwilioService] Call initiated: ${call.sid}`);

            return {
                callSid: call.sid,
                status: call.status
            };
        } catch (error: any) {
            console.error('[TwilioService] Failed to initiate call:', error);
            throw new Error(error.message || 'Failed to initiate call');
        }
    }

    /**
     * Generate TwiML response for outgoing calls (connects browser to PSTN)
     */
    generateOutboundTwiML(toNumber: string, callId: number): string {
        const webhookUrls = getWebhookUrls();
        const VoiceResponse = Twilio.twiml.VoiceResponse;
        const response = new VoiceResponse();

        const config = this.getConfig();
        // Dial the number
        const dial = response.dial({
            callerId: config.outgoingCallerId,
            record: config.recordingEnabled ? 'record-from-answer-dual' : 'do-not-record',
            recordingStatusCallback: webhookUrls.recording,
            recordingStatusCallbackEvent: ['completed'],
            action: `${webhookUrls.voiceStatus}?callId=${callId}`,
            timeout: 30
        });

        dial.number({}, this.formatPhoneNumber(toNumber));

        return response.toString();
    }

    /**
     * Generate TwiML response for incoming calls
     * Routes to the specified identity (browser client)
     */
    generateIncomingTwiML(identity: string, callId: number, callerInfo?: { name?: string }): string {
        const webhookUrls = getWebhookUrls();
        const VoiceResponse = Twilio.twiml.VoiceResponse;
        const response = new VoiceResponse();

        // Optional greeting
        if (callerInfo?.name) {
            response.say({ voice: 'alice' }, `Incoming call from ${callerInfo.name}`);
        }

        const config = this.getConfig();
        // Connect to the browser client
        const dial = response.dial({
            record: config.recordingEnabled ? 'record-from-answer-dual' : 'do-not-record',
            recordingStatusCallback: webhookUrls.recording,
            recordingStatusCallbackEvent: ['completed'],
            action: `${webhookUrls.voiceStatus}?callId=${callId}`,
            timeout: 25
        });

        // Connect to the Twilio Client identity
        dial.client({}, identity);

        return response.toString();
    }

    /**
     * Generate TwiML for a simple voice response (e.g., voicemail)
     */
    generateVoicemailTwiML(message: string = 'Please leave a message after the beep.'): string {
        const webhookUrls = getWebhookUrls();
        const VoiceResponse = Twilio.twiml.VoiceResponse;
        const response = new VoiceResponse();

        response.say({ voice: 'alice' }, message);
        const config = this.getConfig();
        response.record({
            maxLength: 120,
            playBeep: true,
            transcribe: config.transcriptionEnabled,
            transcribeCallback: webhookUrls.transcription,
            recordingStatusCallback: webhookUrls.recording
        });
        response.say({ voice: 'alice' }, 'Thank you for your message. Goodbye.');
        response.hangup();

        return response.toString();
    }

    /**
     * Generate TwiML to reject a call
     */
    generateRejectTwiML(reason: 'busy' | 'rejected' = 'busy'): string {
        const VoiceResponse = Twilio.twiml.VoiceResponse;
        const response = new VoiceResponse();
        response.reject({ reason });
        return response.toString();
    }

    /**
     * End an active call
     */
    async endCall(callSid: string): Promise<void> {
        if (!this.client) {
            throw new Error('Twilio client not initialized');
        }

        try {
            await this.client.calls(callSid).update({ status: 'completed' });
            console.log(`[TwilioService] Call ended: ${callSid}`);
        } catch (error: any) {
            console.error('[TwilioService] Failed to end call:', error);
            throw new Error(error.message || 'Failed to end call');
        }
    }

    /**
     * Get call details from Twilio
     */
    async getCallDetails(callSid: string): Promise<any | null> {
        if (!this.client) {
            throw new Error('Twilio client not initialized');
        }

        try {
            return await this.client.calls(callSid).fetch();
        } catch (error: any) {
            console.error('[TwilioService] Failed to get call details:', error);
            return null;
        }
    }

    /**
     * Get recording details and download URL
     */
    async getRecording(recordingSid: string): Promise<{
        url: string;
        duration: number;
        status: string;
    } | null> {
        if (!this.client) {
            throw new Error('Twilio client not initialized');
        }

        try {
            const recording = await this.client.recordings(recordingSid).fetch();
            const config = this.getConfig();

            // Twilio recordings can be downloaded as .wav or .mp3
            const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Recordings/${recordingSid}.mp3`;

            return {
                url,
                duration: parseInt(recording.duration || '0', 10),
                status: recording.status
            };
        } catch (error: any) {
            console.error('[TwilioService] Failed to get recording:', error);
            return null;
        }
    }

    /**
     * Delete a recording from Twilio
     */
    async deleteRecording(recordingSid: string): Promise<boolean> {
        if (!this.client) {
            throw new Error('Twilio client not initialized');
        }

        try {
            await this.client.recordings(recordingSid).remove();
            return true;
        } catch (error: any) {
            console.error('[TwilioService] Failed to delete recording:', error);
            return false;
        }
    }

    /**
     * Validate Twilio webhook signature
     * 
     * IMPORTANT: Always validate webhooks to ensure they're from Twilio
     */
    validateWebhookSignature(
        signature: string,
        url: string,
        params: Record<string, string>
    ): boolean {
        const config = this.getConfig();
        if (!config.authToken) {
            console.warn('[TwilioService] Cannot validate webhook - auth token not configured');
            return false;
        }

        try {
            return Twilio.validateRequest(
                config.authToken,
                signature,
                url,
                params
            );
        } catch (error) {
            console.error('[TwilioService] Webhook validation error:', error);
            return false;
        }
    }

    /**
     * Map Twilio call status to our internal status
     */
    mapTwilioStatus(twilioStatus: string): string {
        const statusMap: Record<string, string> = {
            'queued': 'initiated',
            'initiated': 'initiated',
            'ringing': 'ringing',
            'in-progress': 'in-progress',
            'completed': 'completed',
            'busy': 'busy',
            'no-answer': 'no-answer',
            'failed': 'failed',
            'canceled': 'canceled'
        };

        return statusMap[twilioStatus] || twilioStatus;
    }

    /**
     * Format phone number to E.164 format
     */
    private formatPhoneNumber(phoneNumber: string): string {
        // Remove all non-digit characters except leading +
        let cleaned = phoneNumber.replace(/[^\d+]/g, '');

        // If no country code, assume US (+1)
        if (!cleaned.startsWith('+')) {
            // Remove leading 1 if present (US numbers sometimes start with 1)
            if (cleaned.startsWith('1') && cleaned.length === 11) {
                cleaned = '+' + cleaned;
            } else if (cleaned.length === 10) {
                cleaned = '+1' + cleaned;
            } else {
                cleaned = '+' + cleaned;
            }
        }

        return cleaned;
    }

    /**
     * Send DTMF tones to an active call
     */
    async sendDTMF(callSid: string, digits: string): Promise<void> {
        if (!this.client) {
            throw new Error('Twilio client not initialized');
        }

        const VoiceResponse = Twilio.twiml.VoiceResponse;
        const response = new VoiceResponse();
        response.play({ digits });

        try {
            await this.client.calls(callSid).update({
                twiml: response.toString()
            });
        } catch (error: any) {
            console.error('[TwilioService] Failed to send DTMF:', error);
            throw new Error(error.message || 'Failed to send DTMF tones');
        }
    }

    /**
     * Mute/unmute a call participant (for conference calls)
     */
    async setParticipantMute(
        conferenceSid: string,
        participantSid: string,
        muted: boolean
    ): Promise<void> {
        if (!this.client) {
            throw new Error('Twilio client not initialized');
        }

        try {
            await this.client
                .conferences(conferenceSid)
                .participants(participantSid)
                .update({ muted });
        } catch (error: any) {
            console.error('[TwilioService] Failed to update participant mute:', error);
            throw new Error(error.message || 'Failed to update mute status');
        }
    }

    /**
     * Hold/resume a call participant
     */
    async setParticipantHold(
        conferenceSid: string,
        participantSid: string,
        hold: boolean
    ): Promise<void> {
        if (!this.client) {
            throw new Error('Twilio client not initialized');
        }

        try {
            await this.client
                .conferences(conferenceSid)
                .participants(participantSid)
                .update({ hold });
        } catch (error: any) {
            console.error('[TwilioService] Failed to update participant hold:', error);
            throw new Error(error.message || 'Failed to update hold status');
        }
    }
}

// Singleton instance
let twilioServiceInstance: TwilioService | null = null;

export function getTwilioService(): TwilioService {
    if (!twilioServiceInstance) {
        twilioServiceInstance = new TwilioService();
    }
    return twilioServiceInstance;
}
