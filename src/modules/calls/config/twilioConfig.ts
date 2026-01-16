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
export function getTwilioConfig(): TwilioConfig {
    const config: TwilioConfig = {
        // Account credentials
        accountSid: process.env.TWILIO_ACCOUNT_SID || '',
        authToken: process.env.TWILIO_AUTH_TOKEN || '',

        // API Key for generating access tokens (recommended over auth token)
        apiKeySid: process.env.TWILIO_API_KEY_SID || '',
        apiKeySecret: process.env.TWILIO_API_KEY_SECRET || '',

        // TwiML Application SID for handling calls
        twimlAppSid: process.env.TWILIO_TWIML_APP_SID || '',

        // Verified phone number for outgoing calls
        outgoingCallerId: process.env.TWILIO_CALLER_ID || '',

        // Recording settings
        recordingEnabled: process.env.TWILIO_RECORDING_ENABLED === 'true',
        transcriptionEnabled: process.env.TWILIO_TRANSCRIPTION_ENABLED === 'true',
        recordingChannels: (process.env.TWILIO_RECORDING_CHANNELS as 'mono' | 'dual') || 'dual',

        // Webhook base URL for callbacks
        webhookBaseUrl: process.env.TWILIO_WEBHOOK_BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000'
    };

    return config;
}

/**
 * Validate that all required Twilio configuration is present
 */
export function validateTwilioConfig(): { valid: boolean; missing: string[] } {
    const config = getTwilioConfig();
    const missing: string[] = [];

    if (!config.accountSid) missing.push('TWILIO_ACCOUNT_SID');
    if (!config.authToken) missing.push('TWILIO_AUTH_TOKEN');
    if (!config.apiKeySid) missing.push('TWILIO_API_KEY_SID');
    if (!config.apiKeySecret) missing.push('TWILIO_API_KEY_SECRET');
    if (!config.twimlAppSid) missing.push('TWILIO_TWIML_APP_SID');
    if (!config.outgoingCallerId) missing.push('TWILIO_CALLER_ID');

    return {
        valid: missing.length === 0,
        missing
    };
}

/**
 * Webhook URLs configuration
 */
export function getWebhookUrls(): {
    voice: string;
    voiceStatus: string;
    recording: string;
    transcription: string;
} {
    const baseUrl = getTwilioConfig().webhookBaseUrl;

    return {
        voice: `${baseUrl}/api/webhooks/twilio/voice`,
        voiceStatus: `${baseUrl}/api/webhooks/twilio/status`,
        recording: `${baseUrl}/api/webhooks/twilio/recording`,
        transcription: `${baseUrl}/api/webhooks/twilio/transcription`
    };
}
