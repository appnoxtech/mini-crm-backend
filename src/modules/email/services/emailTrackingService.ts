import { RealTimeNotificationService } from './realTimeNotificationService';

export interface TrackingRequest {
  message_id: string;
  tracking_enabled: boolean;
  campaign_id?: string;
}

export interface DeliveryStatus {
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  sent_time?: string;
  delivered_time?: string;
  bounce_reason?: string;
  recipient_status: Record<string, 'delivered' | 'pending' | 'bounced' | 'failed'>;
}

export interface EngagementMetrics {
  opened: boolean;
  clicked: boolean;
  open_count: number;
  click_count: number;
  engagement_score: number;
  first_open_time?: string;
  last_open_time?: string;
  unique_clicks: number;
  total_clicks: number;
}

export interface TrackingData {
  pixel_url: string;
  opened: boolean;
  open_count: number;
  first_open_time?: Date;
  last_open_time?: Date;
  tracked_links: TrackedLink[];
}

export interface TrackedLink {
  original_url: string;
  tracking_url: string;
  clicked: boolean;
  click_count: number;
  unique_clicks: number;
  first_click_time?: Date;
  last_click_time?: Date;
}

export interface EmailAnalytics {
  message_id: string;
  campaign_id?: string;
  sent_at: Date;
  delivery_status: DeliveryStatus;
  engagement_metrics: EngagementMetrics;
  tracking_data: TrackingData;
  recipient_analytics: RecipientAnalytics[];
}

export interface RecipientAnalytics {
  email: string;
  opened: boolean;
  clicked: boolean;
  open_times: Date[];
  click_events: ClickEvent[];
  engagement_score: number;
}

export interface ClickEvent {
  url: string;
  clicked_at: Date;
  user_agent?: string;
  ip_address?: string;
}

export interface CampaignAnalytics {
  campaign_id: string;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  unsubscribe_rate: number;
}

export class EmailTrackingService {
  private trackingData: Map<string, EmailAnalytics> = new Map();
  private campaignData: Map<string, CampaignAnalytics> = new Map();
  private trackingBaseUrl: string;
  private notificationService?: RealTimeNotificationService;

  constructor(trackingBaseUrl: string = process.env.TRACKING_BASE_URL || 'http://localhost:3001', notificationService?: RealTimeNotificationService) {
    this.trackingBaseUrl = trackingBaseUrl;
    this.notificationService = notificationService;
  }

  async initializeTracking(request: TrackingRequest, recipients: string[]): Promise<EmailAnalytics> {
    console.log(`Initializing tracking for message: ${request.message_id}`);

    const analytics: EmailAnalytics = {
      message_id: request.message_id,
      campaign_id: request.campaign_id,
      sent_at: new Date(),
      delivery_status: {
        status: 'sent',
        sent_time: new Date().toISOString(),
        recipient_status: {}
      },
      engagement_metrics: {
        opened: false,
        clicked: false,
        open_count: 0,
        click_count: 0,
        engagement_score: 0,
        unique_clicks: 0,
        total_clicks: 0
      },
      tracking_data: {
        pixel_url: `${this.trackingBaseUrl}/email/track/open/${request.message_id}`,
        opened: false,
        open_count: 0,
        tracked_links: []
      },
      recipient_analytics: recipients.map(email => ({
        email,
        opened: false,
        clicked: false,
        open_times: [],
        click_events: [],
        engagement_score: 0
      }))
    };

    // Initialize recipient statuses
    recipients.forEach(email => {
      analytics.delivery_status.recipient_status[email] = 'pending';
    });

    this.trackingData.set(request.message_id, analytics);

    // Update campaign analytics if applicable
    if (request.campaign_id) {
      this.updateCampaignStats(request.campaign_id, 'sent', recipients.length);
    }

    return analytics;
  }

