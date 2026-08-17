'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ExternalLink, Printer } from 'lucide-react';
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
 * Design system, in brief: the customer's display face does the talking
 * (division banners, team names, jersey numerals), the accent colour is spent
 * on exactly three things (numerals, the captain patch, division rules), and
 * everything operational lives on /rosters/{slug}/staff instead of here.
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

        setSessions(data.sessions);

        const params = new URLSearchParams(window.location.search);
        const fromUrl = Number.parseInt(params.get('session') || '', 10);
        const initial = data.sessions.some((s) => s.sessionId === fromUrl)
          ? fromUrl
          : data.sessions[0]?.sessionId ?? null;
        setSessionId(initial);

        const groupFromUrl = Number.parseInt(params.get('group') || '', 10);
        if (Number.isFinite(groupFromUrl)) setGroupId(groupFromUrl);
      } catch {
        if (!cancelled) setError('Could not load seasons.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, isUnlocked]);

  useEffect(() => {
    if (!sessionId) return;
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

  const session = useMemo(
    () => sessions?.find((s) => s.sessionId === sessionId) ?? null,
    [sessions, sessionId]
  );

  const standingsUrl = getLeagueStandingsUrl(session?.linkSEO);
  const teams = useMemo(() => (groups ? flattenTeams(groups.tree) : []), [groups]);
  const breadcrumb = useMemo(
    () => (groups && groupId ? groupPath(groups.tree, groupId) : []),
    [groups, groupId]
  );
  const currentGroup = breadcrumb[breadcrumb.length - 1] ?? null;

  function selectSession(next: number) {
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
      /* One quiet nod to the rink: a centre-ice line under the header block. */
      content: '';
      position: absolute;
      inset: auto 0 0 0;
      height: 4px;
      background: var(--rp-accent);
    }
    [data-roster-page] .rp-hero-eyebrow {
      color: var(--rp-accent);
      font-weight: 700;
      font-size: 0.7rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
    }
    [data-roster-page] .rp-hero select {
      background: transparent;
      color: var(--rp-hero-fg);
      border: 1px solid color-mix(in srgb, var(--rp-hero-fg) 35%, transparent);
      border-radius: 10px;
      padding: 0.6rem 2.2rem 0.6rem 0.8rem;
      font-size: 0.9rem;
      max-width: 100%;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='3'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.7rem center;
    }
    [data-roster-page] .rp-hero select option {
      color: #16181d;
      background: #fff;
    }

    /* Division banner */
    [data-roster-page] .rp-division {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
    }
    [data-roster-page] .rp-division h2 {
      font-size: clamp(1.6rem, 3.5vw, 2.2rem);
      text-transform: uppercase;
    }
    [data-roster-page] .rp-division::before {
      display: none;
    }
    [data-roster-page] .rp-division-rule {
      width: 2.75rem;
      height: 4px;
      background: var(--rp-accent);
      margin: 0.4rem 0 1rem;
    }

    /* Team cards */
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
      /* Jersey stripe. */
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
      /* The captain's "C", as worn on the jersey. */
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

    /* Entrance — one orchestrated moment, nothing scattered. */
    [data-roster-page] .rp-enter {
      animation: rp-fade-up 0.4s ease-out both;
    }
    [data-roster-page] .rp-enter-late {
      animation: rp-fade-up 0.4s ease-out 0.08s both;
    }
    @keyframes rp-fade-up {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      [data-roster-page] .rp-enter,
      [data-roster-page] .rp-enter-late {
        animation: none;
      }
      [data-roster-page] .rp-card,
      [data-roster-page] .rp-card::before {
        transition: none;
      }
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

      {/* Hero */}
      <header className="rp-hero roster-no-print">
        <div className="mx-auto max-w-5xl px-5 pb-8 pt-10 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="rp-hero-eyebrow">Rosters</p>
              <div className="mt-2 flex items-center gap-4">
                {branding.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={branding.logoUrl} alt="" className="h-14 w-auto shrink-0" />
                )}
                <h1 className="rp-display text-5xl sm:text-6xl" style={{ color: 'var(--rp-hero-fg)' }}>
                  {branding.heroTitle || name}
                </h1>
              </div>
              {branding.heroSubtitle && (
                <p className="mt-3 max-w-xl text-sm" style={{ color: 'var(--rp-hero-fg-muted)' }}>
                  {branding.heroSubtitle}
                </p>
              )}
            </div>

            {standingsUrl && (
              <a
                href={standingsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
                style={{ color: 'var(--rp-hero-fg)' }}
              >
                Standings
                <ExternalLink size={14} aria-hidden />
              </a>
            )}
          </div>

          {sessions && sessions.length > 0 && (
            <div className="mt-8">
              <label htmlFor="roster-session" className="rp-hero-eyebrow mb-1.5 block">
                Season
              </label>
              <select
                id="roster-session"
                value={sessionId ?? ''}
                onChange={(e) => selectSession(Number(e.target.value))}
                className="w-full max-w-md"
              >
                {sessions.map((s) => (
                  <option key={s.sessionId} value={s.sessionId}>
                    {s.programName} — {s.sessionName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading && !groups && <p className="text-sm" style={{ color: 'var(--rp-ink-soft)' }}>Loading…</p>}

        {sessions?.length === 0 && (
          <EmptyState
            title="No seasons available yet"
            body="This page shows rosters for published league seasons. When a season is published, its divisions and teams appear here."
          />
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
                All teams
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
              <p className="rp-hero-eyebrow" style={{ color: 'var(--rp-accent)' }}>
                {breadcrumb.slice(0, -1).map((n) => n.name).join(' · ') || session?.sessionName}
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

        {/* Browse: divisions and teams */}
        {groups && !currentGroup && (
          <section className="rp-enter space-y-10">
            {teams.length === 0 ? (
              <EmptyState
                title="No teams in this season yet"
                body="Teams appear here once they are created and published for this season."
              />
            ) : (
              groups.tree.map((division, index) => {
                const divisionTeams = division.isTeam ? [division] : flattenTeams(division.children);
                return (
                  <div key={division.id} className={index > 0 ? 'rp-enter-late' : undefined}>
                    <div className="rp-division">
                      <h2 className="rp-display notranslate">{division.name}</h2>
                      <span
                        className="text-xs font-semibold uppercase tracking-widest"
                        style={{ color: 'var(--rp-ink-soft)' }}
                      >
                        {divisionTeams.length} team{divisionTeams.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="rp-division-rule" />

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {divisionTeams.map((team) => (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => selectGroup(team.id)}
                          className="rp-card"
                        >
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
                            <span className="mt-0.5 block text-xs" style={{ color: 'var(--rp-ink-soft)' }}>
                              {totalPlayerCount(team)} player
                              {totalPlayerCount(team) === 1 ? '' : 's'}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        )}
      </main>
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
