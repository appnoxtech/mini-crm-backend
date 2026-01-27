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

export class ErrorHandlingService {
  private deadLetterQueue: Map<string, DeadLetterQueueEntry> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private retryConfig: ExponentialBackoffConfig;
  private circuitBreakerConfig: CircuitBreakerConfig;

  constructor(
    retryConfig?: Partial<ExponentialBackoffConfig>,
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>
  ) {
    this.retryConfig = {
      base_delay: 1000,
      max_delay: 300000, // 5 minutes
      multiplier: 2,
      jitter: 0.1,
      ...retryConfig
    };

    this.circuitBreakerConfig = {
      failure_threshold: 5,
      recovery_timeout: 60000, // 1 minute
      half_open_max_calls: 3,
      ...circuitBreakerConfig
    };
  }

  classifyError(error: any, errorCode?: number): ErrorClassification {


    // Gmail API specific errors
    if (error.response?.data?.error) {
      return this.classifyGmailApiError(error.response.data.error);
    }

    // HTTP status code based classification
    if (errorCode || error.response?.status || error.code) {
      return this.classifyHttpError(errorCode || error.response?.status || error.code);
    }

    // Network errors
    if (this.isNetworkError(error)) {
      return {
        is_retryable: true,
        is_permanent: false,
        is_temporary: true,
        category: 'network',
        suggested_action: 'Retry with exponential backoff'
      };
    }

    // Default classification for unknown errors
    return {
      is_retryable: false,
      is_permanent: true,
      is_temporary: false,
      category: 'unknown',
      suggested_action: 'Log and investigate manually'
    };
  }

