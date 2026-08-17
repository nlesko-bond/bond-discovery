'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, LogOut, Printer } from 'lucide-react';
import { RosterTable } from '@/components/rosters/RosterTable';
import { SheetGrid, type SheetColumn } from '@/components/rosters/SheetGrid';
import { UnlockForm } from '@/components/rosters/UnlockForm';
import { flattenTeams } from '@/lib/roster-tree';
import type {
  RosterGroupNode,
  RosterParticipant,
  RosterSessionRef,
  RosterViewerMode,
} from '@/types/rosters';

/**
 * The staff workspace at /rosters/{slug}/staff.
 *
 * Where the consumer page is a brochure, this is a tool: full permitted
 * columns, waiver status as a working filter, printable check-in sheets, the
 * registration grid, CSV export. It is deliberately unbranded — dense, neutral
 * chrome in the form-responses mould — because the audience is the front desk,
 * not families.
 *
 * The staff password is the front door: nothing renders without a verified
 * staff cookie, and every payload behind it is still redacted server-side to
 * exactly the fields this page's configuration permits.
 */

interface Props {
  slug: string;
  name: string;
  staffUnlocked: boolean;
}

interface GroupsResponse {
  session: RosterSessionRef;
  tree: RosterGroupNode[];
  timezone: string;
}

interface SheetResponse {
  kind: 'checkin' | 'matrix';
  timezone: string;
  groupName?: string | null;
  columns: SheetColumn[];
  participants: RosterParticipant[];
  eventDateKeys?: Record<number, string>;
  marks?: Record<string, number[]>;
  truncated?: { requested: number; loaded: number; cap: number };
}

type StaffTab = 'roster' | 'checkin' | 'matrix';

const TABS: Array<[StaffTab, string]> = [
  ['roster', 'Roster'],
  ['checkin', 'Check-in sheet'],
  ['matrix', 'Registration grid'],
];

