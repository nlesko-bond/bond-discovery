'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Printer } from 'lucide-react';
import { ConsumerRoster } from '@/components/rosters/ConsumerRoster';
import { UnlockForm } from '@/components/rosters/UnlockForm';
import { getLeagueStandingsUrl } from '@/lib/schedule-standings';
import { flattenTeams, groupPath, totalPlayerCount } from '@/lib/roster-tree';
import type {
  RosterBranding,
  RosterGroupNode,
  RosterPageAccess,
  RosterParticipant,
  RosterSessionRef,
} from '@/types/rosters';

/**
 * The consumer roster page — a rink's game-day program, not a dashboard.
 *
 * League-first information architecture: this surface shows **league** programs
 * only (classes, lessons and drop-ins have no teams; their attendee lists live
 * on the staff surface). Browsing goes league → season → division → team, and
 * when the page has exactly one league the landing step is skipped entirely.
 */

interface Props {
  slug: string;
  name: string;
  branding: RosterBranding;
  pageAccess: RosterPageAccess;
  unlocked: boolean;
  allowPrint: boolean;
}

interface ScopeResponse {
  sessions: RosterSessionRef[];
}

interface GroupsResponse {
  session: RosterSessionRef;
  tree: RosterGroupNode[];
  timezone: string;
  groupCount: number;
}

interface LeagueProgram {
  programId: number;
  programName: string;
  /** Newest first, as the scope API returns them. */
  sessions: RosterSessionRef[];
}

/** Google Fonts family names only — branding is DB-supplied and reaches CSS. */
function safeFont(nameValue: string, fallback: string): string {
  return /^[a-zA-Z0-9 ]{1,60}$/.test(nameValue) ? nameValue : fallback;
}

