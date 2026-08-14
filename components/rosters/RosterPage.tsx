'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ExternalLink, Printer, Users } from 'lucide-react';
import { RosterTable } from '@/components/rosters/RosterTable';
import { SheetGrid, type SheetColumn } from '@/components/rosters/SheetGrid';
import { UnlockForm } from '@/components/rosters/UnlockForm';
import { getLeagueStandingsUrl } from '@/lib/schedule-standings';
import { flattenTeams, groupPath, totalPlayerCount } from '@/lib/roster-tree';
import type {
  RosterBranding,
  RosterGroupNode,
  RosterPageAccess,
  RosterParticipant,
  RosterSessionRef,
  RosterViewerMode,
} from '@/types/rosters';

interface Props {
  slug: string;
  name: string;
  branding: RosterBranding;
  pageAccess: RosterPageAccess;
  unlocked: boolean;
  mode: RosterViewerMode;
  allowPrint: boolean;
  hasStaffPassword: boolean;
}

interface ScopeResponse {
  sessions: RosterSessionRef[];
  mode: RosterViewerMode;
}

interface GroupsResponse {
  session: RosterSessionRef;
  tree: RosterGroupNode[];
  timezone: string;
  groupCount: number;
}

interface SheetResponse {
  kind: 'checkin' | 'matrix';
  timezone: string;
  groupName?: string | null;
  columns: SheetColumn[];
  participants: RosterParticipant[];
  /** event id -> facility-local date column key, computed server-side. */
  eventDateKeys?: Record<number, string>;
  marks?: Record<string, number[]>;
  truncated?: { requested: number; loaded: number; cap: number };
}

function brandingStyle(branding: RosterBranding): React.CSSProperties {
  return {
    ['--roster-primary' as string]: branding.primaryColor,
    ['--roster-accent' as string]: branding.accentColor,
    ['--roster-accent-light' as string]: branding.accentColorLight,
    backgroundColor: branding.bgColor,
  };
}

