'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Calendar,
  CalendarDays,
  ExternalLink,
  MapPin,
  Search,
  Trophy,
  Users,
} from 'lucide-react';
import type { DiscoveryConfig, Program, Session } from '@/types';
import { ExpandableText } from '@/components/discovery/ProgramCard';
import { gtmEvent } from '@/components/analytics/GoogleTagManager';
import { bondAnalytics } from '@/lib/analytics';
import { isCompedProduct } from '@/lib/host-shell/session-card-model';
import { getBondRegisterLinkAnalyticsAttributes } from '@/lib/host-shell/registration-analytics';
import {
  getSeasonPhase,
  getSeasonWeek,
  getSessionIdsWithMatchups,
  isSeasonRegistrationOpen,
  shouldShowLeagueLinks,
  sortSeasonsForLeagueCard,
  todayYmd,
  type LeagueSeasonPhase,
} from '@/lib/league-seasons';
import { getLeagueCompetitionUrl, getRostersUrlForSession } from '@/lib/schedule-standings';
import {
  resolveSessionCardPriceLabel,
  resolveSessionCardPriceSettings,
} from '@/lib/session-card-price';
import {
  buildRegistrationUrl,
  cn,
  formatAgeRange,
  formatDateRange,
  getGenderLabel,
  getProgramTypeLabel,
  getSportLabel,
} from '@/lib/utils';

type LinkTarget = '_blank' | '_top' | '_self';

interface ILeagueEvent {
  sessionId?: string | number;
  title?: string;
  startDate?: string;
  timezone?: string;
}

