import { describe, expect, it, beforeEach } from 'vitest';
import {
  consumeEmbedRateLimit,
  resetEmbedRateLimitBucketsForTests,
} from '@/lib/embed-rate-limit';

describe('consumeEmbedRateLimit', () => {
  beforeEach(() => {
    resetEmbedRateLimitBucketsForTests();
  });

  it('allows requests up to the limit then blocks', () => {
    const req = new Request('https://example.com/api', {
      headers: { 'x-forwarded-for': '203.0.113.50' },
    });
    for (let i = 0; i < 100; i += 1) {
      expect(consumeEmbedRateLimit(req, 'slug-a').blocked).toBe(false);
    }
    const blocked = consumeEmbedRateLimit(req, 'slug-a');
    expect(blocked.blocked).toBe(true);
    if (blocked.blocked) {
      expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    }
  });

  it('tracks keys independently per slug', () => {
    const req = new Request('https://example.com/api', {
      headers: { 'x-forwarded-for': '203.0.113.51' },
    });
    expect(consumeEmbedRateLimit(req, 'slug-b').blocked).toBe(false);
  });
});
