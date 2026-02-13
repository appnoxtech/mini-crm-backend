import crypto from 'crypto';
import { slackConfig } from '../../../config/slack.config';
import { slackRepository } from './slack.repository';
import { addSlackMessageJob } from './slack.queue';
import { slackService, SlackBlock } from './slack.service';
import {
  eventBus,
  DealCreatedEvent,
  DealWonEvent,
  DealLostEvent,
  DealStageChangedEvent,
  CRMEvent,
} from '../../../infrastructure/event-bus';

export interface SlackEventPayload {
  token?: string;
  challenge?: string;
  type: string;
  team_id?: string;
  api_app_id?: string;
  event?: {
    type: string;
    [key: string]: any;
  };
  event_id?: string;
  event_time?: number;
}

export class SlackEventHandler {
  verifySlackSignature(
    signature: string,
    timestamp: string,
    body: string
  ): boolean {
    if (!slackConfig.signingSecret) {
      console.error('[SlackEvents] Signing secret not configured');
      return false;
    }

    // Check timestamp to prevent replay attacks (5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - parseInt(timestamp, 10)) > 300) {
      console.error('[SlackEvents] Request timestamp too old');
      return false;
    }

    const sigBasestring = `v0:${timestamp}:${body}`;
    const mySignature = `v0=${crypto
      .createHmac('sha256', slackConfig.signingSecret)
      .update(sigBasestring)
      .digest('hex')}`;

    return crypto.timingSafeEqual(
      Buffer.from(mySignature),
      Buffer.from(signature)
    );
  }

  async handleSlackEvent(payload: SlackEventPayload): Promise<{ challenge?: string } | void> {
    // Handle URL verification challenge
    if (payload.type === 'url_verification' && payload.challenge) {
      return { challenge: payload.challenge };
    }

    // Handle event callbacks
    if (payload.type === 'event_callback' && payload.event) {
      await this.processEvent(payload);
    }
  }

  private async processEvent(payload: SlackEventPayload): Promise<void> {
    const event = payload.event!;
    const teamId = payload.team_id;

    console.log(`[SlackEvents] Processing event: ${event.type}`, { teamId });

    switch (event.type) {
      case 'app_uninstalled':
        await this.handleAppUninstalled(teamId!);
        break;

      case 'tokens_revoked':
        await this.handleTokensRevoked(teamId!, event.tokens);
        break;

      default:
        console.log(`[SlackEvents] Unhandled event type: ${event.type}`);
    }
  }

  private async handleAppUninstalled(teamId: string): Promise<void> {
    console.log(`[SlackEvents] App uninstalled from workspace: ${teamId}`);

    try {
      await slackRepository.deleteByWorkspaceId(teamId);
      console.log(`[SlackEvents] Integration removed for workspace: ${teamId}`);
    } catch (error) {
      console.error(`[SlackEvents] Failed to remove integration:`, error);
    }
  }

  private async handleTokensRevoked(
    teamId: string,
    tokens: { oauth?: string[]; bot?: string[] }
  ): Promise<void> {
    console.log(`[SlackEvents] Tokens revoked for workspace: ${teamId}`, tokens);

    if (tokens.bot && tokens.bot.length > 0) {
      try {
        // Find and deactivate integration
        const integrations = await slackRepository.findAllActive();
        const integration = integrations.find((i) => i.workspaceId === teamId);

        if (integration) {
          await slackRepository.update(integration.id, { isActive: false });
          console.log(`[SlackEvents] Integration deactivated for workspace: ${teamId}`);
        }
      } catch (error) {
        console.error(`[SlackEvents] Failed to deactivate integration:`, error);
      }
    }
  }
}

export class CRMEventHandler {
  constructor() {
    this.registerEventListeners();
  }

  private registerEventListeners(): void {
    eventBus.subscribe<DealCreatedEvent>('deal.created', (event) =>
      this.handleDealCreated(event)
    );

    eventBus.subscribe<DealWonEvent>('deal.won', (event) =>
      this.handleDealWon(event)
    );

    eventBus.subscribe<DealLostEvent>('deal.lost', (event) =>
      this.handleDealLost(event)
    );

    eventBus.subscribe<DealStageChangedEvent>('deal.stage_changed', (event) =>
      this.handleDealStageChanged(event)
    );

    console.log('[CRMEventHandler] Event listeners registered');
  }

  private async handleDealCreated(event: DealCreatedEvent): Promise<void> {
    const integration = await slackRepository.findByTenantId(event.tenantId);

    if (!integration?.isActive || !integration.defaultChannelId) {
      return;
    }

    const blocks = this.buildDealCreatedBlocks(event);
    await this.queueMessage(event.tenantId, integration.defaultChannelId, blocks, event);
  }

