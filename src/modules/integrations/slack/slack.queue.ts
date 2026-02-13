import Bull from 'bull';
import { createBullQueue, isRedisConfigured } from '../../../config/redis.config';
import { SlackMessagePayload } from './slack.service';

export interface SlackMessageJob {
  tenantId: string;
  payload: SlackMessagePayload;
  eventType: string;
  eventId?: string;
  retryCount?: number;
}

export interface SlackJobResult {
  success: boolean;
  ts?: string;
  channel?: string;
  error?: string;
}

let slackMessageQueue: Bull.Queue<SlackMessageJob> | null = null;

export const getSlackMessageQueue = (): Bull.Queue<SlackMessageJob> | null => {
  if (!isRedisConfigured()) {
    console.warn('[SlackQueue] Redis not configured, queue unavailable');
    return null;
  }

  if (!slackMessageQueue) {
    slackMessageQueue = createBullQueue<SlackMessageJob>('slack-messages');

    slackMessageQueue.on('error', (error) => {
      console.error('[SlackQueue] Queue error:', error);
    });

    slackMessageQueue.on('failed', (job, error) => {
      console.error(`[SlackQueue] Job ${job.id} failed:`, error.message);
    });

    slackMessageQueue.on('completed', (job, result) => {
      console.log(`[SlackQueue] Job ${job.id} completed:`, result?.success ? 'success' : 'failed');
    });
  }

  return slackMessageQueue;
};

export const addSlackMessageJob = async (
  job: SlackMessageJob,
  options?: Bull.JobOptions
): Promise<Bull.Job<SlackMessageJob> | null> => {
  const queue = getSlackMessageQueue();

  if (!queue) {
    console.warn('[SlackQueue] Cannot add job, queue not available');
    return null;
  }

  const defaultOptions: Bull.JobOptions = {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  };

  return queue.add(job, { ...defaultOptions, ...options });
};

export const closeSlackQueue = async (): Promise<void> => {
  if (slackMessageQueue) {
    await slackMessageQueue.close();
    slackMessageQueue = null;
  }
};

export const getQueueStats = async (): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
} | null> => {
  const queue = getSlackMessageQueue();

  if (!queue) {
    return null;
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
};
