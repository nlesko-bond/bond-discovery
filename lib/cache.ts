/**
 * Caching layer for Bond API responses
 * Uses Vercel KV in production, in-memory fallback for development
 */

// In-memory cache for development
const memoryCache = new Map<string, { data: any; expires: number }>();

const DEFAULT_TTL = 300; // 5 minutes

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
}

/**
 * Get a value from cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  // Try Vercel KV first
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = await import('@vercel/kv');
      return await kv.get<T>(key);
    } catch (error) {
      console.error('KV get error:', error);
    }
  }

  // Fallback to memory cache
  const entry = memoryCache.get(key);
  if (entry && entry.expires > Date.now()) {
    return entry.data as T;
  }
  
  if (entry) {
    memoryCache.delete(key);
  }
  
  return null;
}

/**
 * Set a value in cache
 */
export async function cacheSet<T>(
  key: string, 
  value: T, 
  options: CacheOptions = {}
): Promise<void> {
  const ttl = options.ttl || DEFAULT_TTL;

  // Try Vercel KV first
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = await import('@vercel/kv');
      await kv.set(key, value, { ex: ttl });
      return;
    } catch (error) {
      console.error('KV set error:', error);
    }
  }

  // Fallback to memory cache
  memoryCache.set(key, {
    data: value,
    expires: Date.now() + (ttl * 1000),
  });
}

/**
 * Delete a value from cache
 */
export async function cacheDelete(key: string): Promise<void> {
  // Try Vercel KV first
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = await import('@vercel/kv');
      await kv.del(key);
      return;
    } catch (error) {
      console.error('KV delete error:', error);
    }
  }

  // Fallback to memory cache
  memoryCache.delete(key);
}

/**
 * Delete all cache entries matching a pattern
 */
export async function cacheDeletePattern(pattern: string): Promise<void> {
  // Try Vercel KV first
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = await import('@vercel/kv');
      const keys = await kv.keys(pattern);
      if (keys.length > 0) {
        await kv.del(...keys);
      }
      return;
    } catch (error) {
      console.error('KV delete pattern error:', error);
    }
  }

  // Fallback to memory cache - delete matching keys
  const regex = new RegExp(pattern.replace('*', '.*'));
  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Clear all cache
 */
export async function cacheClear(): Promise<void> {
  // Try Vercel KV first
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = await import('@vercel/kv');
      await kv.flushall();
      return;
    } catch (error) {
      console.error('KV clear error:', error);
    }
  }

  // Fallback to memory cache
  memoryCache.clear();
}

/**
 * Generate a cache key for programs
 */
export function programsCacheKey(orgId: string, facilityId?: string): string {
  return facilityId 
    ? `programs:${orgId}:${facilityId}` 
    : `programs:${orgId}`;
}

/**
 * Generate a cache key for schedule
 */
export function scheduleCacheKey(orgId: string, startDate: string, endDate: string): string {
  return `schedule:${orgId}:${startDate}:${endDate}`;
}

/**
 * Generate a cache key for config
 */
export function configCacheKey(configId: string): string {
  return `config:${configId}`;
}

/**
 * Wrapper function to get or set cache
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try to get from cache
  const cachedValue = await cacheGet<T>(key);
  if (cachedValue !== null) {
    return cachedValue;
  }

  // Fetch fresh data
  const freshValue = await fetcher();

  // Cache the result
  await cacheSet(key, freshValue, options);

  return freshValue;
}
