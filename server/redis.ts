// Redis connections. BullMQ gets connection options (it manages its own sockets); pub/sub and
// small counters share one client per process.

import { Redis } from 'ioredis';
import { env } from './env';

const g = globalThis as unknown as { __tresorRedis?: Redis };

export function redisOptions() {
  const u = new URL(env().REDIS_URL);
  return { host: u.hostname, port: Number(u.port || 6379), password: u.password || undefined, db: Number(u.pathname.slice(1) || 0), maxRetriesPerRequest: null as null };
}

export function redis(): Redis {
  if (!g.__tresorRedis) g.__tresorRedis = new Redis({ ...redisOptions(), lazyConnect: false });
  return g.__tresorRedis;
}

/** A dedicated connection for SUBSCRIBE (a subscribed client can't run other commands). */
export const subscriber = () => new Redis(redisOptions());

export const LIVE_CHANNEL = 'tresor:live';