export interface ILeagueProgramListProps {
  programs: Program[];
  config: DiscoveryConfig;
  /** Schedule events already on the page; used to detect published game schedules. */
  events?: ILeagueEvent[];
  linkTarget?: LinkTarget;
  /** Portal pages open the in-page schedule through a callback. */
  onOpenSchedule?: (programId: string, sessionId: string) => void;
  /**
   * Fire register analytics on click. Pass false inside the portal iframe,
   * where HostShellPortalBridge tracks register clicks from the data attributes.
   */
  trackRegisterClicks?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_PLURALS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/** "Wednesdays" / "Tue & Thu" from a season's events (in their own timezone). */
function buildSessionDayLabels(events: ILeagueEvent[] | undefined): Map<string, string> {
  const days = new Map<string, Set<number>>();
  for (const event of events || []) {
    if (event.sessionId === undefined || event.sessionId === null || !event.startDate) continue;
    let weekday: number;
    try {
      const name = new Date(event.startDate).toLocaleDateString('en-US', {
        weekday: 'short',
        timeZone: event.timezone || undefined,
      });
      weekday = WEEKDAYS.indexOf(name);
    } catch {
      continue;
    }
    if (weekday < 0) continue;
    const key = String(event.sessionId);
    if (!days.has(key)) days.set(key, new Set());
    days.get(key)!.add(weekday);
  }

  const labels = new Map<string, string>();
  days.forEach((set, sessionId) => {
    // Mon-first ordering; more than three days reads as noise, so skip it.
    const sorted = Array.from(set).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    if (sorted.length === 1) labels.set(sessionId, WEEKDAY_PLURALS[sorted[0]]);
    else if (sorted.length <= 3) labels.set(sessionId, sorted.map((d) => WEEKDAYS[d]).join(' & '));
  });
  return labels;
}

/**
 * Server render uses the server's date; the client re-renders with the
 * visitor's local date so phases flip at the visitor's midnight.
 */
function useTodayYmd(): string {
  const [today, setToday] = useState(() => todayYmd());
  useEffect(() => {
    setToday(todayYmd());
  }, []);
  return today;
}

export function LeagueProgramList({
  programs,
  config,
  events,
  linkTarget = '_blank',
  onOpenSchedule,
  trackRegisterClicks = true,
}: ILeagueProgramListProps) {
  const today = useTodayYmd();
  const matchupSessionIds = useMemo(() => getSessionIdsWithMatchups(events), [events]);
  const dayLabels = useMemo(() => buildSessionDayLabels(events), [events]);

  if (programs.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center" data-testid="league-empty">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <Search className="h-7 w-7 text-gray-400" />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-gray-900">No leagues found</h3>
          <p className="text-sm text-gray-600">Try adjusting your filters or search terms.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6" data-testid="league-program-list">
      <p className="mb-4 text-sm text-gray-600">
        Showing <span className="font-bold text-gray-900">{programs.length}</span>{' '}
        {programs.length === 1 ? 'league' : 'leagues'}
      </p>
      <div className="space-y-5">
        {programs.map((program) => (
          <LeagueProgramCard
            key={program.id}
            program={program}
            config={config}
            today={today}
            matchupSessionIds={matchupSessionIds}
            dayLabels={dayLabels}
            linkTarget={linkTarget}
            onOpenSchedule={onOpenSchedule}
            trackRegisterClicks={trackRegisterClicks}
          />
        ))}
      </div>
    </div>
  );
}

function LeagueProgramCard({
  program,
  config,
  today,
  matchupSessionIds,
  dayLabels,
  linkTarget,
  onOpenSchedule,
  trackRegisterClicks,
}: {
  program: Program;
  config: DiscoveryConfig;
  today: string;
  matchupSessionIds: Set<string>;
  dayLabels: Map<string, string>;
  linkTarget: LinkTarget;
  onOpenSchedule?: (programId: string, sessionId: string) => void;
  trackRegisterClicks: boolean;
}) {
  const primaryColor = config.branding.primaryColor || '#1E2761';
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  const seasons = sortSeasonsForLeagueCard(program.sessions || [], today);
  const ageRange = formatAgeRange(program.ageMin, program.ageMax);
  const genderLabel =
    program.gender && program.gender !== 'all' ? getGenderLabel(program.gender) : null;
  const imageUrl = program.imageUrl || program.mainMedia?.url;

  return (
    <article
      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
      data-testid="league-card"
    >
      <header className="flex gap-4 border-b border-gray-100 p-4 sm:p-5">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="hidden h-20 w-20 flex-shrink-0 rounded-xl object-cover sm:block"
          />
        ) : (
          <div
            className="hidden h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl text-white sm:flex"
            style={{ backgroundColor: primaryColor }}
            aria-hidden
          >
            <Trophy size={30} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {program.type && (
              <Pill>{getProgramTypeLabel(program.type)}</Pill>
            )}
            {program.sport && <Pill>{getSportLabel(program.sport)}</Pill>}
            {config.features.showAgeGender && ageRange && <Pill>{ageRange}</Pill>}
            {config.features.showAgeGender && genderLabel && <Pill>{genderLabel}</Pill>}
          </div>
          <h3 className="break-words text-lg font-bold text-gray-900 sm:text-xl">{program.name}</h3>
          {program.description && (
            <div className="mt-1.5">
              <ExpandableText
                clampClass="line-clamp-2"
                className="text-sm text-gray-600"
                accentColor={secondaryColor}
                moreLabel="Read more"
                lessLabel="Show less"
              >
                {program.description}
              </ExpandableText>
            </div>
          )}
        </div>
      </header>

      {seasons.length === 0 ? (
        <p className="p-4 text-sm text-gray-500 sm:px-5">No seasons scheduled yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {seasons.map((session) => (
            <LeagueSeasonRow
              key={session.id}
              program={program}
              session={session}
              config={config}
              phase={getSeasonPhase(session, today)}
              week={getSeasonWeek(session, today)}
              hasMatchups={matchupSessionIds.has(String(session.id))}
              dayLabel={dayLabels.get(String(session.id))}
              linkTarget={linkTarget}
              onOpenSchedule={onOpenSchedule}
              trackRegisterClicks={trackRegisterClicks}
            />
          ))}
        </ul>
      )}
    </article>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
      {children}
    </span>
  );
}

const PHASE_BADGE: Record<LeagueSeasonPhase, { label: string; className: string }> = {
  in_season: { label: 'In season', className: 'bg-green-100 text-green-800' },
  registering: { label: 'Registration open', className: 'bg-blue-100 text-blue-800' },
  upcoming: { label: 'Upcoming', className: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Final', className: 'bg-gray-100 text-gray-600' },
};

function formatShortDate(dateYmd: string | undefined): string | undefined {
  if (!dateYmd) return undefined;
  const d = new Date(`${dateYmd.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function LeagueSeasonRow({
  program,
  session,
  config,
  phase,
  week,
  hasMatchups,
  dayLabel,
  linkTarget,
  onOpenSchedule,
  trackRegisterClicks,
}: {
  program: Program;
  session: Session;
  config: DiscoveryConfig;
  phase: LeagueSeasonPhase;
  week?: { current: number; total: number };
  hasMatchups: boolean;
  dayLabel?: string;
  linkTarget: LinkTarget;
  onOpenSchedule?: (programId: string, sessionId: string) => void;
  trackRegisterClicks: boolean;
}) {
  const pathname = usePathname();
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  const features = config.features;

  const registrationOpen = isSeasonRegistrationOpen(session) && phase !== 'completed';
  const products = (session.products || []).filter((product) => !isCompedProduct(product));
  const singleProduct = products.length === 1 ? products[0] : null;
  const baseLink = session.linkSEO || program.linkSEO;
  const registrationUrl = registrationOpen
    ? features.customRegistrationUrl ||
      buildRegistrationUrl(baseLink, {
        productId: singleProduct?.id,
        isRegistrationOpen: true,
      })
    : undefined;
  const isWaitlist = Boolean(session.isFull && session.isWaitlistEnabled);
  const canRegister =
    Boolean(registrationUrl) && !features.hideRegistrationLinks && (!session.isFull || isWaitlist);

  const pricingEnabled = features.showSessionPricing ?? features.showPricing;
  const priceSettings = resolveSessionCardPriceSettings(features);
  const priceLabel =
    pricingEnabled && registrationOpen
      ? resolveSessionCardPriceLabel(
          products,
          // The legacy 'default' mode only prices single-product sessions;
          // league seasons usually sell team + free-agent options, so summarize.
          priceSettings.mode === 'default' ? 'min' : priceSettings.mode,
          priceSettings.excludeFree,
        )
      : undefined;

  const showCompetitionLinks = shouldShowLeagueLinks(phase, hasMatchups, features.leagueLinksMode);
  const standingsUrl = showCompetitionLinks
    ? getLeagueCompetitionUrl(baseLink, 'standings')
    : undefined;
  const scoresUrl = showCompetitionLinks ? getLeagueCompetitionUrl(baseLink, 'schedule') : undefined;
  const rostersUrl = getRostersUrlForSession(session.id, config);
  const scheduleTabEnabled = !features.enabledTabs || features.enabledTabs.includes('schedule');
  const showInPageSchedule = !scoresUrl && scheduleTabEnabled && phase !== 'completed';

  const badge = PHASE_BADGE[phase];
  const badgeLabel =
    phase === 'in_season' && week
      ? `Week ${week.current} of ${week.total}`
      : phase === 'upcoming' && session.registrationWindowStatus === 'not_opened_yet'
        ? session.registrationStartDate
          ? `Registration opens ${formatShortDate(session.registrationStartDate)}`
          : 'Registration opens soon'
        : badge.label;
  const regClosesLabel =
    registrationOpen && session.registrationEndDate
      ? `Register by ${formatShortDate(session.registrationEndDate)}`
      : undefined;

  const linkClass =
    'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50';
  const analyticsInput = {
    programId: String(program.id),
    programName: program.name,
    sessionId: String(session.id),
    sessionName: session.name,
    productId: singleProduct?.id,
  };

  return (
    <li
      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
      data-testid="league-season-row"
      data-phase={phase}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-words font-semibold text-gray-900">{session.name || 'Season'}</p>
          <span
            className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold', badge.className)}
            data-testid="league-season-badge"
          >
            {badgeLabel}
          </span>
          {isWaitlist && registrationOpen && (
            <span className="whitespace-nowrap rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
              Full · Waitlist open
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
          {(session.startDate || session.endDate) && (
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Calendar size={12} className="text-gray-400" />
              {formatDateRange(session.startDate || '', session.endDate || '')}
            </span>
          )}
          {dayLabel && (
            <span className="flex items-center gap-1 whitespace-nowrap">
              <CalendarDays size={12} className="text-gray-400" />
              {dayLabel}
            </span>
          )}
          {session.facility?.name && (
            <span className="flex items-center gap-1">
              <MapPin size={12} className="text-gray-400" />
              {session.facility.name}
            </span>
          )}
          {regClosesLabel && <span className="whitespace-nowrap">{regClosesLabel}</span>}
          {priceLabel && (
            <span className="whitespace-nowrap font-semibold text-gray-700">{priceLabel}</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0 sm:justify-end">
        {scoresUrl && (
          <a
            href={scoresUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-bond-passthrough="true"
            className={linkClass}
          >
            <CalendarDays size={13} />
            Schedule &amp; Scores
          </a>
        )}
        {standingsUrl && (
          <a
            href={standingsUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-bond-passthrough="true"
            className={linkClass}
          >
            <BarChart3 size={13} />
            Standings
          </a>
        )}
        {showInPageSchedule &&
          (onOpenSchedule ? (
            <button
              type="button"
              onClick={() => onOpenSchedule(String(program.id), String(session.id))}
              className={linkClass}
            >
              <CalendarDays size={13} />
              Schedule
            </button>
          ) : (
            <Link
              href={`${pathname}?viewMode=schedule&scheduleView=list&programIds=${program.id}&sessionIds=${session.id}`}
              className={linkClass}
            >
              <CalendarDays size={13} />
              Schedule
            </Link>
          ))}
        {rostersUrl && (
          <a href={rostersUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <Users size={13} />
            Teams
          </a>
        )}
        {canRegister && registrationUrl && (
          <a
            href={registrationUrl}
            target={linkTarget}
            rel="noopener noreferrer"
            {...getBondRegisterLinkAnalyticsAttributes(analyticsInput)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: secondaryColor }}
            onClick={
              trackRegisterClicks
                ? () => {
                    gtmEvent.clickRegister({
                      ...analyticsInput,
                      price:
                        singleProduct?.prices?.[0]?.price ?? singleProduct?.prices?.[0]?.amount,
                    });
                    bondAnalytics.clickRegister(config.slug, analyticsInput);
                  }
                : undefined
            }
          >
            {isWaitlist ? 'Join Waitlist' : 'Register'}
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </li>
  );
}
