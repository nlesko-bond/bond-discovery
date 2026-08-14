import type { CalendarEvent, DiscoveryConfig } from '@/types';

const BOND_CONSUMER_ORIGIN = 'https://bondsports.co';

/**
 * League standings live on the Bond consumer season page's competition tab.
 * `linkSEO` already points at the season page
 * (`/activity/programs/{program}/{programId}/season/{session}/{sessionId}`),
 * so the standings URL is derived from it rather than assembled from IDs.
 * Returns undefined when linkSEO is missing or is not a season-level link.
 */
export function getLeagueStandingsUrl(linkSEO: string | undefined): string | undefined {
  if (!linkSEO) return undefined;
  const absolute = linkSEO.startsWith('http') ? linkSEO : `${BOND_CONSUMER_ORIGIN}${linkSEO}`;
  try {
    const url = new URL(absolute);
    const path = url.pathname.replace(/\/+$/, '');
    if (!/\/season\/[^/]+\/[^/]+$/.test(path)) {
      return undefined;
    }
    return `${url.origin}${path}/competition?tab=standings`;
  } catch {
    return undefined;
  }
}

export function eventShowsStandingsLink(event: CalendarEvent, config: DiscoveryConfig): boolean {
  if (config.features.showLeagueStandingsLink !== true) {
    return false;
  }
  const programType = event.programType || event.type;
  return programType === 'league' && Boolean(getLeagueStandingsUrl(event.linkSEO));
}

/**
 * Deep link from a league event to its roster page — the mirror of the
 * standings link. Returns undefined unless the page opts in and names a roster
 * page, so nothing appears by accident.
 *
 * Only ever a URL: roster data stays out of the discovery payload entirely.
 */
export function getRostersUrlForEvent(
  event: CalendarEvent,
  config: DiscoveryConfig
): string | undefined {
  if (config.features.showRostersLink !== true) return undefined;

  const slug = config.features.rostersPageSlug?.trim();
  if (!slug) return undefined;

  const programType = event.programType || event.type;
  if (programType !== 'league') return undefined;

  const sessionId = event.sessionId;
  return sessionId ? `/rosters/${slug}?session=${sessionId}` : `/rosters/${slug}`;
}
