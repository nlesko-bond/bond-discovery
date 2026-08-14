/**
 * Rate limits for the roster surface.
 *
 * Two distinct budgets, because the two risks are different:
 *
 * - **Unlock** gates participant PII behind a password, and `verifyViewerPassword`
 *   runs a synchronous scrypt. Unlimited attempts are both a guessing oracle and
 *   a cheap way to peg the function's event loop. A handful of tries per minute
 *   is far more than a human needs.
 * - **Bulk reads** fan out one Bond request per team or event, up to the caps in
 *   lib/roster-data.ts. Bond meters per organization, so an unauthenticated
 *   visitor walking ids could burn the customer's own quota.
 *
 * Per-instance and in-memory, matching lib/embed-rate-limit.ts. That is a floor
 * rather than a guarantee across serverless instances, but it removes the cheap
 * single-origin version of both attacks.
 */

const WINDOW_MS = 60_000;
const BUCKET_MAX = 50_000;

const UNLOCK_MAX_PER_WINDOW = 10;
const BULK_MAX_PER_WINDOW = 30;

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

export type RosterRateLimitKind = 'unlock' | 'bulk';

export type RosterRateLimitOutcome =
  | { blocked: true; retryAfterSeconds: number }
  | { blocked: false };

function clientKey(request: Request, slug: string, kind: RosterRateLimitKind): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const firstForwarded = forwarded?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip');
  const ip = firstForwarded || realIp || 'unknown';
  return `${kind}:${ip}:${slug}`;
}

export function consumeRosterRateLimit(
  request: Request,
  slug: string,
  kind: RosterRateLimitKind
): RosterRateLimitOutcome {
  const now = Date.now();
  const key = clientKey(request, slug, kind);
  const max = kind === 'unlock' ? UNLOCK_MAX_PER_WINDOW : BULK_MAX_PER_WINDOW;

  let bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
  }
  bucket.count += 1;

  // Bound the map so a spray of distinct IPs cannot grow it without limit.
  if (buckets.size > BUCKET_MAX) {
    for (const [existingKey, existing] of buckets) {
      if (now > existing.resetAt) buckets.delete(existingKey);
    }
    if (buckets.size > BUCKET_MAX) buckets.clear();
  }
  buckets.set(key, bucket);

  if (bucket.count > max) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { blocked: false };
}

/** Test seam — resets the in-process buckets. */
export function resetRosterRateLimits(): void {
  buckets.clear();
}
