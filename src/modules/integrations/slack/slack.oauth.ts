import axios from 'axios';
import crypto from 'crypto';
import { slackConfig } from '../../../config/slack.config';

export interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  app_id?: string;
  authed_user?: {
    id: string;
    scope?: string;
    access_token?: string;
    token_type?: string;
  };
  scope?: string;
  token_type?: string;
  access_token?: string;
  bot_user_id?: string;
  team?: {
    id: string;
    name: string;
  };
  enterprise?: {
    id: string;
    name: string;
  } | null;
  is_enterprise_install?: boolean;
  incoming_webhook?: {
    channel: string;
    channel_id: string;
    configuration_url: string;
    url: string;
  };
}

export interface SlackStatePayload {
  tenantId: string;
  userId: number;
  nonce: string;
  timestamp: number;
}

export class SlackOAuthService {
  private stateSecret: string;

  constructor() {
    this.stateSecret = process.env.JWT_SECRET || 'slack-oauth-state-secret';
  }

  generateState(tenantId: string, userId: number): string {
    const payload: SlackStatePayload = {
      tenantId,
      userId,
      nonce: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now(),
    };

    const stateData = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', this.stateSecret)
      .update(stateData)
      .digest('hex');

    return Buffer.from(`${stateData}:${signature}`).toString('base64url');
  }

  verifyState(state: string): SlackStatePayload | null {
    try {
      const decoded = Buffer.from(state, 'base64url').toString('utf8');
      const [stateData, signature] = decoded.split(':').reduce(
        (acc, part, index, arr) => {
          if (index === arr.length - 1) {
            return [acc[0], part];
          }
          return [acc[0] ? `${acc[0]}:${part}` : part, acc[1]];
        },
        ['', '']
      );

      const expectedSignature = crypto
        .createHmac('sha256', this.stateSecret)
        .update(stateData)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('[SlackOAuth] Invalid state signature');
        return null;
      }

      const payload: SlackStatePayload = JSON.parse(stateData);

      // Check if state is expired (15 minutes)
      const maxAge = 15 * 60 * 1000;
      if (Date.now() - payload.timestamp > maxAge) {
        console.error('[SlackOAuth] State expired');
        return null;
      }

      return payload;
    } catch (error) {
      console.error('[SlackOAuth] Failed to verify state:', error);
      return null;
    }
  }

  getInstallUrl(tenantId: string, userId: number): string {
    const state = this.generateState(tenantId, userId);
    const scopes = slackConfig.scopes.join(',');

    const params = new URLSearchParams({
      client_id: slackConfig.clientId,
      scope: scopes,
      redirect_uri: slackConfig.redirectUri,
      state,
    });

    return `${slackConfig.oauthAuthorizeUrl}?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<SlackOAuthResponse> {
    try {
      const response = await axios.post<SlackOAuthResponse>(
        `${slackConfig.apiBaseUrl}/oauth.v2.access`,
        null,
        {
          params: {
            client_id: slackConfig.clientId,
            client_secret: slackConfig.clientSecret,
            code,
            redirect_uri: slackConfig.redirectUri,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('[SlackOAuth] Token exchange failed:', error.response?.data || error.message);
      throw new Error('Failed to exchange code for token');
    }
  }

  async revokeToken(token: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `${slackConfig.apiBaseUrl}/auth.revoke`,
        null,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data.ok === true;
    } catch (error: any) {
      console.error('[SlackOAuth] Token revocation failed:', error.response?.data || error.message);
      return false;
    }
  }
}

export const slackOAuthService = new SlackOAuthService();
