'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ExternalLink, Printer, Users } from 'lucide-react';
import { RosterTable } from '@/components/rosters/RosterTable';
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
 * The consumer roster page. Deliberately does one job: families and players
 * browsing who is on which team.
 *
 * Everything operational — staff columns, waiver status, check-in sheets, the
 * registration grid, CSV export — lives on the separate staff surface at
 * /rosters/{slug}/staff. Nothing here hints that surface exists; a parent
 * should never see a control that is not for them.
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

/**
 * Google Fonts family names, and nothing else. Branding is DB-supplied and is
 * interpolated into a <style> tag below, so anything outside a plain family
 * name falls back rather than reaching CSS.
 */
function safeFont(name: string, fallback: string): string {
  return /^[a-zA-Z0-9 ]{1,60}$/.test(name) ? name : fallback;
}

export function RosterPage(props: Props) {
  const { slug, name, branding, unlocked, allowPrint } = props;

  const fontHeading = safeFont(branding.fontHeading, 'Bebas Neue');
  const fontBody = safeFont(branding.fontBody, 'Open Sans');

  const [isUnlocked, setIsUnlocked] = useState(unlocked);
  const [sessions, setSessions] = useState<RosterSessionRef[] | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [groups, setGroups] = useState<GroupsResponse | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [participants, setParticipants] = useState<RosterParticipant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // URL carries session and team, so every roster is a shareable address.
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
        // A lapsed cookie goes back to the password form, not a dead end.
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
    // Clear first so the previous team's rows never sit under the new team's
    // heading while the fetch runs — window.print() would capture that.
    setParticipants(null);
    setGroupId(next);
    syncUrl(sessionId, next);
  }

  const brandCss = `
    @import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontHeading)}:wght@400;600;700&family=${encodeURIComponent(fontBody)}:wght@400;500;600&display=swap');
    [data-roster-page] {
      --roster-primary: ${branding.primaryColor};
      --roster-accent: ${branding.accentColor};
      --roster-accent-light: ${branding.accentColorLight};
      --roster-bg: ${branding.bgColor};
      font-family: '${fontBody}', system-ui, sans-serif;
      background-color: var(--roster-bg);
      -webkit-font-smoothing: antialiased;
    }
    [data-roster-page] .roster-heading {
      font-family: '${fontHeading}', '${fontBody}', sans-serif;
      letter-spacing: 0.01em;
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
      <header className="roster-no-print" style={{ backgroundColor: 'var(--roster-primary)' }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-4 px-4 pb-6 pt-8">
          <div className="flex min-w-0 items-center gap-4">
            {branding.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt=""
                className="h-12 w-auto rounded bg-white/90 p-1"
              />
            )}
            <div className="min-w-0">
              <h1 className="roster-heading truncate text-3xl text-white sm:text-4xl">
                {branding.heroTitle || name}
              </h1>
              {branding.heroSubtitle && (
                <p className="mt-0.5 truncate text-sm text-white/80">{branding.heroSubtitle}</p>
              )}
            </div>
          </div>

          {standingsUrl && (
            <a
              href={standingsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-inset ring-white/30 transition-colors hover:bg-white/20"
            >
              Standings
              <ExternalLink size={14} aria-hidden />
            </a>
          )}
        </div>

        {/* Season picker sits inside the hero so the page opens on content. */}
        {sessions && sessions.length > 0 && (
          <div className="mx-auto max-w-5xl px-4 pb-6">
            <label htmlFor="roster-session" className="mb-1 block text-xs font-medium uppercase tracking-wide text-white/70">
              Season
            </label>
            <select
              id="roster-session"
              value={sessionId ?? ''}
              onChange={(e) => selectSession(Number(e.target.value))}
              className="w-full max-w-md rounded-lg border-0 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm"
            >
              {sessions.map((s) => (
                <option key={s.sessionId} value={s.sessionId}>
                  {s.programName} — {s.sessionName}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading && !groups && <p className="text-sm text-gray-500">Loading…</p>}

        {sessions?.length === 0 && (
          <EmptyState
            title="No seasons available yet"
            body="This page shows rosters for published league seasons. When a season is published, its divisions and teams appear here."
          />
        )}

        {/* Team roster */}
        {groups && currentGroup && (
          <section>
            <div className="roster-no-print mb-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => selectGroup(null)}
                className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
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

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 border-b border-gray-100 pb-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {breadcrumb.slice(0, -1).map((n) => n.name).join(' · ') || session?.sessionName}
                </p>
                <h2 className="roster-heading notranslate mt-0.5 text-3xl text-gray-900">
                  {currentGroup.name}
                </h2>
                <p className="roster-print-meta mt-1 text-sm text-gray-500">
                  {session?.programName} · {session?.sessionName}
                </p>
              </div>

              {participants ? (
                <RosterTable participants={participants} mode="public" />
              ) : (
                <p className="text-sm text-gray-500">Loading roster…</p>
              )}
            </div>
          </section>
        )}

        {/* Browse: divisions and teams */}
        {groups && !currentGroup && (
          <section className="space-y-8">
            {teams.length === 0 ? (
              <EmptyState
                title="No teams in this season yet"
                body="Teams appear here once they are created and published for this season."
              />
            ) : (
              groups.tree.map((division) => {
                const divisionTeams = division.isTeam ? [division] : flattenTeams(division.children);
                return (
                  <div key={division.id}>
                    <div className="mb-3 flex items-baseline justify-between gap-3">
                      <h2 className="roster-heading notranslate text-2xl text-gray-900">
                        {division.name}
                      </h2>
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        {divisionTeams.length} team{divisionTeams.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {divisionTeams.map((team) => (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => selectGroup(team.id)}
                          className="group flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                        >
                          {team.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={team.logoUrl}
                              alt=""
                              className="h-11 w-11 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                              style={{ backgroundColor: 'var(--roster-accent)' }}
                            >
                              {team.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="notranslate block truncate text-[15px] font-semibold text-gray-900">
                              {team.name}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                              <Users size={12} aria-hidden />
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
