import { Request, Response } from 'express';
import { slackOAuthService } from './slack.oauth';
import { slackService } from './slack.service';
import { slackRepository } from './slack.repository';
import { slackEventHandler } from './slack.events';
import { isSlackConfigured } from '../../../config/slack.config';
import { getQueueStats } from './slack.queue';
import { AuthenticatedRequest } from '../../../shared/types';

export class SlackController {
  async getInstallUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!isSlackConfigured()) {
        res.status(503).json({
          success: false,
          error: 'Slack integration is not configured',
        });
        return;
      }

      const userId = req.user?.id;
      const tenantId = String(userId);

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const installUrl = slackOAuthService.getInstallUrl(tenantId, userId);

      res.json({
        success: true,
        installUrl,
      });
    } catch (error: any) {
      console.error('[SlackController] getInstallUrl error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate install URL',
      });
    }
  }

  async handleCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state, error } = req.query;

      if (error) {
        console.error('[SlackController] OAuth error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?slack_error=${error}`);
        return;
      }

      if (!code || !state) {
        res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?slack_error=missing_params`);
        return;
      }

      // Verify state
      const statePayload = slackOAuthService.verifyState(state as string);
      if (!statePayload) {
        res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?slack_error=invalid_state`);
        return;
      }

      // Exchange code for token
      const tokenResponse = await slackOAuthService.exchangeCodeForToken(code as string);

      if (!tokenResponse.ok || !tokenResponse.access_token) {
        console.error('[SlackController] Token exchange failed:', tokenResponse.error);
        res.redirect(
          `${process.env.FRONTEND_URL}/settings/integrations?slack_error=${tokenResponse.error || 'token_exchange_failed'}`
        );
        return;
      }

      // Store integration
      await slackRepository.upsert({
        tenantId: statePayload.tenantId,
        provider: 'slack',
        workspaceId: tokenResponse.team?.id || '',
        workspaceName: tokenResponse.team?.name || '',
        botToken: tokenResponse.access_token,
        installedByUserId: statePayload.userId,
        metadata: {
          appId: tokenResponse.app_id,
          botUserId: tokenResponse.bot_user_id,
          scope: tokenResponse.scope,
          isEnterpriseInstall: tokenResponse.is_enterprise_install,
        },
      });

      console.log(
        `[SlackController] Slack installed for tenant ${statePayload.tenantId}, workspace: ${tokenResponse.team?.name}`
      );

      res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?slack_success=true`);
    } catch (error: any) {
      console.error('[SlackController] handleCallback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?slack_error=callback_failed`);
    }
  }

  async handleEvents(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-slack-signature'] as string;
      const timestamp = req.headers['x-slack-request-timestamp'] as string;
      const rawBody = JSON.stringify(req.body);

      // Verify request signature
      if (!slackEventHandler.verifySlackSignature(signature, timestamp, rawBody)) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const result = await slackEventHandler.handleSlackEvent(req.body);

      // Return challenge for URL verification
      if (result?.challenge) {
        res.json({ challenge: result.challenge });
        return;
      }

      res.status(200).send();
    } catch (error: any) {
      console.error('[SlackController] handleEvents error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const tenantId = String(userId);

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const status = await slackService.getIntegrationStatus(tenantId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      console.error('[SlackController] getStatus error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get integration status',
      });
    }
  }

  async getChannels(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const tenantId = String(userId);

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const channels = await slackService.getChannels(tenantId);

      res.json({
        success: true,
        data: channels,
      });
    } catch (error: any) {
      console.error('[SlackController] getChannels error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch channels',
      });
    }
  }

  async updateChannel(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const tenantId = String(userId);
      const { channelId, channelName } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      if (!channelId) {
        res.status(400).json({
          success: false,
          error: 'Channel ID is required',
        });
        return;
      }

      await slackService.setDefaultChannel(tenantId, channelId, channelName || channelId);

      res.json({
        success: true,
        message: 'Default channel updated',
      });
    } catch (error: any) {
      console.error('[SlackController] updateChannel error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update channel',
      });
    }
  }

  async disconnect(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const tenantId = String(userId);

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const success = await slackService.disconnect(tenantId);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'No active Slack integration found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Slack integration disconnected',
      });
    } catch (error: any) {
      console.error('[SlackController] disconnect error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to disconnect Slack',
      });
    }
  }

  async testConnection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const tenantId = String(userId);

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const result = await slackService.testConnection(tenantId);

      res.json({
        success: result.success,
        data: result.success ? { teamName: result.teamName } : undefined,
        error: result.error,
      });
    } catch (error: any) {
      console.error('[SlackController] testConnection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test connection',
      });
    }
  }

  async getQueueHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const stats = await getQueueStats();

      res.json({
        success: true,
        data: stats || { message: 'Queue not available' },
      });
    } catch (error: any) {
      console.error('[SlackController] getQueueHealth error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get queue health',
      });
    }
  }
}

export const slackController = new SlackController();
