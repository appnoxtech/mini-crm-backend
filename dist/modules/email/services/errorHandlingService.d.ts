export interface ErrorScenario {
    error_type: 'authentication_error' | 'quota_exceeded' | 'rate_limit' | 'network_error' | 'server_error' | 'validation_error';
    error_code: number;
    error_message: string;
    retry_attempt: number;
    max_retries: number;
    original_error?: any;
}
export interface RetryDecision {
    should_retry: boolean;
    retry_delay: number;
    next_attempt_time: string;
    retry_strategy: 'exponential_backoff' | 'linear_backoff' | 'immediate' | 'no_retry';
    max_retries_reached?: boolean;
}
export interface DeadLetterQueueEntry {
    message_id: string;
    failure_reason: string;
    final_error: string;
    requires_manual_intervention: boolean;
    retry_count: number;
    created_at: Date;
    last_attempt_at: Date;
    original_request: any;
}
export interface CircuitBreakerConfig {
    failure_threshold: number;
    recovery_timeout: number;
    half_open_max_calls: number;
}
export interface ExponentialBackoffConfig {
    base_delay: number;
    max_delay: number;
    multiplier: number;
    jitter: number;
}
export interface ErrorClassification {
    is_retryable: boolean;
    is_permanent: boolean;
    is_temporary: boolean;
    category: 'authentication' | 'quota' | 'rate_limit' | 'network' | 'server' | 'client' | 'unknown';
    suggested_action: string;
}
export declare class ErrorHandlingService {
    private deadLetterQueue;
    private circuitBreakers;
    private retryConfig;
    private circuitBreakerConfig;
    constructor(retryConfig?: Partial<ExponentialBackoffConfig>, circuitBreakerConfig?: Partial<CircuitBreakerConfig>);
    classifyError(error: any, errorCode?: number): ErrorClassification;
    private classifyGmailApiError;
    private classifyHttpError;
    private isNetworkError;
    makeRetryDecision(errorScenario: ErrorScenario): RetryDecision;
    private calculateExponentialBackoff;
    addToDeadLetterQueue(messageId: string, errorScenario: ErrorScenario, originalRequest: any): void;
    getDeadLetterQueueEntries(): DeadLetterQueueEntry[];
    removeFromDeadLetterQueue(messageId: string): boolean;
    isCircuitBreakerOpen(serviceKey: string): boolean;
    recordCircuitBreakerSuccess(serviceKey: string): void;
    recordCircuitBreakerFailure(serviceKey: string): void;
    getCircuitBreakerStatus(serviceKey: string): {
        state: string;
        failures: number;
        isOpen: boolean;
    };
    getErrorStatistics(timeframe?: 'hour' | 'day' | 'week'): {
        total_errors: number;
        error_by_category: Record<string, number>;
        retry_success_rate: number;
        circuit_breaker_trips: number;
        dead_letter_queue_size: number;
    };
    private extractErrorCategory;
}
//# sourceMappingURL=errorHandlingService.d.ts.map