  async trackEmailOpen(messageId: string, recipientEmail?: string, metadata?: { 
    userAgent?: string; 
    ipAddress?: string; 
  }): Promise<void> {
    console.log(`Tracking email open for message: ${messageId}`);

    const analytics = this.trackingData.get(messageId);
    if (!analytics) {
      console.warn(`No tracking data found for message: ${messageId}`);
      return;
    }

    const now = new Date();

    // Update overall tracking data
    analytics.tracking_data.open_count++;
    analytics.tracking_data.opened = true;
    
    if (!analytics.tracking_data.first_open_time) {
      analytics.tracking_data.first_open_time = now;
    }
    analytics.tracking_data.last_open_time = now;

    // Update engagement metrics
    analytics.engagement_metrics.opened = true;
    analytics.engagement_metrics.open_count++;
    if (!analytics.engagement_metrics.first_open_time) {
      analytics.engagement_metrics.first_open_time = now.toISOString();
    }

    // Update recipient-specific analytics
    if (recipientEmail) {
      const recipientAnalytics = analytics.recipient_analytics.find(r => r.email === recipientEmail);
      if (recipientAnalytics) {
        recipientAnalytics.opened = true;
        recipientAnalytics.open_times.push(now);
        recipientAnalytics.engagement_score += 10; // Base points for opening
      }
    }

    // Recalculate engagement score
    this.calculateEngagementScore(analytics);

    // Update campaign analytics
    if (analytics.campaign_id) {
      this.updateCampaignStats(analytics.campaign_id, 'opened', 1);
    }

    this.trackingData.set(messageId, analytics);
    console.log(`Email open tracked. Total opens: ${analytics.engagement_metrics.open_count}`);

    // Notify about email open event
    if (this.notificationService) {
      this.notificationService.notifyUser('system', {
        type: 'email_opened',
        data: {
          messageId,
          recipientEmail,
          openCount: analytics.engagement_metrics.open_count,
          timestamp: now
        },
        timestamp: now
      });
    }
  }

  async trackLinkClick(messageId: string, originalUrl: string, recipientEmail?: string, metadata?: { 
    userAgent?: string; 
    ipAddress?: string; 
  }): Promise<string> {
    console.log(`Tracking link click for message: ${messageId}, URL: ${originalUrl}`);

    const analytics = this.trackingData.get(messageId);
    if (!analytics) {
      console.warn(`No tracking data found for message: ${messageId}`);
      return originalUrl;
    }

    const now = new Date();

    // Find or create tracked link
    let trackedLink = analytics.tracking_data.tracked_links.find(link => link.original_url === originalUrl);
    if (!trackedLink) {
      trackedLink = {
        original_url: originalUrl,
        tracking_url: `${this.trackingBaseUrl}/email/track/click/${messageId}?url=${encodeURIComponent(originalUrl)}`,
        clicked: false,
        click_count: 0,
        unique_clicks: 0
      };
      analytics.tracking_data.tracked_links.push(trackedLink);
    }

    // Update tracked link data
    const isFirstClick = !trackedLink.clicked;
    trackedLink.clicked = true;
    trackedLink.click_count++;
    
    if (isFirstClick) {
      trackedLink.first_click_time = now;
      trackedLink.unique_clicks++;
    }
    trackedLink.last_click_time = now;

    // Update overall engagement metrics
    analytics.engagement_metrics.clicked = true;
    analytics.engagement_metrics.click_count++;
    analytics.engagement_metrics.total_clicks++;
    
    if (isFirstClick) {
      analytics.engagement_metrics.unique_clicks++;
    }

    // Update recipient-specific analytics
    if (recipientEmail) {
      const recipientAnalytics = analytics.recipient_analytics.find(r => r.email === recipientEmail);
      if (recipientAnalytics) {
        recipientAnalytics.clicked = true;
        recipientAnalytics.click_events.push({
          url: originalUrl,
          clicked_at: now,
          user_agent: metadata?.userAgent,
          ip_address: metadata?.ipAddress
        });
        recipientAnalytics.engagement_score += 25; // Higher points for clicking
      }
    }

    // Recalculate engagement score
    this.calculateEngagementScore(analytics);

    // Update campaign analytics
    if (analytics.campaign_id) {
      this.updateCampaignStats(analytics.campaign_id, 'clicked', 1);
    }

    this.trackingData.set(messageId, analytics);
    console.log(`Link click tracked. Total clicks: ${analytics.engagement_metrics.click_count}`);

    // Notify about link click event
    if (this.notificationService) {
      this.notificationService.notifyUser('system', {
        type: 'email_link_clicked',
        data: {
          messageId,
          originalUrl,
          recipientEmail,
          clickCount: analytics.engagement_metrics.click_count,
          timestamp: now
        },
        timestamp: now
      });
    }

    return originalUrl;
  }

  async updateDeliveryStatus(messageId: string, status: 'delivered' | 'failed' | 'bounced', recipientEmail?: string, reason?: string): Promise<void> {
    console.log(`Updating delivery status for message: ${messageId}, status: ${status}`);

    const analytics = this.trackingData.get(messageId);
    if (!analytics) {
      console.warn(`No tracking data found for message: ${messageId}`);
      return;
    }

    const now = new Date();

    if (recipientEmail) {
      analytics.delivery_status.recipient_status[recipientEmail] = status === 'bounced' ? 'bounced' : status;
    }

    // Update overall delivery status
    if (status === 'delivered') {
      analytics.delivery_status.status = 'delivered';
      analytics.delivery_status.delivered_time = now.toISOString();
      
      if (analytics.campaign_id) {
        this.updateCampaignStats(analytics.campaign_id, 'delivered', 1);
      }
    } else if (status === 'failed' || status === 'bounced') {
      if (!analytics.delivery_status.delivered_time) {
        analytics.delivery_status.status = 'failed';
      }
      analytics.delivery_status.bounce_reason = reason;
      
      if (analytics.campaign_id) {
        this.updateCampaignStats(analytics.campaign_id, 'bounced', 1);
      }
    }

    this.trackingData.set(messageId, analytics);
  }