  private async handleDealWon(event: DealWonEvent): Promise<void> {
    const integration = await slackRepository.findByTenantId(event.tenantId);

    if (!integration?.isActive || !integration.defaultChannelId) {
      return;
    }

    const blocks = this.buildDealWonBlocks(event);
    await this.queueMessage(event.tenantId, integration.defaultChannelId, blocks, event);
  }

  private async handleDealLost(event: DealLostEvent): Promise<void> {
    const integration = await slackRepository.findByTenantId(event.tenantId);

    if (!integration?.isActive || !integration.defaultChannelId) {
      return;
    }

    const blocks = this.buildDealLostBlocks(event);
    await this.queueMessage(event.tenantId, integration.defaultChannelId, blocks, event);
  }

  private async handleDealStageChanged(event: DealStageChangedEvent): Promise<void> {
    const integration = await slackRepository.findByTenantId(event.tenantId);

    if (!integration?.isActive || !integration.defaultChannelId) {
      return;
    }

    const blocks = this.buildStageChangedBlocks(event);
    await this.queueMessage(event.tenantId, integration.defaultChannelId, blocks, event);
  }

  private async queueMessage(
    tenantId: string,
    channelId: string,
    blocks: SlackBlock[],
    event: CRMEvent
  ): Promise<void> {
    const job = await addSlackMessageJob({
      tenantId,
      payload: {
        channel: channelId,
        blocks,
        unfurl_links: false,
        unfurl_media: false,
      },
      eventType: event.type,
      eventId: `${event.type}-${Date.now()}`,
    });

    if (job) {
      console.log(`[CRMEventHandler] Queued Slack message for ${event.type}, job ${job.id}`);
    } else {
      // Fallback to direct send if queue unavailable
      console.log(`[CRMEventHandler] Queue unavailable, sending directly`);
      await slackService.sendMessage(tenantId, {
        channel: channelId,
        blocks,
        unfurl_links: false,
        unfurl_media: false,
      });
    }
  }

  private buildDealCreatedBlocks(event: DealCreatedEvent): SlackBlock[] {
    const { payload } = event;
    const valueText = payload.value
      ? `${payload.currency || 'USD'} ${payload.value.toLocaleString()}`
      : 'No value';

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎯 New Deal Created',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Deal:*\n${payload.title}`,
          },
          {
            type: 'mrkdwn',
            text: `*Value:*\n${valueText}`,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Stage:*\n${payload.stageName || 'Unknown'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Contact:*\n${payload.personName || payload.organizationName || 'N/A'}`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Deal ID: ${payload.dealId} • Created at ${new Date(event.timestamp).toLocaleString()}`,
          },
        ],
      },
    ];
  }

  private buildDealWonBlocks(event: DealWonEvent): SlackBlock[] {
    const { payload } = event;
    const valueText = payload.value
      ? `${payload.currency || 'USD'} ${payload.value.toLocaleString()}`
      : 'No value';

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎉 Deal Won!',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${payload.title}* has been won!`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Value:*\n${valueText}`,
          },
          {
            type: 'mrkdwn',
            text: `*Deal ID:*\n${payload.dealId}`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Won at ${new Date(event.timestamp).toLocaleString()}`,
          },
        ],
      },
    ];
  }

  private buildDealLostBlocks(event: DealLostEvent): SlackBlock[] {
    const { payload } = event;
    const valueText = payload.value
      ? `Value: ${payload.value.toLocaleString()}`
      : '';

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '❌ Deal Lost',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${payload.title}* has been marked as lost.${valueText ? `\n${valueText}` : ''}`,
        },
      },
      ...(payload.lostReason
        ? [
            {
              type: 'section' as const,
              text: {
                type: 'mrkdwn' as const,
                text: `*Reason:* ${payload.lostReason}`,
              },
            },
          ]
        : []),
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Deal ID: ${payload.dealId} • Lost at ${new Date(event.timestamp).toLocaleString()}`,
          },
        ],
      },
    ];
  }

  private buildStageChangedBlocks(event: DealStageChangedEvent): SlackBlock[] {
    const { payload } = event;
    const valueText = payload.value
      ? ` (${payload.value.toLocaleString()})`
      : '';

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📊 *${payload.title}*${valueText} moved from *${payload.fromStage}* → *${payload.toStage}*`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Deal ID: ${payload.dealId} • ${new Date(event.timestamp).toLocaleString()}`,
          },
        ],
      },
    ];
  }
}

export const slackEventHandler = new SlackEventHandler();

let crmEventHandler: CRMEventHandler | null = null;

export const initializeCRMEventHandler = (): void => {
  if (!crmEventHandler) {
    crmEventHandler = new CRMEventHandler();
  }
};
