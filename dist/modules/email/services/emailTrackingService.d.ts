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
export declare class EmailTrackingService {
    private trackingData;
    private campaignData;
    private trackingBaseUrl;
    private notificationService?;
    constructor(trackingBaseUrl?: string, notificationService?: RealTimeNotificationService);
    initializeTracking(request: TrackingRequest, recipients: string[]): Promise<EmailAnalytics>;
    trackEmailOpen(messageId: string, recipientEmail?: string, metadata?: {
        userAgent?: string;
        ipAddress?: string;
    }): Promise<void>;
    trackLinkClick(messageId: string, originalUrl: string, recipientEmail?: string, metadata?: {
        userAgent?: string;
        ipAddress?: string;
    }): Promise<string>;
    updateDeliveryStatus(messageId: string, status: 'delivered' | 'failed' | 'bounced', recipientEmail?: string, reason?: string): Promise<void>;
    private calculateEngagementScore;
    private updateCampaignStats;
    getEmailAnalytics(messageId: string): Promise<EmailAnalytics | undefined>;
    getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics | undefined>;
    getTopPerformingEmails(limit?: number): Promise<Array<{
        messageId: string;
        engagementScore: number;
        opens: number;
        clicks: number;
    }>>;
    getEngagementReport(timeframe?: 'day' | 'week' | 'month'): Promise<{
        total_sent: number;
        total_opened: number;
        total_clicked: number;
        average_open_rate: number;
        average_click_rate: number;
        top_performing_campaigns: Array<{
            campaign_id: string;
            open_rate: number;
            click_rate: number;
        }>;
    }>;
    cleanupOldData(daysToKeep?: number): void;
}
//# sourceMappingURL=emailTrackingService.d.ts.map