  private calculateEngagementScore(analytics: EmailAnalytics): void {
    let score = 0;
    const totalRecipients = analytics.recipient_analytics.length;

    // Calculate based on opens and clicks
    const openRate = analytics.engagement_metrics.open_count / Math.max(1, totalRecipients);
    const clickRate = analytics.engagement_metrics.click_count / Math.max(1, totalRecipients);

    score = Math.min(100, Math.round((openRate * 30) + (clickRate * 70)));
    analytics.engagement_metrics.engagement_score = score;
  }

  private updateCampaignStats(campaignId: string, action: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced', count: number): void {
    let campaign = this.campaignData.get(campaignId);
    if (!campaign) {
      campaign = {
        campaign_id: campaignId,
        total_sent: 0,
        total_delivered: 0,
        total_opened: 0,
        total_clicked: 0,
        open_rate: 0,
        click_rate: 0,
        bounce_rate: 0,
        unsubscribe_rate: 0
      };
    }

    switch (action) {
      case 'sent':
        campaign.total_sent += count;
        break;
      case 'delivered':
        campaign.total_delivered += count;
        break;
      case 'opened':
        campaign.total_opened += count;
        break;
      case 'clicked':
        campaign.total_clicked += count;
        break;
      case 'bounced':
        // Bounced emails reduce delivered count
        break;
    }

    // Recalculate rates
    if (campaign.total_sent > 0) {
      campaign.open_rate = Math.round((campaign.total_opened / campaign.total_sent) * 100 * 100) / 100;
      campaign.click_rate = Math.round((campaign.total_clicked / campaign.total_sent) * 100 * 100) / 100;
      const bounced = campaign.total_sent - campaign.total_delivered;
      campaign.bounce_rate = Math.round((bounced / campaign.total_sent) * 100 * 100) / 100;
    }

    this.campaignData.set(campaignId, campaign);
  }

  async getEmailAnalytics(messageId: string): Promise<EmailAnalytics | undefined> {
    return this.trackingData.get(messageId);
  }

  async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics | undefined> {
    return this.campaignData.get(campaignId);
  }

  async getTopPerformingEmails(limit: number = 10): Promise<Array<{ messageId: string; engagementScore: number; opens: number; clicks: number }>> {
    const emails = Array.from(this.trackingData.entries())
      .map(([messageId, analytics]) => ({
        messageId,
        engagementScore: analytics.engagement_metrics.engagement_score,
        opens: analytics.engagement_metrics.open_count,
        clicks: analytics.engagement_metrics.click_count
      }))
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, limit);

    return emails;
  }

  async getEngagementReport(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
    total_sent: number;
    total_opened: number;
    total_clicked: number;
    average_open_rate: number;
    average_click_rate: number;
    top_performing_campaigns: Array<{ campaign_id: string; open_rate: number; click_rate: number }>;
  }> {
    const now = new Date();
    const timeframeDays = timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30;
    const cutoffDate = new Date(now.getTime() - (timeframeDays * 24 * 60 * 60 * 1000));

    const recentEmails = Array.from(this.trackingData.values())
      .filter(analytics => analytics.sent_at >= cutoffDate);

    const totalSent = recentEmails.length;
    const totalOpened = recentEmails.filter(email => email.engagement_metrics.opened).length;
    const totalClicked = recentEmails.filter(email => email.engagement_metrics.clicked).length;

    const averageOpenRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100 * 100) / 100 : 0;
    const averageClickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100 * 100) / 100 : 0;

    const campaignPerformance = Array.from(this.campaignData.values())
      .sort((a, b) => b.open_rate - a.open_rate)
      .slice(0, 5)
      .map(campaign => ({
        campaign_id: campaign.campaign_id,
        open_rate: campaign.open_rate,
        click_rate: campaign.click_rate
      }));

    return {
      total_sent: totalSent,
      total_opened: totalOpened,
      total_clicked: totalClicked,
      average_open_rate: averageOpenRate,
      average_click_rate: averageClickRate,
      top_performing_campaigns: campaignPerformance
    };
  }

  // Cleanup old tracking data (should be called periodically)
  cleanupOldData(daysToKeep: number = 90): void {
    const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
    
    for (const [messageId, analytics] of this.trackingData.entries()) {
      if (analytics.sent_at < cutoffDate) {
        this.trackingData.delete(messageId);
      }
    }

    console.log(`Cleaned up tracking data older than ${daysToKeep} days`);
  }
}