export function RosterPage(props: Props) {
  const { slug, name, branding, unlocked, mode, allowPrint, hasStaffPassword } = props;

  const [isUnlocked, setIsUnlocked] = useState(unlocked);
  const [viewerMode, setViewerMode] = useState<RosterViewerMode>(mode);
  const [sessions, setSessions] = useState<RosterSessionRef[] | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [groups, setGroups] = useState<GroupsResponse | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [participants, setParticipants] = useState<RosterParticipant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStaffUnlock, setShowStaffUnlock] = useState(false);
  const [view, setView] = useState<'browse' | 'checkin' | 'matrix'>('browse');
  const [sheet, setSheet] = useState<SheetResponse | null>(null);

  // URL is the source of truth for the current view, so every roster is a
  // shareable, printable, bookmarkable address.
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
        // The cookie can lapse while the tab is open; send the viewer back to
        // the password form instead of a dead-end error.
        if (response.status === 401) {
          if (!cancelled) setIsUnlocked(false);
          return;
        }
        if (!response.ok) throw new Error('scope');
        const data: ScopeResponse = await response.json();
        if (cancelled) return;

        setSessions(data.sessions);
        setViewerMode(data.mode);

        const params = new URLSearchParams(window.location.search);
        const fromUrl = Number.parseInt(params.get('session') || '', 10);
        const initial = data.sessions.some((s) => s.sessionId === fromUrl)
          ? fromUrl
          : data.sessions[0]?.sessionId ?? null;
        setSessionId(initial);

        const groupFromUrl = Number.parseInt(params.get('group') || '', 10);
        if (Number.isFinite(groupFromUrl)) setGroupId(groupFromUrl);
      } catch {
        if (!cancelled) setError('Could not load sessions.');
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
        if (!cancelled) setError('Could not load teams for this session.');
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
        if (!cancelled) {
          setParticipants(data.participants);
          setViewerMode(data.mode);
        }
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

  // Sheet views fetch their own shape: participants plus date columns.
  useEffect(() => {
    if (view === 'browse' || !sessionId) {
      setSheet(null);
      setError(null);
      return;
    }
    if (view === 'checkin' && !groupId) {
      setSheet(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({ sessionId: String(sessionId), kind: view });
        if (view === 'checkin' && groupId) query.set('groupId', String(groupId));
        const response = await fetch(`/api/rosters/${slug}/sheet?${query}`);
        if (!response.ok) throw new Error('sheet');
        const data: SheetResponse = await response.json();
        if (!cancelled) setSheet(data);
      } catch {
        if (!cancelled) setError('Could not build this sheet.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, sessionId, groupId, view]);

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
    // Clear first: otherwise the previous team's rows stay on screen under the
    // new team's heading while the fetch runs, and window.print() would
    // capture that -- a paper sheet with the wrong team's PII.
    setParticipants(null);
    setGroupId(next);
    syncUrl(sessionId, next);
  }

  if (!isUnlocked) {
    return (
      <div style={brandingStyle(branding)} className="min-h-screen">
        <UnlockForm
          slug={slug}
          scope={props.pageAccess === 'staff' ? 'staff' : 'viewer'}
          title={name}
          description="This page is password protected."
          onUnlocked={() => {
            setIsUnlocked(true);
            setShowStaffUnlock(false);
          }}
        />
      </div>
    );
  }

  return (
    <div style={brandingStyle(branding)} className="roster-print-root min-h-screen">
      <header className="roster-no-print border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-4">
          {branding.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="" className="h-8 w-auto" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-gray-900">
              {branding.heroTitle || name}
            </h1>
            {branding.heroSubtitle && (
              <p className="truncate text-sm text-gray-600">{branding.heroSubtitle}</p>
            )}
          </div>

          {standingsUrl && (
            <a
              href={standingsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Standings
              <ExternalLink size={14} aria-hidden />
            </a>
          )}

          {allowPrint && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Printer size={14} aria-hidden />
              Print
            </button>
          )}

          {hasStaffPassword && viewerMode !== 'staff' && (
            <button
              type="button"
              onClick={() => setShowStaffUnlock((v) => !v)}
              aria-expanded={showStaffUnlock}
              aria-controls="roster-staff-unlock"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Staff view
            </button>
          )}
        </div>

        {sessions && sessions.length > 0 && (
          <div className="mx-auto max-w-5xl px-4 pb-4">
            <label htmlFor="roster-session" className="sr-only">
              Session
            </label>
            <select
              id="roster-session"
              value={sessionId ?? ''}
              onChange={(e) => selectSession(Number(e.target.value))}
              className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
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

      {showStaffUnlock && viewerMode !== 'staff' && (
        <div id="roster-staff-unlock" className="roster-no-print border-b border-gray-200 bg-white">
          <UnlockForm
            slug={slug}
            scope="staff"
            title="Staff view"
            description="Unlocks contact details, ages and waiver status."
            onUnlocked={() => {
              setShowStaffUnlock(false);
              // Full reload so the server re-resolves the viewer mode from the
              // freshly-set cookie. The URL already carries session and group.
              window.location.reload();
            }}
          />
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-6">
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading && !groups && <p className="text-sm text-gray-500">Loading…</p>}

        {/* View switcher. Check-in needs a team selected; matrix spans the session. */}
        {groups && (
          <div className="roster-no-print mb-4 flex flex-wrap gap-2" role="group" aria-label="View">
            {(
              [
                ['browse', 'Teams'],
                ['checkin', 'Check-in sheet'],
                ['matrix', 'Registration grid'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                aria-disabled={value === 'checkin' && !groupId}
                className={`rounded-lg border px-3 py-1.5 text-sm aria-disabled:opacity-40 ${
                  view === value
                    ? 'border-transparent text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
                style={view === value ? { backgroundColor: 'var(--roster-primary)' } : undefined}
              >
                {label}
              </button>
            ))}

            {allowPrint && sessionId && (
              <a
                href={`/api/rosters/${slug}/export?sessionId=${sessionId}${groupId ? `&groupId=${groupId}` : ''}`}
                className="ml-auto rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Export CSV
              </a>
            )}
          </div>
        )}

        {/* Grid sheets */}
        {view !== 'browse' && sheet && (
          <SheetGrid
            kind={sheet.kind}
            participants={sheet.participants}
            columns={sheet.columns}
            marks={sheet.marks}
            eventDateKeys={sheet.eventDateKeys}
            truncated={sheet.truncated}
            timezone={sheet.timezone}
            heading={
              sheet.kind === 'checkin'
                ? `Check-in — ${sheet.groupName ?? 'Team'}`
                : `Registration grid — ${session?.sessionName ?? ''}`
            }
            subheading={`${session?.programName ?? ''} · ${session?.sessionName ?? ''}`}
          />
        )}

        {view === 'checkin' && !groupId && (
          <EmptyState
            title="Pick a team first"
            body="A check-in sheet covers one team. Open a team from the Teams view, then switch back."
          />
        )}

        {sessions?.length === 0 && (
          <EmptyState
            title="No sessions available yet"
            body="This page shows rosters for published league sessions. When a season is published, its divisions and teams appear here."
          />
        )}

        {/* Team roster */}
        {view === 'browse' && groups && currentGroup && (
          <section>
            <button
              type="button"
              onClick={() => selectGroup(null)}
              className="roster-no-print mb-3 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft size={16} aria-hidden />
              All teams
            </button>

            <div className="mb-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                {breadcrumb.slice(0, -1).map((n) => n.name).join(' · ') || session?.sessionName}
              </p>
              <h2 className="notranslate text-xl font-semibold text-gray-900">
                {currentGroup.name}
              </h2>
              <p className="text-sm text-gray-600">
                {session?.programName} · {session?.sessionName}
                {groups.timezone ? ` · times in ${groups.timezone.replace(/_/g, ' ')}` : ''}
              </p>
            </div>

            {participants ? (
              <RosterTable participants={participants} mode={viewerMode} />
            ) : (
              <p className="text-sm text-gray-500">Loading roster…</p>
            )}
          </section>
        )}

        {/* Browse: divisions and teams */}
        {view === 'browse' && groups && !currentGroup && (
          <section className="space-y-6">
            {teams.length === 0 ? (
              <EmptyState
                title="No teams in this session yet"
                body="Teams appear here once they are created and published for this season."
              />
            ) : (
              groups.tree.map((division) => (
                <div key={division.id}>
                  <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-gray-200 pb-1">
                    <h2 className="notranslate text-sm font-semibold uppercase tracking-wide text-gray-700">
                      {division.name}
                    </h2>
                    <span className="text-xs text-gray-500">
                      {(division.isTeam ? 1 : flattenTeams(division.children).length)} team
                      {(division.isTeam ? 1 : flattenTeams(division.children).length) === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(division.isTeam ? [division] : flattenTeams(division.children)).map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => selectGroup(team.id)}
                        className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition-shadow hover:shadow-sm"
                      >
                        <span
                          aria-hidden="true"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: 'var(--roster-accent)' }}
                        >
                          {team.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="notranslate block truncate text-sm font-medium text-gray-900">
                            {team.name}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Users size={12} aria-hidden />
                            {totalPlayerCount(team)} player
                            {totalPlayerCount(team) === 1 ? '' : 's'}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        )}
      </main>
    </div>
  );
}

/**
 * Empty states keep explaining what the page is for. A pre-season roster page
 * with a bare "nothing here" teaches the visitor nothing about why.
 */
function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white/60 px-6 py-10 text-center">
      <h2 className="text-base font-medium text-gray-900">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">{body}</p>
    </div>
  );
}
