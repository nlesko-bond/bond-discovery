import type { FeatureConfig, Program, ProgramSortMode, ProgramType, Session } from '@/types';

/** Every program type Bond can return, in the order the admin list shows by default. */
export const DEFAULT_PROGRAM_TYPE_ORDER: ProgramType[] = [
  'class',
  'camp',
  'clinic',
  'league',
  'tournament',
  'club_team',
  'lesson',
  'drop_in',
  'rental',
];

const PROGRAM_SORT_MODES: ReadonlySet<ProgramSortMode> = new Set<ProgramSortMode>([
  'default',
  'start_date_asc',
  'start_date_desc',
  'name_asc',
  'name_desc',
  'program_type',
]);

const NAME_COLLATOR = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Unknown or absent stored values fall back to 'default' (Bond order). */
export function resolveProgramSortMode(raw: unknown): ProgramSortMode {
  return PROGRAM_SORT_MODES.has(raw as ProgramSortMode) ? (raw as ProgramSortMode) : 'default';
}

/**
 * Admin-configured type order with unknown entries dropped and any missing
 * types appended in default order, so the sort always covers every type.
 */
export function resolveProgramTypeOrder(raw: unknown): ProgramType[] {
  const known = new Set<ProgramType>(DEFAULT_PROGRAM_TYPE_ORDER);
  const configured = Array.isArray(raw)
    ? raw.filter((item): item is ProgramType => known.has(item as ProgramType))
    : [];
  const deduped = configured.filter((item, index) => configured.indexOf(item) === index);
  const missing = DEFAULT_PROGRAM_TYPE_ORDER.filter((item) => !deduped.includes(item));
  return [...deduped, ...missing];
}

function getSessions(program: Program): Session[] {
  const sessions = program.sessions;
  if (!sessions) return [];
  if (Array.isArray(sessions)) return sessions;
  if (typeof sessions === 'object' && 'data' in sessions) {
    return ((sessions as { data?: Session[] }).data) ?? [];
  }
  return [];
}

function parseDateMs(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

/**
 * The program's "start date" for ordering: the earliest start among sessions
 * that have not ended yet (mirrors the card's upcoming-session count), falling
 * back to the earliest start of any session. Undefined when no session has a
 * start date.
 */
export function resolveProgramStartDateMs(
  program: Program,
  now: Date = new Date(),
): number | undefined {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  let earliestUpcoming: number | undefined;
  let earliestAny: number | undefined;
  for (const session of getSessions(program)) {
    const startMs = parseDateMs(session.startDate);
    if (startMs === undefined) continue;
    if (earliestAny === undefined || startMs < earliestAny) {
      earliestAny = startMs;
    }
    const endMs = parseDateMs(session.endDate);
    const hasEnded = endMs !== undefined && endMs < todayMs;
    if (!hasEnded && (earliestUpcoming === undefined || startMs < earliestUpcoming)) {
      earliestUpcoming = startMs;
    }
  }
  return earliestUpcoming ?? earliestAny;
}

/**
 * Orders programs for display per `features.programSort`. Returns the input
 * array untouched for 'default' so pages without the setting keep Bond's
 * order byte-for-byte. Every other mode is a stable sort, so ties keep Bond
 * order (alphabetical in practice).
 */
export function sortProgramsForDisplay(
  programs: Program[],
  features: Pick<FeatureConfig, 'programSort' | 'programTypeOrder'>,
  now: Date = new Date(),
): Program[] {
  const mode = resolveProgramSortMode(features.programSort);
  if (mode === 'default') {
    return programs;
  }

  if (mode === 'name_asc' || mode === 'name_desc') {
    const direction = mode === 'name_asc' ? 1 : -1;
    return [...programs].sort(
      (a, b) => direction * NAME_COLLATOR.compare(a.name ?? '', b.name ?? ''),
    );
  }

  if (mode === 'start_date_asc' || mode === 'start_date_desc') {
    const direction = mode === 'start_date_asc' ? 1 : -1;
    const startById = new Map<string, number | undefined>();
    programs.forEach((program) => {
      startById.set(program.id, resolveProgramStartDateMs(program, now));
    });
    return [...programs].sort((a, b) => {
      const startA = startById.get(a.id);
      const startB = startById.get(b.id);
      // Programs with no session dates always sort last, in either direction.
      if (startA === undefined && startB === undefined) return 0;
      if (startA === undefined) return 1;
      if (startB === undefined) return -1;
      return direction * (startA - startB);
    });
  }

  const typeOrder = resolveProgramTypeOrder(features.programTypeOrder);
  const rank = (program: Program): number => {
    const index = program.type ? typeOrder.indexOf(program.type) : -1;
    return index === -1 ? typeOrder.length : index;
  };
  return [...programs].sort((a, b) => rank(a) - rank(b));
}
