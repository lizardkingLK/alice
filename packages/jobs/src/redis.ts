import IORedis from 'ioredis';

export type RedisConnectionRole = 'producer' | 'worker';

/**
 * Shared ioredis factory for BullMQ.
 * Workers require `maxRetriesPerRequest: null`; producers keep a finite value
 * (safer on short-lived Vercel invocations).
 */
export function createRedisConnection(
  redisUrl: string,
  role: RedisConnectionRole = 'producer'
): IORedis {
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: role === 'worker' ? null : 20,
    enableReadyCheck: false,
  });
}
