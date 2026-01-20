import { GmailMessage } from './enhancedEmailComposer';
export interface SendRequest {
    method: 'gmail_api' | 'smtp_relay';
    message: GmailMessage;
    user_email: string;
    access_token: string;
}
export interface SendSuccessResponse {
    id: string;
    threadId: string;
    labelIds: string[];
    snippet: string;
    historyId: string;
    internalDate: string;
    sizeEstimate: number;
}
export interface SendErrorResponse {
    error: {
        code: number;
        message: string;
        status: string;
        details?: Array<{
            reason: string;
            domain: string;
        }>;
    };
}
export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    jitter: boolean;
}
export declare class EnhancedGmailService {
    private retryConfig;
    private circuitBreaker;
    constructor(retryConfig?: Partial<RetryConfig>);
    sendEmail(sendRequest: SendRequest): Promise<SendSuccessResponse>;
    private sendViaGmailAPI;
    private sendViaSMTPRelay;
    private executeWithRetry;
    private shouldRetry;
    private calculateDelay;
    private sleep;
    private handleGmailError;
    private extractThreadId;
    private generateSnippet;
    private isCircuitBreakerOpen;
    private recordFailure;
    private recordSuccess;
    getCircuitBreakerStatus(): Array<{
        userEmail: string;
        failures: number;
        isOpen: boolean;
        lastFailure: Date;
    }>;
    resetCircuitBreaker(userEmail: string): void;
    refreshAccessToken(refreshToken: string): Promise<{
        access_token: string;
        expires_in: number;
    }>;
}
//# sourceMappingURL=enhancedGmailService.d.ts.map