  private classifyGmailApiError(gmailError: any): ErrorClassification {
    const { code, message, details } = gmailError;

    switch (code) {
      case 400:
        if (message.includes('Invalid to header') || message.includes('Invalid email')) {
          return {
            is_retryable: false,
            is_permanent: true,
            is_temporary: false,
            category: 'client',
            suggested_action: 'Fix email address and retry'
          };
        }
        return {
          is_retryable: false,
          is_permanent: true,
          is_temporary: false,
          category: 'client',
          suggested_action: 'Fix request format and retry'
        };

      case 401:
        return {
          is_retryable: true,
          is_permanent: false,
          is_temporary: false,
          category: 'authentication',
          suggested_action: 'Refresh access token and retry'
        };

      case 403:
        if (details?.some((d: any) => d.reason === 'quotaExceeded')) {
          return {
            is_retryable: true,
            is_permanent: false,
            is_temporary: true,
            category: 'quota',
            suggested_action: 'Wait until quota reset and retry'
          };
        } else if (details?.some((d: any) => d.reason === 'insufficientPermissions')) {
          return {
            is_retryable: true,
            is_permanent: false,
            is_temporary: false,
            category: 'authentication',
            suggested_action: 'Re-authenticate with proper scopes'
          };
        }
        return {
          is_retryable: false,
          is_permanent: true,
          is_temporary: false,
          category: 'authentication',
          suggested_action: 'Check permissions and re-authenticate'
        };

      case 429:
        return {
          is_retryable: true,
          is_permanent: false,
          is_temporary: true,
          category: 'rate_limit',
          suggested_action: 'Wait and retry with exponential backoff'
        };

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          is_retryable: true,
          is_permanent: false,
          is_temporary: true,
          category: 'server',
          suggested_action: 'Retry with exponential backoff'
        };

      default:
        return {
          is_retryable: false,
          is_permanent: true,
          is_temporary: false,
          category: 'unknown',
          suggested_action: 'Log and investigate manually'
        };
    }
  }

  private classifyHttpError(code: number): ErrorClassification {
    if (code >= 400 && code < 500) {
      return {
        is_retryable: code === 429 || code === 408, // Rate limit or timeout
        is_permanent: code !== 429 && code !== 408,
        is_temporary: code === 429 || code === 408,
        category: code === 429 ? 'rate_limit' : code === 401 || code === 403 ? 'authentication' : 'client',
        suggested_action: code === 429 ? 'Wait and retry' : code === 401 ? 'Re-authenticate' : 'Fix request and retry'
      };
    }

    if (code >= 500) {
      return {
        is_retryable: true,
        is_permanent: false,
        is_temporary: true,
        category: 'server',
        suggested_action: 'Retry with exponential backoff'
      };
    }

    return {
      is_retryable: false,
      is_permanent: true,
      is_temporary: false,
      category: 'unknown',
      suggested_action: 'Log and investigate'
    };
  }

  private isNetworkError(error: any): boolean {
    const networkErrorCodes = ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED', 'EHOSTDOWN'];
    return networkErrorCodes.includes(error.code) || error.message?.includes('network');
  }

  makeRetryDecision(errorScenario: ErrorScenario): RetryDecision {


    const classification = this.classifyError(errorScenario.original_error, errorScenario.error_code);

    // Check if max retries reached
    if (errorScenario.retry_attempt >= errorScenario.max_retries) {
      return {
        should_retry: false,
        retry_delay: 0,
        next_attempt_time: new Date().toISOString(),
        retry_strategy: 'no_retry',
        max_retries_reached: true
      };
    }

    // Don't retry permanent errors
    if (!classification.is_retryable) {
      return {
        should_retry: false,
        retry_delay: 0,
        next_attempt_time: new Date().toISOString(),
        retry_strategy: 'no_retry'
      };
    }

    // Determine retry strategy and delay
    let retryDelay: number;
    let strategy: RetryDecision['retry_strategy'];

    switch (classification.category) {
      case 'rate_limit':
        // For rate limits, use exponential backoff with longer delays
        retryDelay = this.calculateExponentialBackoff(errorScenario.retry_attempt, 2.0);
        strategy = 'exponential_backoff';
        break;

      case 'quota':
        // For quota issues, wait until next quota period (simplified to 1 hour)
        retryDelay = 3600000; // 1 hour
        strategy = 'linear_backoff';
        break;

      case 'network':
      case 'server':
        // For temporary issues, use standard exponential backoff
        retryDelay = this.calculateExponentialBackoff(errorScenario.retry_attempt);
        strategy = 'exponential_backoff';
        break;

      case 'authentication':
        // For auth issues, try immediately after token refresh
        retryDelay = 1000; // 1 second
        strategy = 'immediate';
        break;

      default:
        retryDelay = this.calculateExponentialBackoff(errorScenario.retry_attempt);
        strategy = 'exponential_backoff';
    }

    const nextAttemptTime = new Date(Date.now() + retryDelay);

    return {
      should_retry: true,
      retry_delay: retryDelay,
      next_attempt_time: nextAttemptTime.toISOString(),
      retry_strategy: strategy
    };
  }

  private calculateExponentialBackoff(attempt: number, multiplier?: number): number {
    const mult = multiplier || this.retryConfig.multiplier;
    let delay = this.retryConfig.base_delay * Math.pow(mult, attempt);

    // Cap at max delay
    delay = Math.min(delay, this.retryConfig.max_delay);

    // Add jitter to prevent thundering herd
    const jitter = delay * this.retryConfig.jitter * Math.random();
    delay += jitter;

    return Math.round(delay);
  }

  addToDeadLetterQueue(messageId: string, errorScenario: ErrorScenario, originalRequest: any): void {


    const classification = this.classifyError(errorScenario.original_error, errorScenario.error_code);

    const entry: DeadLetterQueueEntry = {
      message_id: messageId,
      failure_reason: `${errorScenario.error_type}: ${errorScenario.error_message}`,
      final_error: errorScenario.original_error?.message || errorScenario.error_message,
      requires_manual_intervention: !classification.is_temporary,
      retry_count: errorScenario.retry_attempt,
      created_at: new Date(),
      last_attempt_at: new Date(),
      original_request: originalRequest
    };

    this.deadLetterQueue.set(messageId, entry);
  }

  getDeadLetterQueueEntries(): DeadLetterQueueEntry[] {
    return Array.from(this.deadLetterQueue.values());
  }

  removeFromDeadLetterQueue(messageId: string): boolean {
    return this.deadLetterQueue.delete(messageId);
  }

  // Circuit breaker implementation
  isCircuitBreakerOpen(serviceKey: string): boolean {
    const circuit = this.circuitBreakers.get(serviceKey);
    if (!circuit) return false;

    const now = Date.now();

    switch (circuit.state) {
      case 'closed':
        return false;

      case 'open':
        if (now - circuit.lastFailureTime >= this.circuitBreakerConfig.recovery_timeout) {
          circuit.state = 'half-open';
          circuit.halfOpenCalls = 0;
          this.circuitBreakers.set(serviceKey, circuit);
          return false;
        }
        return true;

      case 'half-open':
        return circuit.halfOpenCalls >= this.circuitBreakerConfig.half_open_max_calls;

      default:
        return false;
    }
  }

  recordCircuitBreakerSuccess(serviceKey: string): void {
    const circuit = this.circuitBreakers.get(serviceKey);
    if (!circuit) return;

    if (circuit.state === 'half-open') {
      circuit.state = 'closed';
      circuit.failures = 0;
      circuit.halfOpenCalls = 0;
    }

    this.circuitBreakers.set(serviceKey, circuit);
  }

  recordCircuitBreakerFailure(serviceKey: string): void {
    let circuit = this.circuitBreakers.get(serviceKey) || {
      state: 'closed' as const,
      failures: 0,
      lastFailureTime: 0,
      halfOpenCalls: 0
    };

    circuit.failures++;
    circuit.lastFailureTime = Date.now();

    if (circuit.state === 'half-open') {
      circuit.state = 'open';
    } else if (circuit.failures >= this.circuitBreakerConfig.failure_threshold) {
      circuit.state = 'open';
      console.warn(`Circuit breaker opened for service: ${serviceKey}`);
    }

    this.circuitBreakers.set(serviceKey, circuit);
  }

  getCircuitBreakerStatus(serviceKey: string): { state: string; failures: number; isOpen: boolean } {
    const circuit = this.circuitBreakers.get(serviceKey);
    if (!circuit) {
      return { state: 'closed', failures: 0, isOpen: false };
    }

    return {
      state: circuit.state,
      failures: circuit.failures,
      isOpen: this.isCircuitBreakerOpen(serviceKey)
    };
  }

  // Monitoring and analytics
  getErrorStatistics(timeframe: 'hour' | 'day' | 'week' = 'day'): {
    total_errors: number;
    error_by_category: Record<string, number>;
    retry_success_rate: number;
    circuit_breaker_trips: number;
    dead_letter_queue_size: number;
  } {
    const now = Date.now();
    const timeframeMs = timeframe === 'hour' ? 3600000 : timeframe === 'day' ? 86400000 : 604800000;
    const cutoff = now - timeframeMs;

    const recentDLQEntries = Array.from(this.deadLetterQueue.values())
      .filter(entry => entry.created_at.getTime() >= cutoff);

    const errorByCategory: Record<string, number> = {};
    let totalRetries = 0;
    let successfulRetries = 0;

    recentDLQEntries.forEach(entry => {
      const category = this.extractErrorCategory(entry.failure_reason);
      errorByCategory[category] = (errorByCategory[category] || 0) + 1;

      totalRetries += entry.retry_count;
      if (entry.retry_count > 0 && !entry.requires_manual_intervention) {
        successfulRetries += entry.retry_count - 1; // Assumes last retry failed
      }
    });

    const circuitBreakerTrips = Array.from(this.circuitBreakers.values())
      .filter(cb => cb.state === 'open').length;

    return {
      total_errors: recentDLQEntries.length,
      error_by_category: errorByCategory,
      retry_success_rate: totalRetries > 0 ? Math.round((successfulRetries / totalRetries) * 100) : 0,
      circuit_breaker_trips: circuitBreakerTrips,
      dead_letter_queue_size: this.deadLetterQueue.size
    };
  }

  private extractErrorCategory(failureReason: string): string {
    if (failureReason.includes('authentication')) return 'authentication';
    if (failureReason.includes('quota')) return 'quota';
    if (failureReason.includes('rate_limit')) return 'rate_limit';
    if (failureReason.includes('network')) return 'network';
    if (failureReason.includes('server')) return 'server';
    return 'unknown';
  }
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailureTime: number;
  halfOpenCalls: number;
}
