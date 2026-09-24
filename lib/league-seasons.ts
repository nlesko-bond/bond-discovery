import { parseHomeAwayFromEventTitle } from '@/lib/parse-league-event-title';
import type { DiscoveryConfig, Program, Session } from '@/types';

/**
 * Season-level helpers for the league card layout (`programCardLayout: 'league'`).
 * Everything here works on calendar days (YYYY-MM-DD) so a season's phase
 * never flips mid-day because of a UTC offset.
 */

export type LeagueSeasonPhase = 'in_season' | 'registering' | 'upcoming' | 'completed';

const PHASE_ORDER: Record<LeagueSeasonPhase, number> = {
  in_season: 0,
  registering: 1,
  upcoming: 2,
  completed: 3,
};

export const MAX_COMPLETED_SEASON_DAYS = 60;

function ymd(date: string | undefined): string | undefined {
  return date ? date.slice(0, 10) : undefined;
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const from = Date.UTC(+fromYmd.slice(0, 4), +fromYmd.slice(5, 7) - 1, +fromYmd.slice(8, 10));
  const to = Date.UTC(+toYmd.slice(0, 4), +toYmd.slice(5, 7) - 1, +toYmd.slice(8, 10));
  return Math.round((to - from) / 86_400_000);
}

export function addDaysYmd(dateYmd: string, days: number): string {
  const d = new Date(`${dateYmd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today as YYYY-MM-DD in the given timezone (defaults to the runtime's). */
export function todayYmd(timeZone?: string): string {
  try {
    return new Date().toLocaleDateString('en-CA', timeZone ? { timeZone } : undefined);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function isSeasonRegistrationOpen(session: Session): boolean {
  return session.registrationWindowStatus === 'open';
}

/**
 * completed: ended before today. in_season: started, not ended.
 * registering: not started, registration open. upcoming: everything else
 * (registration not open yet, or closed before the start date).
 */
export function getSeasonPhase(session: Session, today: string): LeagueSeasonPhase {
  const start = ymd(session.startDate);
  const end = ymd(session.endDate);
  if (end && end < today) return 'completed';
  if (start && start <= today) return 'in_season';
  return isSeasonRegistrationOpen(session) ? 'registering' : 'upcoming';
}

/** "Week 3 of 8" numbers for an in-season session with both dates. */
export function getSeasonWeek(
  session: Session,
  today: string,
): { current: number; total: number } | undefined {
  const start = ymd(session.startDate);
  const end = ymd(session.endDate);
  if (!start || !end || start > today || end < today) return undefined;
  const total = Math.max(1, Math.ceil((daysBetween(start, end) + 1) / 7));
  const current = Math.min(total, Math.floor(daysBetween(start, today) / 7) + 1);
  return { current, total };
}

/** In season first, then registering, upcoming, completed (most recent first). */
export function sortSeasonsForLeagueCard(sessions: Session[], today: string): Session[] {
  return [...sessions].sort((a, b) => {
    const pa = getSeasonPhase(a, today);
    const pb = getSeasonPhase(b, today);
    if (pa !== pb) return PHASE_ORDER[pa] - PHASE_ORDER[pb];
    const sa = ymd(a.startDate) || '';
    const sb = ymd(b.startDate) || '';
    return pa === 'completed' ? sb.localeCompare(sa) : sa.localeCompare(sb);
  });
}

/**
 * Session IDs whose schedule already has "Team A vs Team B" games — the
 * signal that the Bond competition schedule is published, so the
 * Standings / Schedule & Scores link-outs lead somewhere useful.
 */
export function getSessionIdsWithMatchups(
  events: Array<{ sessionId?: string | number; title?: string }> | undefined,
): Set<string> {
  const ids = new Set<string>();
  for (const event of events || []) {
    if (event.sessionId === undefined || event.sessionId === null) continue;
    const { home, away } = parseHomeAwayFromEventTitle(event.title || '');
    if (home && away) ids.add(String(event.sessionId));
  }
  return ids;
}

export function shouldShowLeagueLinks(
  phase: LeagueSeasonPhase,
  hasPublishedMatchups: boolean,
  mode: DiscoveryConfig['features']['leagueLinksMode'],
): boolean {
  if (mode === 'never') return false;
  if (mode === 'always') return true;
  return phase === 'in_season' || phase === 'completed' || hasPublishedMatchups;
}

export function resolveCompletedSeasonDays(config: DiscoveryConfig): number {
  if (config.features.programCardLayout !== 'league') return 0;
  const days = Math.floor(Number(config.features.completedSeasonDays) || 0);
  return Math.min(MAX_COMPLETED_SEASON_DAYS, Math.max(0, days));
}

/**
 * Folds recently completed seasons (ended within `days` before `today`) from
 * an includePast fetch into the regular programs list. Sessions already
 * present are left alone; programs whose seasons have all ended are appended.
 */
export function mergeCompletedSeasons(
  programs: Program[],
  pastPrograms: Program[],
  today: string,
  days: number,
): Program[] {
  if (days <= 0 || pastPrograms.length === 0) return programs;
  const cutoff = addDaysYmd(today, -days);
  const isRecentlyCompleted = (session: Session) => {
    const end = ymd(session.endDate);
    return Boolean(end && end < today && end >= cutoff);
  };

  const byId = new Map(programs.map((program) => [String(program.id), program]));
  const merged = [...programs];
  const indexById = new Map(merged.map((program, index) => [String(program.id), index]));

  for (const past of pastPrograms) {
    const completed = (past.sessions || []).filter(isRecentlyCompleted);
    if (completed.length === 0) continue;

    const existing = byId.get(String(past.id));
    if (!existing) {
      merged.push({ ...past, sessions: completed });
      continue;
    }
    const known = new Set((existing.sessions || []).map((session) => String(session.id)));
    const additions = completed.filter((session) => !known.has(String(session.id)));
    if (additions.length === 0) continue;
    merged[indexById.get(String(past.id))!] = {
      ...existing,
      sessions: [...(existing.sessions || []), ...additions],
    };
  }
  return merged;
}
