export interface QuotaCheckRequest {
    user_email: string;
    message_size: number;
    recipients_count: number;
    estimated_quota_units: number;
}
export interface QuotaValidationResult {
    daily_quota_check: {
        used_quota: number;
        available_quota: number;
        required_quota: number;
        sufficient: boolean;
    };
    rate_limit_check: {
        current_requests_per_second: number;
        limit_requests_per_second: number;
        can_proceed: boolean;
    };
    user_quota_check: {
        user_daily_used: number;
        user_daily_limit: number;
        user_can_send: boolean;
    };
}
export interface QuotaStatus {
    can_send: boolean;
    quota_remaining: number;
    estimated_delay: number;
    next_available_slot: string;
}
export interface RateLimitStatus {
    current_load: string;
    recommended_delay: number;
    queue_position: number | null;
}
export declare class QuotaValidationService {
    private requestTracker;
    private quotaTracker;
    private readonly dailyQuotaLimit;
    private readonly requestsPerSecondLimit;
    private readonly userQuotaLimit;
    constructor(dailyQuotaLimit?: number, requestsPerSecondLimit?: number);
    validateQuota(request: QuotaCheckRequest): Promise<{
        quota_status: QuotaStatus;
        rate_limit_status: RateLimitStatus;
        validation_result: QuotaValidationResult;
    }>;
    private performQuotaValidation;
    private checkRateLimits;
    private generateQuotaStatus;
    private generateRateLimitStatus;
    recordQuotaUsage(userEmail: string, quotaUnits: number): void;
    recordRequestAttempt(): void;
    getQuotaUsage(key: string): number;
    private incrementQuotaUsage;
    private getCurrentRequestsPerSecond;
    private calculateRateLimitDelay;
    private calculateDelayUntilQuotaReset;
    private estimateQueuePosition;
    private getTodayKey;
    private getTomorrowDate;
    private setupCleanupInterval;
    getSystemQuotaStats(): {
        daily_usage_percentage: number;
        current_rps: number;
        rps_usage_percentage: number;
        active_users: number;
    };
}
//# sourceMappingURL=quotaValidationService.d.ts.map