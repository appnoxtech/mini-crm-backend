export interface GoogleCredentials {
    client_id: string;
    client_secret: string;
    service_account_key?: string | undefined;
    scopes: string[];
}
export interface SMTPConfig {
    server: string;
    port: number;
    use_tls: boolean;
}
export interface RateLimits {
    requests_per_second: number;
    daily_quota_limit: number;
    batch_size: number;
}
export interface MailSystemConfig {
    google_credentials: GoogleCredentials;
    smtp_config: SMTPConfig;
    rate_limits: RateLimits;
}
export interface SystemInitializationOutput {
    status: 'initialized' | 'failed';
    services_ready: string[];
    quota_available: number;
    error?: string;
}
export declare class MailSystemConfigService {
    private config;
    private isInitialized;
    private quotaTracker;
    constructor();
    private loadConfiguration;
    initializeSystem(): Promise<SystemInitializationOutput>;
    private initializeOAuthHandlers;
    private setupQuotaMonitoring;
    getConfiguration(): MailSystemConfig;
    isSystemInitialized(): boolean;
    updateQuotaUsage(userEmail: string, quotaUnits: number): void;
    getQuotaStatus(userEmail?: string): {
        daily_used: number;
        daily_remaining: number;
        user_used?: number;
        user_remaining?: number;
    };
    private getTodayKey;
    private getTomorrowDate;
    getRateLimits(): RateLimits;
    validateQuotaAvailability(estimatedUnits: number, userEmail?: string): {
        can_send: boolean;
        quota_remaining: number;
        estimated_delay: number;
        next_available_slot: string;
    };
    private calculateDelayUntilQuotaReset;
}
//# sourceMappingURL=mailSystemConfig.d.ts.map