/** Pick a readable foreground for arbitrary customer hero colours. */
function heroForeground(hex: string): { fg: string; fgMuted: string } {
  const full =
    hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex.slice(0, 7);
  if (!/^#[0-9a-fA-F]{6}$/.test(full)) return { fg: '#ffffff', fgMuted: 'rgba(255,255,255,0.72)' };
  const channels = [1, 3, 5]
    .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.4
    ? { fg: '#141414', fgMuted: 'rgba(20,20,20,0.64)' }
    : { fg: '#ffffff', fgMuted: 'rgba(255,255,255,0.72)' };
}

export function RosterPage(props: Props) {
  const { slug, name, branding, unlocked, allowPrint } = props;

  const fontHeading = safeFont(branding.fontHeading, 'Bebas Neue');
  const fontBody = safeFont(branding.fontBody, 'Open Sans');
  const hero = heroForeground(branding.primaryColor);

  const [isUnlocked, setIsUnlocked] = useState(unlocked);
  const [sessions, setSessions] = useState<RosterSessionRef[] | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [groups, setGroups] = useState<GroupsResponse | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [participants, setParticipants] = useState<RosterParticipant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // URL carries season and team, so every roster is a shareable address.
  const syncUrl = useCallback((nextSession: number | null, nextGroup: number | null) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (nextSession) url.searchParams.set('session', String(nextSession));
    else url.searchParams.delete('session');
    if (nextGroup) url.searchParams.set('group', String(nextGroup));
    else url.searchParams.delete('group');
    window.history.replaceState({}, '', url);
  }, []);

  useEffect(() => {
    if (!isUnlocked) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/rosters/${slug}/scope`);
        if (response.status === 401) {
          if (!cancelled) setIsUnlocked(false);
          return;
        }
        if (!response.ok) throw new Error('scope');
        const data: ScopeResponse = await response.json();
        if (cancelled) return;

        // Leagues only: classes and lessons have no teams, so a roster page
        // has nothing to show a family for them.
        const league = data.sessions.filter((s) => s.programType === 'league');
        setSessions(league);

        const params = new URLSearchParams(window.location.search);
        const fromUrl = Number.parseInt(params.get('session') || '', 10);

        const programIds = new Set(league.map((s) => s.programId));
        const initial = league.some((s) => s.sessionId === fromUrl)
          ? fromUrl
          : programIds.size === 1
            ? league[0]?.sessionId ?? null
            : null; // Several leagues: land on the league picker.
        setSessionId(initial);

        const groupFromUrl = Number.parseInt(params.get('group') || '', 10);
        if (Number.isFinite(groupFromUrl)) setGroupId(groupFromUrl);
      } catch {
        if (!cancelled) setError('Could not load leagues.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, isUnlocked]);

  useEffect(() => {
    if (!sessionId) {
      setGroups(null);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setGroups(null);
      try {
        const response = await fetch(`/api/rosters/${slug}/groups?sessionId=${sessionId}`);
        if (!response.ok) throw new Error('groups');
        const data: GroupsResponse = await response.json();
        if (!cancelled) setGroups(data);
      } catch {
        if (!cancelled) setError('Could not load teams for this season.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, sessionId]);

  useEffect(() => {
    if (!sessionId || !groupId) {
      setParticipants(null);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/rosters/${slug}/participants?sessionId=${sessionId}&groupId=${groupId}`
        );
        if (!response.ok) throw new Error('participants');
        const data = await response.json();
        if (!cancelled) setParticipants(data.participants);
      } catch {
        if (!cancelled) {
          setParticipants(null);
          setError('Could not load this roster.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, sessionId, groupId]);

  /** League programs, each carrying its seasons newest-first. */
  const programs = useMemo<LeagueProgram[]>(() => {
    const byProgram = new Map<number, LeagueProgram>();
    for (const s of sessions ?? []) {
      const entry = byProgram.get(s.programId) ?? {
        programId: s.programId,
        programName: s.programName,
        sessions: [],
      };
      entry.sessions.push(s);
      byProgram.set(s.programId, entry);
    }
    return [...byProgram.values()];
  }, [sessions]);

  const session = useMemo(
    () => sessions?.find((s) => s.sessionId === sessionId) ?? null,
    [sessions, sessionId]
  );
  const program = useMemo(
    () => programs.find((p) => p.sessions.some((s) => s.sessionId === sessionId)) ?? null,
    [programs, sessionId]
  );

  const standingsUrl = getLeagueStandingsUrl(session?.linkSEO);

  /**
   * Bond's tree can hold real divisions AND top-level teams side by side. A
   * top-level team is not a division of one — divisions with teams get
   * banners, loose teams pool into a single grid, and empty divisions are
   * not rendered at all.
   */
  const browse = useMemo(() => {
    if (!groups) return null;
    const divisions = groups.tree
      .filter((root) => !root.isTeam)
      .map((root) => ({ node: root, teams: flattenTeams(root.children) }))
      .filter((d) => d.teams.length > 0);
    const looseTeams = groups.tree.filter((root) => root.isTeam);
    return { divisions, looseTeams, total: divisions.reduce((n, d) => n + d.teams.length, 0) + looseTeams.length };
  }, [groups]);

  const breadcrumb = useMemo(
    () => (groups && groupId ? groupPath(groups.tree, groupId) : []),
    [groups, groupId]
  );
  const currentGroup = breadcrumb[breadcrumb.length - 1] ?? null;

  function selectSession(next: number | null) {
    setSessionId(next);
    setGroupId(null);
    setParticipants(null);
    syncUrl(next, null);
  }

  function selectGroup(next: number | null) {
    // Clear first so the previous team's rows never render under the next
    // team's heading — window.print() would capture that.
    setParticipants(null);
    setGroupId(next);
    syncUrl(sessionId, next);
  }

  const brandCss = `
    @import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontHeading)}:wght@400;600;700&family=${encodeURIComponent(fontBody)}:wght@400;500;600;700&display=swap');

    [data-roster-page] {
      --rp-primary: ${branding.primaryColor};
      --rp-accent: ${branding.accentColor};
      --rp-bg: ${branding.bgColor};
      --rp-hero-fg: ${hero.fg};
      --rp-hero-fg-muted: ${hero.fgMuted};
      --rp-ink: #16181d;
      --rp-ink-soft: #5c616b;
      --rp-line: #e5e2dc;
      font-family: '${fontBody}', system-ui, sans-serif;
      background-color: var(--rp-bg);
      color: var(--rp-ink);
      -webkit-font-smoothing: antialiased;
    }
    [data-roster-page] .rp-display {
      font-family: '${fontHeading}', '${fontBody}', sans-serif;
      letter-spacing: 0.015em;
      line-height: 0.95;
    }

    /* Hero */
    [data-roster-page] .rp-hero {
      background-color: var(--rp-primary);
      color: var(--rp-hero-fg);
      position: relative;
      overflow: hidden;
    }
    [data-roster-page] .rp-hero::after {
      content: '';
      position: absolute;
      inset: auto 0 0 0;
      height: 4px;
      background: var(--rp-accent);
    }
    [data-roster-page] .rp-eyebrow {
      color: var(--rp-accent);
      font-weight: 700;
      font-size: 0.7rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
    }

    /* Season switcher (in content, scoped to one league) */
    [data-roster-page] .rp-season-select {
      border: 1px solid var(--rp-line);
      background: #fff;
      border-radius: 10px;
      padding: 0.45rem 2rem 0.45rem 0.7rem;
      font-size: 0.85rem;
      color: var(--rp-ink);
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='3'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.6rem center;
    }

    /* Division banner */
    [data-roster-page] .rp-division {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
    }
    [data-roster-page] .rp-division h2,
    [data-roster-page] .rp-league-heading {
      font-size: clamp(1.6rem, 3.5vw, 2.2rem);
      text-transform: uppercase;
    }
    [data-roster-page] .rp-division-rule {
      width: 2.75rem;
      height: 4px;
      background: var(--rp-accent);
      margin: 0.4rem 0 1rem;
    }

    /* Cards (leagues and teams share the anatomy) */
    [data-roster-page] .rp-card {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.9rem;
      width: 100%;
      text-align: left;
      background: #fff;
      border: 1px solid var(--rp-line);
      border-radius: 14px;
      padding: 1rem 1.1rem 1rem 1.35rem;
      overflow: hidden;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    [data-roster-page] .rp-card::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 5px;
      background: var(--rp-accent);
      transition: width 0.15s ease;
    }
    [data-roster-page] .rp-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 24px -12px rgba(22, 24, 29, 0.25);
    }
    [data-roster-page] .rp-card:hover::before {
      width: 8px;
    }
    [data-roster-page] .rp-card:focus-visible {
      outline: 2px solid var(--rp-accent);
      outline-offset: 2px;
    }
    [data-roster-page] .rp-monogram {
      font-family: '${fontHeading}', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.9rem;
      height: 2.9rem;
      border-radius: 10px;
      flex-shrink: 0;
      font-size: 1.15rem;
      color: var(--rp-accent);
      background: color-mix(in srgb, var(--rp-accent) 12%, #fff);
    }
    [data-roster-page] .rp-card img.rp-team-logo {
      width: 2.9rem;
      height: 2.9rem;
      border-radius: 10px;
      object-fit: cover;
      flex-shrink: 0;
    }

    /* Lineup */
    [data-roster-page] .rp-lineup {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    [data-roster-page] .rp-lineup-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.7rem 0.25rem;
      border-bottom: 1px solid var(--rp-line);
    }
    [data-roster-page] .rp-lineup-row:last-child {
      border-bottom: none;
    }
    [data-roster-page] .rp-jersey {
      font-family: '${fontHeading}', sans-serif;
      font-size: 1.7rem;
      line-height: 1;
      color: var(--rp-accent);
      width: 3.2rem;
      text-align: right;
      flex-shrink: 0;
      font-variant-numeric: tabular-nums;
    }
    [data-roster-page] .rp-player {
      display: block;
      font-weight: 600;
      font-size: 1rem;
      color: var(--rp-ink);
    }
    [data-roster-page] .rp-position {
      display: block;
      font-size: 0.78rem;
      color: var(--rp-ink-soft);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 0.1rem;
    }
    [data-roster-page] .rp-captain {
      font-family: '${fontHeading}', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.7rem;
      height: 1.7rem;
      border-radius: 50%;
      background: var(--rp-accent);
      color: #fff;
      font-size: 0.95rem;
      flex-shrink: 0;
    }
    [data-roster-page] .rp-invited {
      font-size: 0.72rem;
      color: var(--rp-ink-soft);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      flex-shrink: 0;
    }
    [data-roster-page] .rp-headshot {
      width: 2.4rem;
      height: 2.4rem;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }
    [data-roster-page] .rp-headshot--empty {
      background: color-mix(in srgb, var(--rp-accent) 10%, #fff);
    }

    /* Team sheet */
    [data-roster-page] .rp-sheet {
      background: #fff;
      border: 1px solid var(--rp-line);
      border-radius: 18px;
      padding: 1.75rem;
    }
    [data-roster-page] .rp-team-name {
      font-size: clamp(2.2rem, 6vw, 3.4rem);
      text-transform: uppercase;
      color: var(--rp-ink);
    }

    [data-roster-page] .rp-enter {
      animation: rp-fade-up 0.4s ease-out both;
    }
    @keyframes rp-fade-up {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      [data-roster-page] .rp-enter { animation: none; }
      [data-roster-page] .rp-card,
      [data-roster-page] .rp-card::before { transition: none; }
    }
  `;

  if (!isUnlocked) {
    return (
      <div data-roster-page className="min-h-screen">
        <style dangerouslySetInnerHTML={{ __html: brandCss }} />
        <UnlockForm
          slug={slug}
          scope="viewer"
          title={branding.heroTitle || name}
          description="This page is password protected."
          onUnlocked={() => setIsUnlocked(true)}
        />
      </div>
    );
  }

  return (
    <div data-roster-page className="roster-print-root min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: brandCss }} />

      {/* Hero: identity only. Navigation happens in the content. */}
      <header className="rp-hero roster-no-print">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-5 pb-7 pt-9 sm:px-6">
          {branding.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="" className="h-14 w-auto shrink-0" />
          )}
          <div className="min-w-0">
            <p className="rp-eyebrow">Rosters</p>
            <h1 className="rp-display mt-1 text-5xl sm:text-6xl" style={{ color: 'var(--rp-hero-fg)' }}>
              {branding.heroTitle || name}
            </h1>
            {branding.heroSubtitle && (
              <p className="mt-2 max-w-xl text-sm" style={{ color: 'var(--rp-hero-fg-muted)' }}>
                {branding.heroSubtitle}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-9 sm:px-6">
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading && !sessions && <p className="text-sm" style={{ color: 'var(--rp-ink-soft)' }}>Loading…</p>}

        {sessions?.length === 0 && (
          <EmptyState
            title="No league seasons available yet"
            body="This page shows team rosters for published league seasons. When a league season is published, its divisions and teams appear here."
          />
        )}

        {/* League picker — only when the page hosts more than one league. */}
        {sessions && !sessionId && programs.length > 0 && (
          <section className="rp-enter">
            <div className="rp-division">
              <h2 className="rp-display rp-league-heading">Leagues</h2>
            </div>
            <div className="rp-division-rule" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {programs.map((p) => (
                <button
                  key={p.programId}
                  type="button"
                  onClick={() => selectSession(p.sessions[0]?.sessionId ?? null)}
                  className="rp-card"
                >
                  <span className="rp-monogram" aria-hidden="true">
                    {p.programName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="notranslate block truncate text-[15px] font-semibold">
                      {p.programName}
                    </span>
                    <span className="mt-0.5 block truncate text-xs" style={{ color: 'var(--rp-ink-soft)' }}>
                      {p.sessions[0]?.sessionName}
                      {p.sessions.length > 1 ? ` · ${p.sessions.length} seasons` : ''}
                    </span>
                  </span>
                  <ChevronRight size={16} aria-hidden style={{ color: 'var(--rp-ink-soft)' }} />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* League header: name, season switcher, standings. */}
        {session && program && !currentGroup && (
          <section className="rp-enter">
            <div className="roster-no-print mb-1 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                {programs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => selectSession(null)}
                    className="mb-2 inline-flex items-center gap-1 text-sm font-medium hover:underline"
                    style={{ color: 'var(--rp-ink-soft)' }}
                  >
                    <ChevronLeft size={16} aria-hidden />
                    All leagues
                  </button>
                )}
                <h2 className="rp-display rp-league-heading notranslate">{program.programName}</h2>
              </div>

              <div className="flex items-center gap-3">
                {program.sessions.length > 1 ? (
                  <>
                    <label htmlFor="rp-season" className="sr-only">
                      Season
                    </label>
                    <select
                      id="rp-season"
                      className="rp-season-select"
                      value={sessionId ?? ''}
                      onChange={(e) => selectSession(Number(e.target.value))}
                    >
                      {program.sessions.map((s) => (
                        <option key={s.sessionId} value={s.sessionId}>
                          {s.sessionName}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <span className="text-sm" style={{ color: 'var(--rp-ink-soft)' }}>
                    {session.sessionName}
                  </span>
                )}

                {standingsUrl && (
                  <a
                    href={standingsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
                    style={{ color: 'var(--rp-accent)' }}
                  >
                    Standings
                    <ExternalLink size={13} aria-hidden />
                  </a>
                )}
              </div>
            </div>
            <div className="rp-division-rule" />

            {loading && !browse && (
              <p className="text-sm" style={{ color: 'var(--rp-ink-soft)' }}>Loading teams…</p>
            )}

            {browse && browse.total === 0 && (
              <EmptyState
                title="No teams in this season yet"
                body="Teams appear here once they are created and published for this season."
              />
            )}

            {browse && browse.total > 0 && (
              <div className="space-y-10">
                {browse.divisions.map((division) => (
                  <div key={division.node.id}>
                    <div className="rp-division">
                      <h2 className="rp-display notranslate">{division.node.name}</h2>
                      <span
                        className="text-xs font-semibold uppercase tracking-widest"
                        style={{ color: 'var(--rp-ink-soft)' }}
                      >
                        {division.teams.length} team{division.teams.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="rp-division-rule" />
                    <TeamGrid teams={division.teams} onSelect={selectGroup} />
                  </div>
                ))}

                {browse.looseTeams.length > 0 && (
                  <div>
                    {browse.divisions.length > 0 && (
                      <>
                        <div className="rp-division">
                          <h2 className="rp-display">Teams</h2>
                          <span
                            className="text-xs font-semibold uppercase tracking-widest"
                            style={{ color: 'var(--rp-ink-soft)' }}
                          >
                            {browse.looseTeams.length} team
                            {browse.looseTeams.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="rp-division-rule" />
                      </>
                    )}
                    <TeamGrid teams={browse.looseTeams} onSelect={selectGroup} />
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Team sheet */}
        {groups && currentGroup && (
          <section className="rp-enter">
            <div className="roster-no-print mb-5 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => selectGroup(null)}
                className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                style={{ color: 'var(--rp-ink-soft)' }}
              >
                <ChevronLeft size={16} aria-hidden />
                {program?.programName ?? 'All teams'}
              </button>

              {allowPrint && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Printer size={14} aria-hidden />
                  Print roster
                </button>
              )}
            </div>

            <div className="rp-sheet">
              <p className="rp-eyebrow">
                {breadcrumb.slice(0, -1).map((n) => n.name).join(' · ') || program?.programName}
              </p>
              <h2 className="rp-display rp-team-name notranslate mt-1">{currentGroup.name}</h2>
              <p className="roster-print-meta mt-2 text-sm" style={{ color: 'var(--rp-ink-soft)' }}>
                {session?.programName} · {session?.sessionName}
              </p>
              <div className="rp-division-rule" />

              {participants ? (
                <ConsumerRoster participants={participants} />
              ) : (
                <p className="text-sm" style={{ color: 'var(--rp-ink-soft)' }}>
                  Loading roster…
                </p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function TeamGrid({
  teams,
  onSelect,
}: {
  teams: RosterGroupNode[];
  onSelect: (id: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map((team) => {
        const players = totalPlayerCount(team);
        return (
          <button key={team.id} type="button" onClick={() => onSelect(team.id)} className="rp-card">
            {team.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={team.logoUrl} alt="" className="rp-team-logo" />
            ) : (
              <span className="rp-monogram" aria-hidden="true">
                {team.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="min-w-0">
              <span className="notranslate block truncate text-[15px] font-semibold">
                {team.name}
              </span>
              {/* A pre-season team with nobody on it yet gets no count at all —
                  "0 players" reads as broken rather than early. */}
              {players > 0 && (
                <span className="mt-0.5 block text-xs" style={{ color: 'var(--rp-ink-soft)' }}>
                  {players} player{players === 1 ? '' : 's'}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Empty states keep explaining what the page is for. */
function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center">
      <h2 className="text-base font-medium text-gray-900">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">{body}</p>
    </div>
  );
}
