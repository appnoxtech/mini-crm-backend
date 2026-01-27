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

export class QuotaValidationService {
  private requestTracker: Map<string, { count: number; resetTime: Date }> = new Map();
  private quotaTracker: Map<string, { used: number; resetTime: Date }> = new Map();
  private readonly dailyQuotaLimit: number;
  private readonly requestsPerSecondLimit: number;
  private readonly userQuotaLimit: number;

  constructor(
    dailyQuotaLimit: number = 1000000000,
    requestsPerSecondLimit: number = 100
  ) {
    this.dailyQuotaLimit = dailyQuotaLimit;
    this.requestsPerSecondLimit = requestsPerSecondLimit;
    this.userQuotaLimit = Math.floor(dailyQuotaLimit / 4); // 25% per user default

    this.setupCleanupInterval();
  }

  async validateQuota(request: QuotaCheckRequest): Promise<{
    quota_status: QuotaStatus;
    rate_limit_status: RateLimitStatus;
    validation_result: QuotaValidationResult;
  }> {


    // Perform quota validation
    const validation = this.performQuotaValidation(request);

    // Check rate limits
    const rateLimitCheck = this.checkRateLimits();

    // Generate final status
    const quotaStatus = this.generateQuotaStatus(validation, request.estimated_quota_units);
    const rateLimitStatus = this.generateRateLimitStatus(rateLimitCheck);

    return {
      quota_status: quotaStatus,
      rate_limit_status: rateLimitStatus,
      validation_result: validation
    };
  }

  private performQuotaValidation(request: QuotaCheckRequest): QuotaValidationResult {
    const today = this.getTodayKey();

    // Get daily quota usage
    const dailyQuotaUsed = this.getQuotaUsage(today);
    const availableQuota = this.dailyQuotaLimit - dailyQuotaUsed;
    const sufficientDailyQuota = availableQuota >= request.estimated_quota_units;

    // Get user quota usage
    const userKey = `user_${request.user_email}_${today}`;
    const userQuotaUsed = this.getQuotaUsage(userKey);
    const userCanSend = (this.userQuotaLimit - userQuotaUsed) >= request.estimated_quota_units;

    // Rate limit check
    const currentRPS = this.getCurrentRequestsPerSecond();
    const canProceedRateLimit = currentRPS < this.requestsPerSecondLimit;

    return {
      daily_quota_check: {
        used_quota: dailyQuotaUsed,
        available_quota: availableQuota,
        required_quota: request.estimated_quota_units,
        sufficient: sufficientDailyQuota
      },
      rate_limit_check: {
        current_requests_per_second: currentRPS,
        limit_requests_per_second: this.requestsPerSecondLimit,
        can_proceed: canProceedRateLimit
      },
      user_quota_check: {
        user_daily_used: userQuotaUsed,
        user_daily_limit: this.userQuotaLimit,
        user_can_send: userCanSend
      }
    };
  }

  private checkRateLimits(): { currentRPS: number; canProceed: boolean } {
    const currentRPS = this.getCurrentRequestsPerSecond();
    const canProceed = currentRPS < this.requestsPerSecondLimit;

    return { currentRPS, canProceed };
  }

  private generateQuotaStatus(validation: QuotaValidationResult, estimatedUnits: number): QuotaStatus {
    const canSend = validation.daily_quota_check.sufficient &&
      validation.rate_limit_check.can_proceed &&
      validation.user_quota_check.user_can_send;

    const quotaRemaining = Math.min(
      validation.daily_quota_check.available_quota,
      this.userQuotaLimit - validation.user_quota_check.user_daily_used
    );

    let estimatedDelay = 0;
    let nextAvailableSlot = 'immediate';

    if (!canSend) {
      if (!validation.rate_limit_check.can_proceed) {
        estimatedDelay = this.calculateRateLimitDelay();
        nextAvailableSlot = new Date(Date.now() + estimatedDelay * 1000).toISOString();
      } else {
        // Quota exhausted, wait until reset
        estimatedDelay = this.calculateDelayUntilQuotaReset();
        nextAvailableSlot = this.getTomorrowDate().toISOString();
      }
    }

    return {
      can_send: canSend,
      quota_remaining: Math.max(0, quotaRemaining - estimatedUnits),
      estimated_delay: estimatedDelay,
      next_available_slot: nextAvailableSlot
    };
  }

