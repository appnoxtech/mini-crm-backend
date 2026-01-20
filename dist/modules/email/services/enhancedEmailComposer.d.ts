export interface EmailRequest {
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body_html?: string;
    body_text: string;
    attachments?: AttachmentData[];
    template_variables?: Record<string, string>;
    tracking?: TrackingOptions;
}
export interface AttachmentData {
    filename: string;
    content_type: string;
    data: string;
    size: number;
}
export interface TrackingOptions {
    open_tracking: boolean;
    click_tracking: boolean;
    campaign_id?: string;
}
export interface GmailMessage {
    raw: string;
    payload: {
        headers: Record<string, string>;
        body: string;
        parts: any[];
    };
}
export interface MessageMetadata {
    message_id: string;
    size: number;
    recipients_count: number;
    has_attachments: boolean;
    tracking_enabled: boolean;
}
export interface CompositionResult {
    gmail_message: GmailMessage;
    message_metadata: MessageMetadata;
    validation_errors?: string[];
}
export declare class EnhancedEmailComposer {
    private trackingBaseUrl;
    constructor(trackingBaseUrl?: string);
    composeEmail(emailRequest: EmailRequest): Promise<CompositionResult>;
    private validateEmailRequest;
    private isValidEmail;
    private generateMessageId;
    private replaceTemplateVariables;
    private applyPersonalizationAndTracking;
    private createTrackingPixel;
    private injectTrackingPixel;
    private wrapLinksWithTracking;
    private constructMimeMessage;
    private encodeQuotedPrintable;
    private formatBase64;
    private createGmailMessage;
    private createMessageMetadata;
    private createEmptyMetadata;
    estimateQuotaUnits(request: EmailRequest): number;
}
//# sourceMappingURL=enhancedEmailComposer.d.ts.map