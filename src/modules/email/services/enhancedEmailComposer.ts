import { EmailAttachment } from '../models/types';
import * as crypto from 'crypto';

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
  data: string; // base64 encoded
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

export class EnhancedEmailComposer {
  private trackingBaseUrl: string;

  constructor(trackingBaseUrl: string = process.env.TRACKING_BASE_URL || 'http://localhost:3001') {
    this.trackingBaseUrl = trackingBaseUrl;
  }

  async composeEmail(emailRequest: EmailRequest): Promise<CompositionResult> {


    // Step 1: Validation
    const validationErrors = this.validateEmailRequest(emailRequest);
    if (validationErrors.length > 0) {
      return {
        gmail_message: { raw: '', payload: { headers: {}, body: '', parts: [] } },
        message_metadata: this.createEmptyMetadata(),
        validation_errors: validationErrors
      };
    }

    // Step 2: Generate unique message ID
    const messageId = this.generateMessageId(emailRequest.from);

    // Step 3: Process template variables
    const processedSubject = this.replaceTemplateVariables(emailRequest.subject, emailRequest.template_variables);
    const processedBodyText = this.replaceTemplateVariables(emailRequest.body_text, emailRequest.template_variables);
    const processedBodyHtml = emailRequest.body_html ?
      this.replaceTemplateVariables(emailRequest.body_html, emailRequest.template_variables) : undefined;

    // Step 4: Apply personalization and tracking
    const { htmlBody, textBody } = await this.applyPersonalizationAndTracking(
      processedBodyHtml,
      processedBodyText,
      messageId,
      emailRequest.tracking
    );

    // Step 5: Construct MIME message
    const mimeMessage = this.constructMimeMessage({
      ...emailRequest,
      subject: processedSubject,
      body_text: textBody,
      body_html: htmlBody,
      messageId
    });

    // Step 6: Create Gmail message format
    const gmailMessage = this.createGmailMessage(mimeMessage);

    // Step 7: Generate metadata
    const metadata = this.createMessageMetadata(messageId, emailRequest, gmailMessage.raw);



    return {
      gmail_message: gmailMessage,
      message_metadata: metadata
    };
  }

  private validateEmailRequest(request: EmailRequest): string[] {
    const errors: string[] = [];

    if (!request.to || request.to.length === 0) {
      errors.push('At least one recipient is required');
    }

    if (!request.subject?.trim()) {
      errors.push('Subject is required');
    }

    if (!request.body_text?.trim()) {
      errors.push('Body text is required');
    }

    if (!this.isValidEmail(request.from)) {
      errors.push('Invalid sender email address');
    }

    // Validate recipient emails
    [...(request.to || []), ...(request.cc || []), ...(request.bcc || [])].forEach(email => {
      if (!this.isValidEmail(email)) {
        errors.push(`Invalid email address: ${email}`);
      }
    });

    // Check attachment size limits
    if (request.attachments) {
      const totalSize = request.attachments.reduce((sum, att) => sum + att.size, 0);
      const maxSize = 25 * 1024 * 1024; // 25MB Gmail limit

      if (totalSize > maxSize) {
        errors.push(`Total attachment size (${Math.round(totalSize / 1024 / 1024)}MB) exceeds limit (25MB)`);
      }
    }

    return errors;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private generateMessageId(fromEmail: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const domain = fromEmail.split('@')[1] || 'localhost';
    return `${timestamp}-${random}@${domain}`;
  }

  private replaceTemplateVariables(text: string, variables?: Record<string, string>): string {
    if (!variables || !text) return text;

    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }

    return result;
  }

  private async applyPersonalizationAndTracking(
    htmlBody: string | undefined,
    textBody: string,
    messageId: string,
    tracking?: TrackingOptions
  ): Promise<{ htmlBody?: string; textBody: string }> {
    let processedHtmlBody = htmlBody;
    let processedTextBody = textBody;

    if (tracking?.open_tracking && processedHtmlBody) {
      // Inject tracking pixel
      const trackingPixel = this.createTrackingPixel(messageId);
      processedHtmlBody = this.injectTrackingPixel(processedHtmlBody, trackingPixel);
    }

    if (tracking?.click_tracking && processedHtmlBody) {
      // Replace links with tracking URLs
      processedHtmlBody = this.wrapLinksWithTracking(processedHtmlBody, messageId);
    }

    return {
      htmlBody: processedHtmlBody,
      textBody: processedTextBody
    };
  }

  private createTrackingPixel(messageId: string): string {
    const trackingUrl = `${this.trackingBaseUrl}/email/track/open/${messageId}`;
    return `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />`;
  }

  private injectTrackingPixel(htmlBody: string, trackingPixel: string): string {
    // Try to inject before closing body tag, fallback to append
    if (htmlBody.includes('</body>')) {
      return htmlBody.replace('</body>', `${trackingPixel}</body>`);
    } else {
      return htmlBody + trackingPixel;
    }
  }

  private wrapLinksWithTracking(htmlBody: string, messageId: string): string {
    const linkRegex = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;

    return htmlBody.replace(linkRegex, (match, url) => {
      if (url.startsWith('mailto:') || url.startsWith('#') || url.includes(this.trackingBaseUrl)) {
        return match; // Don't track mailto links, anchors, or existing tracking URLs
      }

      const trackingUrl = `${this.trackingBaseUrl}/email/track/click/${messageId}?url=${encodeURIComponent(url)}`;
      return match.replace(url, trackingUrl);
    });
  }

