import { TwilioToken } from '../types';
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
export declare class TwilioService {
    private client;
    private _config;
    private initialized;
    constructor();
    /**
     * Get config lazily to ensure dotenv is loaded first
     */
    private getConfig;
    /**
     * Initialize the Twilio client
     */
    private initialize;
    /**
     * Check if Twilio is properly configured
     */
    isConfigured(): boolean;
    /**
     * Generate an access token for the Twilio Voice SDK in the browser
     *
     * @param userId - User ID to use as identity
     * @param userEmail - User email for identity
     * @param ttl - Token time-to-live in seconds (default: 1 hour)
     */
    generateAccessToken(userId: number, userEmail: string, ttl?: number): TwilioToken;
    /**
     * Initiate an outbound call via Twilio
     *
     * @param toNumber - Phone number to call
     * @param callId - Internal call ID for tracking
     * @param userId - User ID initiating the call
     */
    initiateCall(toNumber: string, callId: number, userId: number): Promise<{
        callSid: string;
        status: string;
    }>;
    /**
     * Generate TwiML response for outgoing calls (connects browser to PSTN)
     */
    generateOutboundTwiML(toNumber: string, callId: number): string;
    /**
     * Generate TwiML response for incoming calls
     * Routes to the specified identity (browser client)
     */
    generateIncomingTwiML(identity: string, callId: number, callerInfo?: {
        name?: string;
    }): string;
    /**
     * Generate TwiML for a simple voice response (e.g., voicemail)
     */
    generateVoicemailTwiML(message?: string): string;
    /**
     * Generate TwiML to reject a call
     */
    generateRejectTwiML(reason?: 'busy' | 'rejected'): string;
    /**
     * End an active call
     */
    endCall(callSid: string): Promise<void>;
    /**
     * Get call details from Twilio
     */
    getCallDetails(callSid: string): Promise<any | null>;
    /**
     * Get recording details and download URL
     */
    getRecording(recordingSid: string): Promise<{
        url: string;
        duration: number;
        status: string;
    } | null>;
    /**
     * Delete a recording from Twilio
     */
    deleteRecording(recordingSid: string): Promise<boolean>;
    /**
     * Validate Twilio webhook signature
     *
     * IMPORTANT: Always validate webhooks to ensure they're from Twilio
     */
    validateWebhookSignature(signature: string, url: string, params: Record<string, string>): boolean;
    /**
     * Map Twilio call status to our internal status
     */
    mapTwilioStatus(twilioStatus: string): string;
    /**
     * Format phone number to E.164 format
     */
    private formatPhoneNumber;
    /**
     * Send DTMF tones to an active call
     */
    sendDTMF(callSid: string, digits: string): Promise<void>;
    /**
     * Mute/unmute a call participant (for conference calls)
     */
    setParticipantMute(conferenceSid: string, participantSid: string, muted: boolean): Promise<void>;
    /**
     * Hold/resume a call participant
     */
    setParticipantHold(conferenceSid: string, participantSid: string, hold: boolean): Promise<void>;
}
export declare function getTwilioService(): TwilioService;
//# sourceMappingURL=twilioService.d.ts.map