export function RosterStaffApp({ slug, name, staffUnlocked }: Props) {
  const [unlocked, setUnlocked] = useState(staffUnlocked);
  const [sessions, setSessions] = useState<RosterSessionRef[] | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [groups, setGroups] = useState<GroupsResponse | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [participants, setParticipants] = useState<RosterParticipant[] | null>(null);
  const [mode, setMode] = useState<RosterViewerMode>('public');
  const [sheet, setSheet] = useState<SheetResponse | null>(null);
  const [tab, setTab] = useState<StaffTab>('roster');
  const [unsignedOnly, setUnsignedOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const relock = useCallback(() => {
    setUnlocked(false);
    setSessions(null);
    setParticipants(null);
    setSheet(null);
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/rosters/${slug}/scope`);
        if (response.status === 401) {
          if (!cancelled) relock();
          return;
        }
        if (!response.ok) throw new Error('scope');
        const data = await response.json();
        if (cancelled) return;
        setSessions(data.sessions);
        setSessionId(data.sessions[0]?.sessionId ?? null);
      } catch {
        if (!cancelled) setError('Could not load seasons.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, unlocked, relock]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setGroups(null);
      setGroupId(null);
      try {
        const response = await fetch(`/api/rosters/${slug}/groups?sessionId=${sessionId}`);
        if (response.status === 401) {
          if (!cancelled) relock();
          return;
        }
        if (!response.ok) throw new Error('groups');
        const data: GroupsResponse = await response.json();
        if (cancelled) return;
        setGroups(data);
        // Staff come here to work on a roster; open the first team directly
        // rather than making them browse a card grid first.
        setGroupId(flattenTeams(data.tree)[0]?.id ?? null);
      } catch {
        if (!cancelled) setError('Could not load teams for this season.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, sessionId, relock]);

  useEffect(() => {
    if (!sessionId || !groupId) {
      setParticipants(null);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setParticipants(null);
      try {
        const response = await fetch(
          `/api/rosters/${slug}/participants?sessionId=${sessionId}&groupId=${groupId}`
        );
        if (response.status === 401) {
          if (!cancelled) relock();
          return;
        }
        if (!response.ok) throw new Error('participants');
        const data = await response.json();
        if (!cancelled) {
          setParticipants(data.participants);
          setMode(data.mode);
        }
      } catch {
        if (!cancelled) setError('Could not load this roster.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, sessionId, groupId, relock]);

  useEffect(() => {
    if (tab === 'roster' || !sessionId) {
      setSheet(null);
      return;
    }
    if (tab === 'checkin' && !groupId) {
      setSheet(null);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({ sessionId: String(sessionId), kind: tab });
        if (tab === 'checkin' && groupId) query.set('groupId', String(groupId));
        const response = await fetch(`/api/rosters/${slug}/sheet?${query}`);
        if (response.status === 401) {
          if (!cancelled) relock();
          return;
        }
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
  }, [slug, sessionId, groupId, tab, relock]);

  const session = useMemo(
    () => sessions?.find((s) => s.sessionId === sessionId) ?? null,
    [sessions, sessionId]
  );
  const teams = useMemo(() => (groups ? flattenTeams(groups.tree) : []), [groups]);
  const team = teams.find((t) => t.id === groupId) ?? null;
  const unsignedCount = participants?.filter((p) => p.waiverSigned === false).length ?? 0;

  async function signOut() {
    await fetch(`/api/rosters/${slug}/unlock?scope=staff`, { method: 'DELETE' }).catch(() => {});
    relock();
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-slate-100">
        <UnlockForm
          slug={slug}
          scope="staff"
          title={`${name} — staff`}
          description="Enter the staff password to manage rosters, check-in sheets and exports."
          onUnlocked={() => setUnlocked(true)}
        />
      </div>
    );
  }

  return (
    <div className="roster-print-root min-h-screen bg-slate-100">
      {/* Toolbar */}
      <header className="roster-no-print sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-900">{name}</h1>
            <p className="text-xs text-slate-500">Staff roster tools</p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <a
              href={`/rosters/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Public page
              <ExternalLink size={13} aria-hidden />
            </a>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              <LogOut size={13} aria-hidden />
              Lock
            </button>
          </div>
        </div>

        <div className="mx-auto flex max-w-6xl flex-wrap items-end gap-3 px-4 pb-3">
          <div>
            <label htmlFor="staff-session" className="mb-1 block text-xs font-medium text-slate-500">
              Season
            </label>
            <select
              id="staff-session"
              value={sessionId ?? ''}
              onChange={(e) => setSessionId(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
            >
              {(sessions ?? []).map((s) => (
                <option key={s.sessionId} value={s.sessionId}>
                  {s.programName} — {s.sessionName}
                </option>
              ))}
            </select>
          </div>

          {tab !== 'matrix' && (
            <div>
              <label htmlFor="staff-team" className="mb-1 block text-xs font-medium text-slate-500">
                Team
              </label>
              <select
                id="staff-team"
                value={groupId ?? ''}
                onChange={(e) => setGroupId(Number(e.target.value))}
                className="max-w-[16rem] rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div role="group" aria-label="View" className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {TABS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  tab === value
                    ? 'bg-white font-medium text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Printer size={14} aria-hidden />
              Print
            </button>
            {sessionId && (
              <a
                href={`/api/rosters/${slug}/export?sessionId=${sessionId}${
                  tab === 'roster' && groupId ? `&groupId=${groupId}` : ''
                }`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Download size={14} aria-hidden />
                Export CSV
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {mode === 'public' && participants && (
          <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your staff session has expired — showing public fields only. Lock and sign in again to
            see contact details and waiver status.
          </p>
        )}

        {tab === 'roster' && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="roster-no-print mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="notranslate text-lg font-semibold text-slate-900">
                  {team?.name ?? 'Roster'}
                </h2>
                <p className="roster-print-meta text-xs text-slate-500">
                  {session?.programName} · {session?.sessionName}
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={unsignedOnly}
                  onChange={(e) => setUnsignedOnly(e.target.checked)}
                />
                Unsigned waivers only
                {unsignedCount > 0 && (
                  <span className="badge bg-amber-100 text-amber-800">{unsignedCount}</span>
                )}
              </label>
            </div>

            {participants ? (
              <RosterTable participants={participants} mode={mode} unsignedOnly={unsignedOnly} />
            ) : loading ? (
              <p className="text-sm text-slate-500">Loading roster…</p>
            ) : (
              <p className="text-sm text-slate-500">Pick a season and team above.</p>
            )}
          </section>
        )}

        {tab !== 'roster' && sheet && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
                  ? `Check-in — ${sheet.groupName ?? team?.name ?? 'Team'}`
                  : `Registration grid — ${session?.sessionName ?? ''}`
              }
              subheading={`${session?.programName ?? ''} · ${session?.sessionName ?? ''}`}
            />
          </section>
        )}

        {tab !== 'roster' && !sheet && loading && (
          <p className="text-sm text-slate-500">Building sheet…</p>
        )}
      </main>
    </div>
  );
}
