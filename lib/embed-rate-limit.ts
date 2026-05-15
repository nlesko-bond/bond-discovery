const EMBED_RATE_LIMIT_WINDOW_MS = 60_000;
const EMBED_RATE_LIMIT_MAX_REQUESTS = 100;
const EMBED_RATE_LIMIT_BUCKET_MAX = 50000;

interface IEmbedRateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, IEmbedRateBucket>();

function clientKey(request: Request, slug: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const firstForwarded = forwarded?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip');
  const ip = firstForwarded || realIp || 'unknown';
  return `${ip}:${slug}`;
}

export type EmbedRateLimitOutcome =
  | { blocked: true; retryAfterSeconds: number }
  | { blocked: false };

/**
 * Applies a simple per-IP-per-slug rate limit for public embed JSON routes.
 */
export function consumeEmbedRateLimit(
  request: Request,
  slug: string,
): EmbedRateLimitOutcome {
  const now = Date.now();
  const key = clientKey(request, slug);
  let bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + EMBED_RATE_LIMIT_WINDOW_MS };
  }
  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > EMBED_RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.resetAt - now) / 1000),
    );
    return { blocked: true, retryAfterSeconds };
  }

  if (buckets.size > EMBED_RATE_LIMIT_BUCKET_MAX) {
    buckets.clear();
  }

  return { blocked: false };
}

/** Test-only: clears in-memory rate limit state. */
export function resetEmbedRateLimitBucketsForTests(): void {
  buckets.clear();
}
