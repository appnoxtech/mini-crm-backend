/**
 * Twilio Configuration
 *
 * This file contains the configuration for Twilio integration.
 * All sensitive values should be stored in environment variables.
 */
export interface TwilioConfig {
    accountSid: string;
    authToken: string;
    apiKeySid: string;
    apiKeySecret: string;
    twimlAppSid: string;
    outgoingCallerId: string;
    recordingEnabled: boolean;
    transcriptionEnabled: boolean;
    recordingChannels: 'mono' | 'dual';
    webhookBaseUrl: string;
}
/**
 * Get Twilio configuration from environment variables
 */
export declare function getTwilioConfig(): TwilioConfig;
/**
 * Validate that all required Twilio configuration is present
 */
export declare function validateTwilioConfig(): {
    valid: boolean;
    missing: string[];
};
/**
 * Webhook URLs configuration
 */
export declare function getWebhookUrls(): {
    voice: string;
    voiceStatus: string;
    recording: string;
    transcription: string;
};
//# sourceMappingURL=twilioConfig.d.ts.map