  private generateRateLimitStatus(rateLimitCheck: { currentRPS: number; canProceed: boolean }): RateLimitStatus {
    const loadPercentage = Math.round((rateLimitCheck.currentRPS / this.requestsPerSecondLimit) * 100);
    let recommendedDelay = 0;

    if (loadPercentage > 80) {
      recommendedDelay = Math.ceil((100 - loadPercentage) / 10); // Scale delay based on load
    }

    return {
      current_load: `${loadPercentage}%`,
      recommended_delay: recommendedDelay,
      queue_position: rateLimitCheck.canProceed ? null : this.estimateQueuePosition()
    };
  }

  recordQuotaUsage(userEmail: string, quotaUnits: number): void {
    const today = this.getTodayKey();

    // Record daily usage
    this.incrementQuotaUsage(today, quotaUnits);

    // Record user usage
    const userKey = `user_${userEmail}_${today}`;
    this.incrementQuotaUsage(userKey, quotaUnits);


  }

  recordRequestAttempt(): void {
    const now = new Date();
    const secondKey = `${Math.floor(now.getTime() / 1000)}`;

    const current = this.requestTracker.get(secondKey) || {
      count: 0,
      resetTime: new Date(now.getTime() + 1000)
    };

    current.count++;
    this.requestTracker.set(secondKey, current);
  }

  getQuotaUsage(key: string): number {
    const quota = this.quotaTracker.get(key);
    if (!quota || new Date() >= quota.resetTime) {
      return 0;
    }
    return quota.used;
  }

  private incrementQuotaUsage(key: string, units: number): void {
    const tomorrow = this.getTomorrowDate();
    const current = this.quotaTracker.get(key) || { used: 0, resetTime: tomorrow };

    // Reset if past reset time
    if (new Date() >= current.resetTime) {
      current.used = units;
      current.resetTime = tomorrow;
    } else {
      current.used += units;
    }

    this.quotaTracker.set(key, current);
  }

  private getCurrentRequestsPerSecond(): number {
    const now = Math.floor(Date.now() / 1000);
    const currentSecond = this.requestTracker.get(now.toString());
    return currentSecond?.count || 0;
  }

  private calculateRateLimitDelay(): number {
    // Calculate delay to bring RPS below limit
    const currentRPS = this.getCurrentRequestsPerSecond();
    if (currentRPS <= this.requestsPerSecondLimit) return 0;

    const excessRequests = currentRPS - this.requestsPerSecondLimit;
    return Math.ceil(excessRequests / this.requestsPerSecondLimit); // seconds
  }

  private calculateDelayUntilQuotaReset(): number {
    const now = new Date();
    const tomorrow = this.getTomorrowDate();
    return Math.ceil((tomorrow.getTime() - now.getTime()) / 1000); // seconds
  }

  private estimateQueuePosition(): number {
    // Simple estimation based on current load
    const currentRPS = this.getCurrentRequestsPerSecond();
    return Math.max(0, currentRPS - this.requestsPerSecondLimit);
  }

  private getTodayKey(): string {
    const dateString = new Date().toISOString();
    const parts = dateString.split('T');
    return parts[0] || dateString.substring(0, 10);
  }

  private getTomorrowDate(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  private setupCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      const now = new Date();

      // Clean quota tracker
      for (const [key, value] of this.quotaTracker.entries()) {
        if (now >= value.resetTime) {
          this.quotaTracker.delete(key);
        }
      }

      // Clean request tracker
      for (const [key, value] of this.requestTracker.entries()) {
        if (now >= value.resetTime) {
          this.requestTracker.delete(key);
        }
      }
    }, 300000); // 5 minutes
  }

  // Admin methods for monitoring
  getSystemQuotaStats(): {
    daily_usage_percentage: number;
    current_rps: number;
    rps_usage_percentage: number;
    active_users: number;
  } {
    const today = this.getTodayKey();
    const dailyUsed = this.getQuotaUsage(today);
    const currentRPS = this.getCurrentRequestsPerSecond();

    // Count active users (users with quota usage today)
    let activeUsers = 0;
    for (const key of this.quotaTracker.keys()) {
      if (key.startsWith(`user_`) && key.endsWith(`_${today}`)) {
        activeUsers++;
      }
    }

    return {
      daily_usage_percentage: Math.round((dailyUsed / this.dailyQuotaLimit) * 100),
      current_rps: currentRPS,
      rps_usage_percentage: Math.round((currentRPS / this.requestsPerSecondLimit) * 100),
      active_users: activeUsers
    };
  }
}
