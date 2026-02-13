import axios, { AxiosError } from 'axios';
import { slackConfig } from '../../../config/slack.config';
import { slackRepository, TenantIntegration } from './slack.repository';

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
  is_archived: boolean;
}

export interface SlackMessagePayload {
  channel: string;
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: any[];
  accessory?: any;
  fields?: any[];
}

export interface SlackAttachment {
  color?: string;
  fallback?: string;
  pretext?: string;
  author_name?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: { title: string; value: string; short?: boolean }[];
  footer?: string;
  ts?: number;
}

export interface SendMessageResult {
  success: boolean;
  ts?: string;
  channel?: string;
  error?: string;
  shouldDisable?: boolean;
}

export class SlackService {
  async sendMessage(
    tenantId: string,
    payload: SlackMessagePayload
  ): Promise<SendMessageResult> {
    const integration = await slackRepository.findByTenantId(tenantId);

    if (!integration || !integration.isActive) {
      return {
        success: false,
        error: 'Slack integration not found or inactive',
      };
    }

    const botToken = slackRepository.getDecryptedToken(integration);
    if (!botToken) {
      return {
        success: false,
        error: 'Failed to decrypt bot token',
        shouldDisable: true,
      };
    }

    try {
      const response = await axios.post(
        `${slackConfig.apiBaseUrl}/chat.postMessage`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${botToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.ok) {
        return {
          success: true,
          ts: response.data.ts,
          channel: response.data.channel,
        };
      }

      return this.handleSlackError(response.data.error, integration.id);
    } catch (error) {
      return this.handleAxiosError(error as AxiosError, integration.id);
    }
  }

  async getChannels(tenantId: string): Promise<SlackChannel[]> {
    const integration = await slackRepository.findByTenantId(tenantId);

    if (!integration || !integration.isActive) {
      throw new Error('Slack integration not found or inactive');
    }

    const botToken = slackRepository.getDecryptedToken(integration);
    if (!botToken) {
      throw new Error('Failed to decrypt bot token');
    }

    const channels: SlackChannel[] = [];
    let cursor: string | undefined;

    do {
      const response = await axios.get(
        `${slackConfig.apiBaseUrl}/conversations.list`,
        {
          params: {
            types: 'public_channel,private_channel',
            exclude_archived: true,
            limit: 200,
            cursor,
          },
          headers: {
            Authorization: `Bearer ${botToken}`,
          },
        }
      );

      if (!response.data.ok) {
        throw new Error(`Slack API error: ${response.data.error}`);
      }

      channels.push(
        ...response.data.channels.map((ch: any) => ({
          id: ch.id,
          name: ch.name,
          is_private: ch.is_private,
          is_member: ch.is_member,
          is_archived: ch.is_archived,
        }))
      );

      cursor = response.data.response_metadata?.next_cursor;
    } while (cursor);

    return channels;
  }

  async testConnection(tenantId: string): Promise<{ success: boolean; teamName?: string; error?: string }> {
    const integration = await slackRepository.findByTenantId(tenantId);

    if (!integration || !integration.isActive) {
      return { success: false, error: 'Slack integration not found or inactive' };
    }

    const botToken = slackRepository.getDecryptedToken(integration);
    if (!botToken) {
      return { success: false, error: 'Failed to decrypt bot token' };
    }

    try {
      const response = await axios.get(`${slackConfig.apiBaseUrl}/auth.test`, {
        headers: {
          Authorization: `Bearer ${botToken}`,
        },
      });

      if (response.data.ok) {
        return { success: true, teamName: response.data.team };
      }

      return { success: false, error: response.data.error };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async setDefaultChannel(
    tenantId: string,
    channelId: string,
    channelName: string
  ): Promise<TenantIntegration> {
    const integration = await slackRepository.findByTenantId(tenantId);

    if (!integration) {
      throw new Error('Slack integration not found');
    }

    return slackRepository.update(integration.id, {
      defaultChannelId: channelId,
      defaultChannelName: channelName,
    });
  }

  async getIntegrationStatus(tenantId: string): Promise<{
    isConnected: boolean;
    workspaceName?: string;
    defaultChannel?: { id: string; name: string } | null;
    installedAt?: Date;
  }> {
    const integration = await slackRepository.findByTenantId(tenantId);

    if (!integration || !integration.isActive) {
      return { isConnected: false };
    }

    return {
      isConnected: true,
      workspaceName: integration.workspaceName || undefined,
      defaultChannel: integration.defaultChannelId
        ? {
            id: integration.defaultChannelId,
            name: integration.defaultChannelName || integration.defaultChannelId,
          }
        : null,
      installedAt: integration.createdAt,
    };
  }

  async disconnect(tenantId: string): Promise<boolean> {
    const integration = await slackRepository.findByTenantId(tenantId);

    if (!integration) {
      return false;
    }

    await slackRepository.update(integration.id, { isActive: false });
    return true;
  }

  private handleSlackError(
    error: string,
    integrationId: string
  ): SendMessageResult {
    const authErrors = [
      'invalid_auth',
      'account_inactive',
      'token_revoked',
      'token_expired',
      'not_authed',
    ];

    if (authErrors.includes(error)) {
      // Mark integration as inactive
      slackRepository.update(integrationId, { isActive: false }).catch((err) => {
        console.error('[SlackService] Failed to deactivate integration:', err);
      });

      return {
        success: false,
        error: `Authentication failed: ${error}`,
        shouldDisable: true,
      };
    }

    if (error === 'channel_not_found') {
      return {
        success: false,
        error: 'Channel not found. Please update your Slack channel settings.',
      };
    }

    if (error === 'not_in_channel') {
      return {
        success: false,
        error: 'Bot is not in the channel. Please invite the bot to the channel.',
      };
    }

    if (error === 'ratelimited') {
      return {
        success: false,
        error: 'Rate limited. Message will be retried.',
      };
    }

    return {
      success: false,
      error: `Slack API error: ${error}`,
    };
  }

  private handleAxiosError(
    error: AxiosError,
    integrationId: string
  ): SendMessageResult {
    if (error.response?.status === 401 || error.response?.status === 403) {
      slackRepository.update(integrationId, { isActive: false }).catch((err) => {
        console.error('[SlackService] Failed to deactivate integration:', err);
      });

      return {
        success: false,
        error: 'Authentication failed',
        shouldDisable: true,
      };
    }

    return {
      success: false,
      error: `Network error: ${error.message}`,
    };
  }
}

export const slackService = new SlackService();
