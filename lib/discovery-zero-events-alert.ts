import { cacheGet, cacheSet } from '@/lib/cache';
import { DEFAULT_BOND_ENV, type BondEnv } from '@/lib/bond-env';

const ZERO_EVENTS_ALERT_COOLDOWN_SECONDS = 30 * 60;
const ZERO_EVENTS_ALERT_CACHE_TTL_SECONDS = ZERO_EVENTS_ALERT_COOLDOWN_SECONDS;

interface IZeroEventsAlertParams {
  slug: string;
  bondEnv?: BondEnv;
  mode: string;
  cacheStatus: string;
  cacheKey: string;
  organizations: number;
  serverErrors: number;
}

function zeroEventsAlertCacheKey(slug: string, bondEnv: BondEnv): string {
  return `discovery:zero-events-alert:${bondEnv}:${slug}`;
}

function getSlackWebhookUrl(): string | undefined {
  return process.env.DISCOVERY_ZERO_EVENTS_SLACK_WEBHOOK_URL || undefined;
}

export async function maybeAlertZeroDiscoveryEvents(params: IZeroEventsAlertParams): Promise<void> {
  const webhookUrl = getSlackWebhookUrl();
  if (!webhookUrl) return;

  const bondEnv = params.bondEnv || DEFAULT_BOND_ENV;
  const cacheKey = zeroEventsAlertCacheKey(params.slug, bondEnv);
  const recentlySent = await cacheGet<boolean>(cacheKey);
  if (recentlySent) return;

  await cacheSet(cacheKey, true, { ttl: ZERO_EVENTS_ALERT_CACHE_TTL_SECONDS });

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Discovery returned 0 events for ${params.slug}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: 'Discovery returned 0 events',
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Slug*\n${params.slug}` },
              { type: 'mrkdwn', text: `*Bond Env*\n${bondEnv}` },
              { type: 'mrkdwn', text: `*Mode*\n${params.mode}` },
              { type: 'mrkdwn', text: `*Cache*\n${params.cacheStatus}` },
              { type: 'mrkdwn', text: `*Bond 5xxs*\n${params.serverErrors}` },
              { type: 'mrkdwn', text: `*Organizations*\n${params.organizations}` },
              { type: 'mrkdwn', text: `*Cache Key*\n${params.cacheKey}` },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `https://discovery.bondsports.co/${params.slug}?scheduleView=table`,
            },
          },
        ],
      }),
    });
  } catch (error) {
    console.error('[zero-events-alert] failed to send Slack alert', { slug: params.slug, error });
  }
}
