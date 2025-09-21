import { createClient, RedisClientType } from 'redis';
import { config } from '../config/environment';
import { logger } from './logger';
import { CacheEntry } from '../types';

class CacheManager {
  private client: RedisClientType;
  private memoryCache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly MEMORY_CACHE_SIZE = 1000;
  private readonly MEMORY_CACHE_TTL = 5 * 60 * 1000;

  constructor() {
    this.client = createClient({
      url: config.redis.url,
      password: config.redis.password,
    });

    this.client.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    this.client.on('connect', () => {
      logger.info('Connected to Redis');
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  async get<T>(key: string): Promise<T | null> {
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && Date.now() - memoryEntry.timestamp < memoryEntry.ttl) {
      logger.debug(`Cache hit (L1): ${key}`);
      return memoryEntry.data as T;
    }

    try {
      const redisValue = await this.client.get(key);
      if (redisValue) {
        const data = JSON.parse(redisValue);
        this.setMemoryCache(key, data, this.MEMORY_CACHE_TTL);
        logger.debug(`Cache hit (L2): ${key}`);
        return data;
      }
    } catch (error) {
      logger.error(`Redis get error for key ${key}:`, error);
    }

    logger.debug(`Cache miss: ${key}`);
    return null;
  }

  async set<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
      this.setMemoryCache(key, value, Math.min(ttlSeconds * 1000, this.MEMORY_CACHE_TTL));
      logger.debug(`Cache set: ${key} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      logger.error(`Redis set error for key ${key}:`, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
      this.memoryCache.delete(key);
      logger.debug(`Cache delete: ${key}`);
    } catch (error) {
      logger.error(`Redis delete error for key ${key}:`, error);
    }
  }

  private setMemoryCache<T>(key: string, value: T, ttl: number): void {
    if (this.memoryCache.size >= this.MEMORY_CACHE_SIZE) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }

    this.memoryCache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl,
    });
  }
}

export const cacheManager = new CacheManager();
