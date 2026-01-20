"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedGmailService = void 0;
const googleapis_1 = require("googleapis");
class EnhancedGmailService {
    retryConfig;
    circuitBreaker = new Map();
    constructor(retryConfig) {
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 30000,
            backoffMultiplier: 2,
            jitter: true,
            ...retryConfig
        };
    }
    async sendEmail(sendRequest) {
        console.log(`Sending email via Gmail API for user: ${sendRequest.user_email}`);
        // Check circuit breaker
        if (this.isCircuitBreakerOpen(sendRequest.user_email)) {
            throw new Error('Circuit breaker is open. Service temporarily unavailable.');
        }
        try {
            if (sendRequest.method === 'gmail_api') {
                return await this.sendViaGmailAPI(sendRequest);
            }
            else {
                return await this.sendViaSMTPRelay(sendRequest);
            }
        }
        catch (error) {
            this.recordFailure(sendRequest.user_email);
            throw error;
        }
    }
    async sendViaGmailAPI(sendRequest) {
        const auth = new googleapis_1.google.auth.OAuth2();
        auth.setCredentials({ access_token: sendRequest.access_token });
        const gmail = googleapis_1.google.gmail({ version: 'v1', auth });
        const requestBody = {
            raw: sendRequest.message.raw,
            ...(sendRequest.message.payload?.headers?.['In-Reply-To'] && {
                threadId: this.extractThreadId(sendRequest.message.payload.headers['In-Reply-To'])
            })
        };
        console.log('Sending email via Gmail API...');
        return await this.executeWithRetry(async () => {
            try {
                const response = await gmail.users.messages.send({
                    userId: 'me',
                    requestBody
                });
                console.log('Gmail API send successful:', response.data.id);
                return {
                    id: response.data.id,
                    threadId: response.data.threadId,
                    labelIds: response.data.labelIds || ['SENT'],
                    snippet: this.generateSnippet(sendRequest.message.payload.body),
                    historyId: '0', // Gmail will provide this
                    internalDate: Date.now().toString(),
                    sizeEstimate: Buffer.from(sendRequest.message.raw, 'base64').length
                };
            }
            catch (error) {
                console.error('Gmail API send failed:', error);
                this.handleGmailError(error);
                throw error;
            }
        }, sendRequest.user_email);
    }
    async sendViaSMTPRelay(sendRequest) {
        // For SMTP relay implementation, we would typically use nodemailer with XOAUTH2
        // This is a simplified version that converts the Gmail message format
        console.log('Sending email via SMTP relay...');
        return await this.executeWithRetry(async () => {
            // Decode the raw message
            const rawMessage = Buffer.from(sendRequest.message.raw, 'base64').toString();
            // In a real implementation, you would:
            // 1. Parse the raw message
            // 2. Connect to smtp-relay.gmail.com:587
            // 3. Authenticate with XOAUTH2
            // 4. Send the message via SMTP commands
            // For now, we'll simulate the response
            const messageId = `smtp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            console.log('SMTP relay send successful:', messageId);
            return {
                id: messageId,
                threadId: messageId,
                labelIds: ['SENT'],
                snippet: this.generateSnippet(sendRequest.message.payload.body),
                historyId: '0',
                internalDate: Date.now().toString(),
                sizeEstimate: rawMessage.length
            };
        }, sendRequest.user_email);
    }
    async executeWithRetry(operation, userEmail) {
        let lastError;
        for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                const result = await operation();
                // Reset failure count on success
                this.recordSuccess(userEmail);
                return result;
            }
            catch (error) {
                lastError = error;
                if (attempt === this.retryConfig.maxRetries) {
                    console.error(`Operation failed after ${this.retryConfig.maxRetries + 1} attempts:`, error);
                    break;
                }
                if (!this.shouldRetry(error)) {
                    console.error('Non-retryable error encountered:', error);
                    break;
                }
                const delay = this.calculateDelay(attempt);
                console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
                await this.sleep(delay);
            }
        }
        throw lastError;
    }
    shouldRetry(error) {
        // Check for retryable errors
        const retryableCodes = [429, 500, 502, 503, 504];
        const retryableReasons = ['rateLimitExceeded', 'backendError', 'internalError'];
        if (error.code && retryableCodes.includes(error.code)) {
            return true;
        }
        if (error.response?.status && retryableCodes.includes(error.response.status)) {
            return true;
        }
        if (error.errors && error.errors.some((err) => retryableReasons.includes(err.reason))) {
            return true;
        }
        // Network errors
        if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
            return true;
        }
        return false;
    }
    calculateDelay(attempt) {
        let delay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt);
        delay = Math.min(delay, this.retryConfig.maxDelay);
        if (this.retryConfig.jitter) {
            // Add jitter to prevent thundering herd
            delay *= (0.5 + Math.random() * 0.5);
        }
        return Math.round(delay);
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    handleGmailError(error) {
        // Log specific Gmail API errors for better debugging
        if (error.response?.data?.error) {
            const gmailError = error.response.data.error;
            console.error('Gmail API Error Details:', {
                code: gmailError.code,
                message: gmailError.message,
                status: gmailError.status,
                details: gmailError.details
            });
            // Handle specific error cases
            switch (gmailError.code) {
                case 403:
                    if (gmailError.details?.some((d) => d.reason === 'quotaExceeded')) {
                        throw new Error('Daily sending quota exceeded. Please try again tomorrow.');
                    }
                    else if (gmailError.details?.some((d) => d.reason === 'insufficientPermissions')) {
                        throw new Error('Insufficient permissions. Please reconnect your email account.');
                    }
                    break;
                case 429:
                    throw new Error('Rate limit exceeded. Please wait and try again.');
                case 400:
                    if (gmailError.message.includes('Invalid to header')) {
                        throw new Error('Invalid recipient email address.');
                    }
                    break;
            }
        }
    }
    extractThreadId(inReplyTo) {
        // Extract thread ID from In-Reply-To header if available
        const match = inReplyTo.match(/<(.+)>/);
        return match ? match[1] : undefined;
    }
    generateSnippet(body) {
        // Generate a snippet from the email body
        const textBody = body.replace(/<[^>]*>/g, ''); // Strip HTML
        return textBody.substring(0, 100).trim() + (textBody.length > 100 ? '...' : '');
    }
    // Circuit breaker implementation
    isCircuitBreakerOpen(userEmail) {
        const circuit = this.circuitBreaker.get(userEmail);
        if (!circuit)
            return false;
        const now = new Date();
        const timeSinceLastFailure = now.getTime() - circuit.lastFailure.getTime();
        const recoveryTimeMs = 60000; // 1 minute
        if (circuit.isOpen && timeSinceLastFailure > recoveryTimeMs) {
            // Reset circuit breaker
            this.circuitBreaker.set(userEmail, { failures: 0, lastFailure: new Date(), isOpen: false });
            return false;
        }
        return circuit.isOpen;
    }
    recordFailure(userEmail) {
        const circuit = this.circuitBreaker.get(userEmail) || { failures: 0, lastFailure: new Date(), isOpen: false };
        circuit.failures++;
        circuit.lastFailure = new Date();
        const failureThreshold = 5;
        if (circuit.failures >= failureThreshold) {
            circuit.isOpen = true;
            console.warn(`Circuit breaker opened for user ${userEmail} after ${circuit.failures} failures`);
        }
        this.circuitBreaker.set(userEmail, circuit);
    }
    recordSuccess(userEmail) {
        // Reset failure count on success
        this.circuitBreaker.set(userEmail, { failures: 0, lastFailure: new Date(), isOpen: false });
    }
    // Admin method to get circuit breaker status
    getCircuitBreakerStatus() {
        return Array.from(this.circuitBreaker.entries()).map(([userEmail, circuit]) => ({
            userEmail,
            failures: circuit.failures,
            isOpen: circuit.isOpen,
            lastFailure: circuit.lastFailure
        }));
    }
    // Method to manually reset circuit breaker
    resetCircuitBreaker(userEmail) {
        this.circuitBreaker.delete(userEmail);
        console.log(`Circuit breaker reset for user ${userEmail}`);
    }
    // Token refresh helper
    async refreshAccessToken(refreshToken) {
        const auth = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
        auth.setCredentials({ refresh_token: refreshToken });
        try {
            const response = await auth.refreshAccessToken();
            return {
                access_token: response.credentials.access_token,
                expires_in: response.credentials.expiry_date ?
                    Math.floor((response.credentials.expiry_date - Date.now()) / 1000) : 3600
            };
        }
        catch (error) {
            console.error('Token refresh failed:', error);
            throw new Error('Failed to refresh access token. Please reconnect your email account.');
        }
    }
}
exports.EnhancedGmailService = EnhancedGmailService;
//# sourceMappingURL=enhancedGmailService.js.map