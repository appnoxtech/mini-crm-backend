import Bull from 'bull';

export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
};

export const getRedisUrl = (): string => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  
  const auth = redisConfig.password ? `:${redisConfig.password}@` : '';
  return `redis://${auth}${redisConfig.host}:${redisConfig.port}/${redisConfig.db}`;
};

export const createBullQueue = <T>(queueName: string): Bull.Queue<T> => {
  return new Bull<T>(queueName, getRedisUrl(), {
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  });
};

export const isRedisConfigured = (): boolean => {
  return !!(process.env.REDIS_URL || process.env.REDIS_HOST);
};
