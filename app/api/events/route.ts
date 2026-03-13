export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * GET /api/events
 *
 * Reads the pre-computed response from Upstash that the cron job writes
 * every ~15 minutes at key `discovery:response:<slug>`.
 *
 * This route uses Edge Runtime (~50ms cold start) and makes a single
 * HTTP call to Upstash — no Supabase, no React, no heavy imports.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return new Response(
      JSON.stringify({ error: 'Missing slug parameter' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    return new Response(
      JSON.stringify({ error: 'Cache not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const upstashRes = await fetch(
      `${kvUrl}/get/discovery:response:${encodeURIComponent(slug)}`,
      { headers: { Authorization: `Bearer ${kvToken}` } },
    );

    if (!upstashRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Cache read failed', status: upstashRes.status }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { result } = await upstashRes.json();

    if (result === null || result === undefined) {
      return new Response(
        JSON.stringify({ error: 'No cached data for this slug. The cron job may not have run yet.', slug }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Upstash stores objects as JSON strings via @vercel/kv; return as-is
    const body = typeof result === 'string' ? result : JSON.stringify(result);

    return new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=900, stale-while-revalidate=7200',
        'X-Bond-Events-Cache': 'PRECOMPUTED',
        'X-Bond-Events-Mode': 'full',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Unexpected error reading cache' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
