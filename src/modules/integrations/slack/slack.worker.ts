import Bull from 'bull';
import { getSlackMessageQueue, SlackMessageJob, SlackJobResult } from './slack.queue';
import { slackService } from './slack.service';
import { slackRepository } from './slack.repository';

export class SlackWorker {
  private isRunning: boolean = false;

  async start(): Promise<void> {
    const queue = getSlackMessageQueue();

    if (!queue) {
      console.warn('[SlackWorker] Cannot start worker, queue not available');
      return;
    }

    if (this.isRunning) {
      console.warn('[SlackWorker] Worker already running');
      return;
    }

    this.isRunning = true;

    queue.process(async (job: Bull.Job<SlackMessageJob>): Promise<SlackJobResult> => {
      console.log(`[SlackWorker] Processing job ${job.id}:`, {
        tenantId: job.data.tenantId,
        eventType: job.data.eventType,
        channel: job.data.payload.channel,
      });

      try {
        const result = await slackService.sendMessage(
          job.data.tenantId,
          job.data.payload
        );

        if (!result.success) {
          if (result.shouldDisable) {
            console.warn(`[SlackWorker] Integration disabled for tenant ${job.data.tenantId}`);
            throw new Error(`Integration disabled: ${result.error}`);
          }

          if (result.error?.includes('ratelimited')) {
            const retryAfter = 30000; // 30 seconds default
            throw new Error(`Rate limited, will retry after ${retryAfter}ms`);
          }

          console.error(`[SlackWorker] Message send failed:`, result.error);
          throw new Error(result.error || 'Unknown error');
        }

        return {
          success: true,
          ts: result.ts,
          channel: result.channel,
        };
      } catch (error: any) {
        console.error(`[SlackWorker] Job ${job.id} error:`, error.message);
        throw error;
      }
    });

    queue.on('stalled', (job) => {
      console.warn(`[SlackWorker] Job ${job.id} stalled`);
    });

    console.log('[SlackWorker] Worker started');
  }

  async stop(): Promise<void> {
    const queue = getSlackMessageQueue();

    if (queue && this.isRunning) {
      await queue.pause();
      this.isRunning = false;
      console.log('[SlackWorker] Worker stopped');
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

export const slackWorker = new SlackWorker();

export const startSlackWorker = async (): Promise<void> => {
  try {
    await slackWorker.start();
  } catch (error) {
    console.error('[SlackWorker] Failed to start:', error);
  }
};

export const stopSlackWorker = async (): Promise<void> => {
  try {
    await slackWorker.stop();
  } catch (error) {
    console.error('[SlackWorker] Failed to stop:', error);
  }
};
