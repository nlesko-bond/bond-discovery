import { NextRequest, NextResponse } from 'next/server';
import { toCsv, type CsvCell } from '@/lib/csv';
import {
  MAX_BULK_GROUPS,
  loadGroupParticipants,
  loadRosterGroups,
  loadRosterScope,
  loadRostersForGroups,
} from '@/lib/roster-data';
import { consumeRosterRateLimit } from '@/lib/roster-rate-limit';
import {
  assertGroupsInSession,
  findSessionInScope,
  numericParam,
  resolveRosterRequest,
} from '@/lib/roster-request';
import { flattenTeams, findGroupNode } from '@/lib/roster-tree';
import type { RosterParticipant, RosterViewerMode } from '@/types/rosters';

export const dynamic = 'force-dynamic';
// A whole-session export is one Bond request per team.
export const maxDuration = 60;

interface Ctx {
  params: Promise<{ slug: string }>;
}

/**
 * Columns follow the same visibility rules as the screen. `redactParticipant`
 * has already removed anything this viewer may not see, so the header row is
 * derived from what actually came back rather than from a fixed list — a
 * public export can never gain a column by accident.
 */
function buildRows(
  participants: Array<RosterParticipant & { teamName?: string }>,
  mode: RosterViewerMode,
  includeTeam: boolean
): { headers: string[]; rows: CsvCell[][] } {
  const isStaff = mode === 'staff';
  const anyGuardian = participants.some((p) => p.contactIsGuardian);

  const headers = [
    ...(includeTeam ? ['Team'] : []),
    'Jersey',
    'Player',
    'Position',
    'Role',
    ...(isStaff
      ? [
          anyGuardian ? 'Guardian email' : 'Email',
          anyGuardian ? 'Guardian phone' : 'Phone',
          'Guardian',
          'Age',
          'Date of birth',
          'Waiver signed',
          'Waiver date',
          'Registered',
          'Products',
        ]
      : []),
  ];

  const rows = participants.map((p) => [
    ...(includeTeam ? [p.teamName ?? ''] : []),
    p.jerseyNumber ?? '',
    p.displayName,
    p.position ?? '',
    p.teamRole ?? '',
    ...(isStaff
      ? [
          p.email ?? '',
          p.phone ?? '',
          p.guardianName ?? '',
          p.age ?? '',
          p.birthDate ?? '',
          p.waiverSigned === undefined ? '' : p.waiverSigned ? 'Yes' : 'No',
          p.waiverSignedDate ?? '',
          p.registrationDate ?? '',
          (p.productNames ?? []).join('; '),
        ]
      : []),
  ]);

  return { headers, rows };
}

export async function GET(request: NextRequest, context: Ctx) {
  const { slug } = await context.params;

  const resolved = await resolveRosterRequest(slug);
  if (!resolved.ok) return resolved.response;

  // A whole-session export is the largest fan-out on the surface.
  const limited = consumeRosterRateLimit(
    request,
    slug,
    'bulk',
    request.nextUrl.searchParams.get('groupId') ? 1 : MAX_BULK_GROUPS
  );
  if (limited.blocked) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } }
    );
  }

  const { config, mode } = resolved.context;

  // An org can withhold export entirely, the same control LeagueApps ships.
  if (!config.allowPrint) {
    return NextResponse.json({ error: 'Export is disabled for this page' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const sessionId = numericParam(params.get('sessionId'));
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }
  const groupId = numericParam(params.get('groupId'));

  try {
    const sessions = await loadRosterScope(config);
    const session = findSessionInScope(sessions, sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not available on this page' }, { status: 404 });
    }

    const groups = await loadRosterGroups(config, session);
    let participants: Array<RosterParticipant & { teamName?: string }>;
    let label: string;

    if (groupId) {
      // Bound the group to this session before exporting its PII.
      const bounded = assertGroupsInSession(groups.tree, [groupId]);
      if (!bounded.ok) return bounded.response;

      participants = await loadGroupParticipants(config, session, groupId, mode);
      label = findGroupNode(groups.tree, groupId)?.name ?? `group-${groupId}`;
    } else {
      const teams = flattenTeams(groups.tree);

      // Checked before loading anything: refusing after the fan-out would pay
      // the full per-team cost only to throw the result away.
      if (teams.length > MAX_BULK_GROUPS) {
        return NextResponse.json(
          {
            error: `This session has ${teams.length} teams; export is limited to ${MAX_BULK_GROUPS} at a time. Export one division or team at a time.`,
            teamCount: teams.length,
            cap: MAX_BULK_GROUPS,
          },
          { status: 413 }
        );
      }

      const bulk = await loadRostersForGroups(
        config,
        session,
        teams.map((t) => t.id),
        mode
      );
      const nameById = new Map(teams.map((t) => [t.id, t.name]));
      participants = bulk.rosters.flatMap((r) =>
        r.participants.map((p) => ({ ...p, teamName: nameById.get(r.groupId) ?? '' }))
      );
      label = session.sessionName;
    }

    const { headers, rows } = buildRows(participants, mode, !groupId);
    const csv = toCsv(headers, rows);

    const safe = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'roster';
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safe}-roster-${date}.csv"`,
        // Never let a CDN or proxy hold an export that may contain PII.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error(`[rosters/${slug}/export]`, error);
    return NextResponse.json({ error: 'Export failed' }, { status: 502 });
  }
}
