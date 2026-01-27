import { google } from 'googleapis';

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

export class MailSystemConfigService {
  private config: MailSystemConfig;
  private isInitialized = false;
  private quotaTracker: Map<string, { used: number; resetTime: Date }> = new Map();

  constructor() {
    this.config = this.loadConfiguration();
  }

  private loadConfiguration(): MailSystemConfig {
    return {
      google_credentials: {
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        service_account_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || undefined,
        scopes: ['https://www.googleapis.com/auth/gmail.send']
      },
      smtp_config: {
        server: 'smtp.gmail.com',
        port: 587,
        use_tls: true
      },
      rate_limits: {
        requests_per_second: parseInt(process.env.GMAIL_REQUESTS_PER_SECOND || '100'),
        daily_quota_limit: parseInt(process.env.GMAIL_DAILY_QUOTA || '1000000000'),
        batch_size: parseInt(process.env.EMAIL_BATCH_SIZE || '100')
      }
    };
  }

  async initializeSystem(): Promise<SystemInitializationOutput> {
    try {


      const servicesReady: string[] = [];
      let quotaAvailable = this.config.rate_limits.daily_quota_limit;

      // Load Google API credentials
      if (this.config.google_credentials.client_id && this.config.google_credentials.client_secret) {

        servicesReady.push('gmail_api');
      } else {
        console.warn('⚠ Google API credentials missing');
      }

      // Initialize authentication handlers
      if (this.initializeOAuthHandlers()) {

        servicesReady.push('oauth_service');
      }

      // Setup quota monitoring
      this.setupQuotaMonitoring();

      servicesReady.push('quota_monitor');

      // Configure retry mechanisms


      // Initialize logging systems


      // SMTP relay initialization
      if (this.config.smtp_config.server) {

        servicesReady.push('smtp_relay');
      }

      this.isInitialized = true;



      return {
        status: 'initialized',
        services_ready: servicesReady,
        quota_available: quotaAvailable
      };

    } catch (error: any) {
      console.error('Failed to initialize mail system:', error);
      return {
        status: 'failed',
        services_ready: [],
        quota_available: 0,
        error: error.message
      };
    }
  }

  private initializeOAuthHandlers(): boolean {
    try {
      // Validate OAuth configuration
      if (!this.config.google_credentials.client_id || !this.config.google_credentials.client_secret) {
        return false;
      }

      // Initialize Google OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        this.config.google_credentials.client_id,
        this.config.google_credentials.client_secret,
        process.env.GOOGLE_REDIRECT_URI
      );

      return true;
    } catch (error) {
      console.error('Failed to initialize OAuth handlers:', error);
      return false;
    }
  }

  private setupQuotaMonitoring(): void {
    // Initialize quota tracking for the current day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    this.quotaTracker.set('daily', {
      used: 0,
      resetTime: tomorrow
    });

    // Set up cleanup interval for expired quota entries
    setInterval(() => {
      const now = new Date();
      for (const [key, value] of this.quotaTracker.entries()) {
        if (now >= value.resetTime) {
          this.quotaTracker.delete(key);
        }
      }
    }, 60000); // Check every minute
  }

  getConfiguration(): MailSystemConfig {
    return { ...this.config };
  }

  isSystemInitialized(): boolean {
    return this.isInitialized;
  }

  updateQuotaUsage(userEmail: string, quotaUnits: number): void {
    const today = this.getTodayKey();
    const current = this.quotaTracker.get(today) || { used: 0, resetTime: this.getTomorrowDate() };
    current.used += quotaUnits;
    this.quotaTracker.set(today, current);

    // Track per-user quota
    const userKey = `user_${userEmail}_${today}`;
    const userCurrent = this.quotaTracker.get(userKey) || { used: 0, resetTime: this.getTomorrowDate() };
    userCurrent.used += quotaUnits;
    this.quotaTracker.set(userKey, userCurrent);
  }

  getQuotaStatus(userEmail?: string): {
    daily_used: number;
    daily_remaining: number;
    user_used?: number;
    user_remaining?: number;
  } {
    const today = this.getTodayKey();
    const dailyQuota = this.quotaTracker.get(today);
    const dailyUsed = dailyQuota?.used || 0;
    const dailyRemaining = this.config.rate_limits.daily_quota_limit - dailyUsed;

    const result: any = {
      daily_used: dailyUsed,
      daily_remaining: Math.max(0, dailyRemaining)
    };

    if (userEmail) {
      const userKey = `user_${userEmail}_${today}`;
      const userQuota = this.quotaTracker.get(userKey);
      const userUsed = userQuota?.used || 0;
      const userLimit = Math.floor(this.config.rate_limits.daily_quota_limit / 4); // 25% per user

      result.user_used = userUsed;
      result.user_remaining = Math.max(0, userLimit - userUsed);
    }

    return result;
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

  getRateLimits(): RateLimits {
    return { ...this.config.rate_limits };
  }

  validateQuotaAvailability(estimatedUnits: number, userEmail?: string): {
    can_send: boolean;
    quota_remaining: number;
    estimated_delay: number;
    next_available_slot: string;
  } {
    const quotaStatus = this.getQuotaStatus(userEmail);

    let canSend = quotaStatus.daily_remaining >= estimatedUnits;
    let quotaRemaining = quotaStatus.daily_remaining;

    if (userEmail && quotaStatus.user_remaining !== undefined) {
      canSend = canSend && quotaStatus.user_remaining >= estimatedUnits;
      quotaRemaining = Math.min(quotaRemaining, quotaStatus.user_remaining);
    }

    return {
      can_send: canSend,
      quota_remaining: quotaRemaining,
      estimated_delay: canSend ? 0 : this.calculateDelayUntilQuotaReset(),
      next_available_slot: canSend ? 'immediate' : this.getTomorrowDate().toISOString()
    };
  }

  private calculateDelayUntilQuotaReset(): number {
    const now = new Date();
    const tomorrow = this.getTomorrowDate();
    return Math.ceil((tomorrow.getTime() - now.getTime()) / 1000); // seconds
  }
}