  private constructMimeMessage(request: EmailRequest & { messageId: string }): string {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const date = new Date().toUTCString();

    // Construct headers
    const headers = [
      `From: ${request.from}`,
      `To: ${request.to.join(', ')}`,
      ...(request.cc ? [`Cc: ${request.cc.join(', ')}`] : []),
      ...(request.bcc ? [`Bcc: ${request.bcc.join(', ')}`] : []),
      `Subject: ${request.subject}`,
      `Date: ${date}`,
      `Message-ID: <${request.messageId}>`,
      `MIME-Version: 1.0`
    ];

    // Determine content type
    const hasAttachments = Boolean(request.attachments && request.attachments.length > 0);
    const hasHtml = request.body_html !== undefined;
    const hasMultipleBodyTypes = hasHtml && request.body_text;

    let contentType: string;
    if (hasAttachments) {
      contentType = `Content-Type: multipart/mixed; boundary="${boundary}"`;
    } else if (hasMultipleBodyTypes) {
      contentType = `Content-Type: multipart/alternative; boundary="${boundary}"`;
    } else if (hasHtml) {
      contentType = `Content-Type: text/html; charset=utf-8`;
    } else {
      contentType = `Content-Type: text/plain; charset=utf-8`;
    }

    headers.push(contentType);

    // Start building message
    let message = headers.join('\r\n') + '\r\n\r\n';

    // Handle simple single-part messages
    if (!hasAttachments && !hasMultipleBodyTypes) {
      message += hasHtml ? request.body_html : request.body_text;
      return message;
    }

    // Handle multipart messages
    if (hasMultipleBodyTypes) {
      // Alternative parts (text and HTML)
      const altBoundary = `alt_${boundary}`;
      message += `--${boundary}\r\n`;
      message += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;

      // Text part
      message += `--${altBoundary}\r\n`;
      message += `Content-Type: text/plain; charset=utf-8\r\n`;
      message += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      message += this.encodeQuotedPrintable(request.body_text) + '\r\n\r\n';

      // HTML part
      message += `--${altBoundary}\r\n`;
      message += `Content-Type: text/html; charset=utf-8\r\n`;
      message += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      message += this.encodeQuotedPrintable(request.body_html!) + '\r\n\r\n';

      message += `--${altBoundary}--\r\n`;
    } else {
      // Single body type
      message += `--${boundary}\r\n`;
      message += `Content-Type: ${hasHtml ? 'text/html' : 'text/plain'}; charset=utf-8\r\n`;
      message += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      message += this.encodeQuotedPrintable(hasHtml ? request.body_html! : request.body_text) + '\r\n\r\n';
    }

    // Add attachments
    if (hasAttachments) {
      for (const attachment of request.attachments!) {
        message += `--${boundary}\r\n`;
        message += `Content-Type: ${attachment.content_type}\r\n`;
        message += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
        message += `Content-Transfer-Encoding: base64\r\n\r\n`;
        message += this.formatBase64(attachment.data) + '\r\n\r\n';
      }
    }

    message += `--${boundary}--\r\n`;
    return message;
  }

  private encodeQuotedPrintable(text: string): string {
    // Simple quoted-printable encoding
    return text.replace(/[^\x20-\x7E]/g, (match) => {
      const hex = match.charCodeAt(0).toString(16).toUpperCase();
      return `=${hex.padStart(2, '0')}`;
    });
  }

  private formatBase64(base64Data: string): string {
    // Gmail prefers 76-character lines for base64
    const lineLength = 76;
    const lines = [];
    for (let i = 0; i < base64Data.length; i += lineLength) {
      lines.push(base64Data.substring(i, i + lineLength));
    }
    return lines.join('\r\n');
  }

  private createGmailMessage(mimeMessage: string): GmailMessage {
    const rawMessage = Buffer.from(mimeMessage).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Parse headers for payload
    const headers: Record<string, string> = {};
    const headerLines = (mimeMessage.split('\r\n\r\n')[0] || '').split('\r\n');
    headerLines.forEach(line => {
      const [key, ...valueParts] = line.split(': ');
      if (key && valueParts.length > 0) {
        headers[key] = valueParts.join(': ');
      }
    });

    return {
      raw: rawMessage,
      payload: {
        headers,
        body: mimeMessage.split('\r\n\r\n').slice(1).join('\r\n\r\n'),
        parts: [] // Simplified for now
      }
    };
  }

  private createMessageMetadata(messageId: string, request: EmailRequest, rawMessage: string): MessageMetadata {
    const totalRecipients = (request.to?.length || 0) + (request.cc?.length || 0) + (request.bcc?.length || 0);
    const messageSize = Buffer.from(rawMessage, 'base64').length;
    const hasAttachments = Boolean(request.attachments && request.attachments.length > 0);
    const trackingEnabled = request.tracking?.open_tracking || request.tracking?.click_tracking || false;

    return {
      message_id: messageId,
      size: messageSize,
      recipients_count: totalRecipients,
      has_attachments: hasAttachments,
      tracking_enabled: trackingEnabled
    };
  }

  private createEmptyMetadata(): MessageMetadata {
    return {
      message_id: '',
      size: 0,
      recipients_count: 0,
      has_attachments: false,
      tracking_enabled: false
    };
  }

  // Utility method to estimate quota units based on message characteristics
  estimateQuotaUnits(request: EmailRequest): number {
    const baseUnits = 1;
    const recipientMultiplier = Math.max(1, (request.to?.length || 0) + (request.cc?.length || 0) + (request.bcc?.length || 0));
    const attachmentBonus = request.attachments && request.attachments.length > 0 ? 2 : 0;

    return baseUnits * recipientMultiplier + attachmentBonus;
  }
}
