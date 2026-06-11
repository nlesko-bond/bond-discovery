'use client';

import { useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, Clock, ExternalLink } from 'lucide-react';
import type { DiscoveryConfig, DiscoveryFilters, PortalCardStyle } from '@/types';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
import {
  resolvePortalV2SessionRowColumns,
  resolveV2Availability,
  type PortalV2SessionRowColumn,
} from '@/lib/host-shell/portal-v2';
import { buildPortalCardAccentContext } from '@/lib/host-shell/portal-card-accent';
import { cn } from '@/lib/utils';
import { gtmEvent } from '@/components/analytics/GoogleTagManager';
import { bondAnalytics } from '@/lib/analytics';
import { getBondRegisterLinkAnalyticsAttributes } from '@/lib/host-shell/registration-analytics';
import { resolvePortalScheduleLinkTarget } from '@/lib/host-shell/portal-schedule-events';
import { HostPortalSessionCard } from '../HostPortalSessionCard';
import { HostPortalSessionSegmentsPanel } from '../HostPortalSessionSegmentsPanel';

const CLOSED_REGISTER_BACKGROUND = '#9CA3AF';

const AVAILABILITY_PILL_STYLES: Record<string, { background: string; color: string }> = {
  open: { background: '#dcfce7', color: '#166534' },
  almost_full: { background: '#fef3c7', color: '#92400e' },
  full: { background: '#f3f4f6', color: '#4b5563' },
  closed: { background: '#f3f4f6', color: '#4b5563' },
};

const ROW_COLUMN_LABELS: Record<PortalV2SessionRowColumn, string> = {
  date: 'Dates',
  event: 'Session',
  program: 'Program',
  location: 'Location',
  spots: 'Availability',
  action: '',
};

interface ITrackedSession {
  programId: string;
  programName: string;
  sessionId: string;
  name: string;
  isClosed: boolean;
}

function trackRegisterClick(
  config: DiscoveryConfig,
  card: ITrackedSession,
  productId?: string,
): void {
  if (card.isClosed) {
    return;
  }
  // Embedded clicks are tracked by HostShellPortalBridge → trackHostShellRegisterClick.
  if (typeof window !== 'undefined' && window.self !== window.top) {
    return;
  }
  gtmEvent.clickRegister({
    programId: card.programId,
    programName: card.programName,
    sessionId: card.sessionId,
    sessionName: card.name,
    productId,
  });
  bondAnalytics.clickRegister(config.slug, {
    programId: card.programId,
    programName: card.programName,
    sessionId: card.sessionId,
    sessionName: card.name,
    productId,
  });
}

/** "Sep 8 – Nov 24, 2026 · 12 weeks" — session-level date span, never a fabricated day/time. */
function buildDateLine(card: IHostPortalSessionCardModel): string | undefined {
  const parts = [card.dateRange, card.weekCountLabel].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function buildAgeGenderLine(card: IHostPortalSessionCardModel): string | undefined {
  const parts = [card.ageRange, card.genderLabel].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function hasSegmentDetail(card: IHostPortalSessionCardModel): boolean {
  return card.isSegmented || card.segments.length > 0;
}

function segmentsChipLabel(card: IHostPortalSessionCardModel): string {
  if (card.segments.length > 0) {
    return card.segments.length === 1 ? '1 segment' : `${card.segments.length} segments`;
  }
  // isSegmented without inline segment rows — the panel lazy-loads them.
  return 'View segments';
}

interface IScheduleAffordanceProps {
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
  onOpenSchedule?: (programId: string, sessionId: string) => void;
  compact?: boolean;
}

/**
 * Sessions with no segment breakdown have no single weekly timeslot we can
 * honestly print — schedule detail lives on the schedule tab. Shows
 * "Variable schedule" + the View schedule affordance instead.
 */
function VariableScheduleLine({
  card,
  config,
  onOpenSchedule,
  compact = false,
}: IScheduleAffordanceProps) {
  const showScheduleTab = (config.features.enabledTabs || ['programs', 'schedule']).includes(
    'schedule',
  );
  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', compact && 'gap-1.5')}
      data-testid="portal-v2-variable-schedule"
    >
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <Calendar size={12} className="shrink-0 text-gray-400" aria-hidden />
        Variable schedule
      </span>
      {showScheduleTab && onOpenSchedule && (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 underline-offset-2 hover:underline"
          onClick={() => onOpenSchedule(card.programId, card.sessionId)}
        >
          <Clock size={12} aria-hidden />
          View schedule
        </button>
      )}
    </div>
  );
}

interface ISegmentsToggleProps {
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** "{n} segments" chip expanding the existing segments panel inline. */
function SegmentsChip({ card, config, open, onOpenChange }: ISegmentsToggleProps) {
  return (
    <div>
      <button
        type="button"
        data-testid="portal-v2-segments-chip"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
          open
            ? 'border-gray-300 bg-gray-100 text-gray-900'
            : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100',
        )}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        {segmentsChipLabel(card)}
        {open ? (
          <ChevronUp size={13} className="shrink-0 text-gray-500" aria-hidden />
        ) : (
          <ChevronDown size={13} className="shrink-0 text-gray-500" aria-hidden />
        )}
      </button>
      {open && (
        <HostPortalSessionSegmentsPanel card={card} config={config} variant="inline" />
      )}
    </div>
  );
}

interface IStackedCardProps {
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
  accentColor: string;
  hideRegistrationLinks: boolean;
  segmentsOpen: boolean;
  onSegmentsOpenChange: (open: boolean) => void;
  onOpenSchedule?: (programId: string, sessionId: string) => void;
}

/**
 * 'stacked' card style. A card is a SESSION (a date range possibly spanning
 * multiple segments) — schedule detail renders only via segment rows or the
 * schedule tab, never as a fabricated weekly timeslot.
 */
export function HostPortalV2StackedSessionCard({
  card,
  config,
  accentColor,
  hideRegistrationLinks,
  segmentsOpen,
  onSegmentsOpenChange,
  onOpenSchedule,
}: IStackedCardProps) {
  const showPricing = config.features.showPricing !== false;
  const showAvailability = config.features.showAvailability !== false;
  const showAgeGender = config.features.showAgeGender !== false;
  const showMembershipBadges = config.features.showMembershipBadges !== false;
  const linkTarget = resolvePortalScheduleLinkTarget(config);
  const linkRel = linkTarget === '_blank' ? 'noopener noreferrer' : undefined;

  const availability = resolveV2Availability(card);
  const pillStyle = AVAILABILITY_PILL_STYLES[availability.kind];
  const dateLine = buildDateLine(card);
  const ageGenderLine = showAgeGender ? buildAgeGenderLine(card) : undefined;
  const showProductRows = showPricing && card.hasMultipleRegisterOptions && card.products.length > 1;

  const collapsedPriceLabel =
    showPricing && card.startingPriceLabel
      ? card.hasMultipleRegisterOptions
        ? `From ${card.startingPriceLabel}`
        : (card.products[0]?.priceLabel ?? card.startingPriceLabel)
      : undefined;

  const registerAnalyticsAttributes = getBondRegisterLinkAnalyticsAttributes({
    programId: card.programId,
    programName: card.programName,
    sessionId: card.sessionId,
    sessionName: card.name,
    productId: card.registerProductId,
  });

  return (
    <article
      data-testid="portal-v2-card"
      data-card-style="stacked"
      className="flex h-full flex-col rounded-xl bg-white p-4 ring-1 ring-gray-200 transition-shadow duration-200 hover:shadow-md"
    >
      <p className="truncate text-xs text-gray-500" title={card.programName}>
        {card.programName}
      </p>
      <div className="mt-1 flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-medium leading-snug text-gray-900">
          {card.name || card.programName}
        </h3>
        {showAvailability && (
          <span
            data-testid="portal-v2-availability"
            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: pillStyle.background, color: pillStyle.color }}
          >
            {availability.label}
          </span>
        )}
      </div>

      {dateLine && (
        <p className="mt-1.5 text-xs leading-relaxed text-gray-600" data-testid="portal-v2-date-line">
          {dateLine}
        </p>
      )}
      {ageGenderLine && (
        <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{ageGenderLine}</p>
      )}

      <div className="mt-2.5">
        {hasSegmentDetail(card) ? (
          <SegmentsChip
            card={card}
            config={config}
            open={segmentsOpen}
            onOpenChange={onSegmentsOpenChange}
          />
        ) : (
          <VariableScheduleLine card={card} config={config} onOpenSchedule={onOpenSchedule} />
        )}
      </div>

      {showProductRows && (
        <ul className="mt-3 space-y-1.5 border-t border-gray-100 pt-3 text-xs">
          {card.products.map((product) => (
            <li key={product.id} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-gray-700">{product.name}</span>
                {showMembershipBadges && product.isMemberProduct && (
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
                  >
                    Members
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {product.priceLabel && (
                  <span className="font-medium tabular-nums text-gray-900">
                    {product.priceLabel}
                  </span>
                )}
                {!hideRegistrationLinks && product.registrationUrl && (
                  <a
                    href={product.registrationUrl}
                    target={linkTarget}
                    rel={linkRel}
                    {...getBondRegisterLinkAnalyticsAttributes({
                      programId: card.programId,
                      programName: card.programName,
                      sessionId: card.sessionId,
                      sessionName: card.name,
                      productId: product.id,
                    })}
                    className={cn(
                      'rounded-md px-2 py-1 text-[11px] font-medium text-white',
                      product.registerDisabled &&
                        'pointer-events-none cursor-not-allowed opacity-60',
                    )}
                    style={{
                      backgroundColor: product.registerDisabled
                        ? CLOSED_REGISTER_BACKGROUND
                        : accentColor,
                    }}
                    aria-disabled={product.registerDisabled}
                    onClick={() => {
                      if (product.registerDisabled) {
                        return;
                      }
                      trackRegisterClick(config, card, product.id);
                    }}
                  >
                    {product.registerDisabled ? 'Closed' : 'Register'}
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-3">
        {collapsedPriceLabel ? (
          <p className="text-[15px] font-semibold tabular-nums text-gray-900">
            {collapsedPriceLabel}
          </p>
        ) : (
          <span />
        )}
        {!hideRegistrationLinks && card.registerUrl && (
          <a
            href={card.registerUrl}
            target={linkTarget}
            rel={linkRel}
            {...registerAnalyticsAttributes}
            className={cn(
              'inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90',
              card.isClosed && 'pointer-events-none cursor-not-allowed opacity-60',
            )}
            style={{
              backgroundColor: card.isClosed ? CLOSED_REGISTER_BACKGROUND : accentColor,
            }}
            aria-disabled={card.isClosed}
            onClick={() => trackRegisterClick(config, card, card.registerProductId)}
          >
            {card.isClosed ? 'Closed' : 'Register'}
            <ExternalLink size={13} aria-hidden />
          </a>
        )}
      </div>
    </article>
  );
}

interface ISessionRowProps {
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
  columns: PortalV2SessionRowColumn[];
  accentColor: string;
  hideRegistrationLinks: boolean;
  segmentsOpen: boolean;
  onSegmentsOpenChange: (open: boolean) => void;
  onOpenSchedule?: (programId: string, sessionId: string) => void;
}

function rowGridTemplate(columns: PortalV2SessionRowColumn[]): string {
  return columns
    .map((column) => {
      if (column === 'event') return 'minmax(0, 2fr)';
      if (column === 'action') return 'auto';
      return 'minmax(0, 1fr)';
    })
    .join(' ');
}

function HostPortalV2SessionRow({
  card,
  config,
  columns,
  accentColor,
  hideRegistrationLinks,
  segmentsOpen,
  onSegmentsOpenChange,
  onOpenSchedule,
}: ISessionRowProps) {
  const showPricing = config.features.showPricing !== false;
  const showAgeGender = config.features.showAgeGender !== false;
  const linkTarget = resolvePortalScheduleLinkTarget(config);
  const linkRel = linkTarget === '_blank' ? 'noopener noreferrer' : undefined;
  const availability = resolveV2Availability(card);
  const pillStyle = AVAILABILITY_PILL_STYLES[availability.kind];
  const ageGenderLine = showAgeGender ? buildAgeGenderLine(card) : undefined;

  const collapsedPriceLabel =
    showPricing && card.startingPriceLabel
      ? card.hasMultipleRegisterOptions
        ? `From ${card.startingPriceLabel}`
        : (card.products[0]?.priceLabel ?? card.startingPriceLabel)
      : undefined;

  const registerAnalyticsAttributes = getBondRegisterLinkAnalyticsAttributes({
    programId: card.programId,
    programName: card.programName,
    sessionId: card.sessionId,
    sessionName: card.name,
    productId: card.registerProductId,
  });

  const renderCell = (column: PortalV2SessionRowColumn) => {
    switch (column) {
      case 'date':
        // Session-level date span only — a session has no single weekly timeslot.
        return (
          <div data-portal-v2-cell="date">
            <p className="text-sm text-gray-700">{card.dateRange || '—'}</p>
            {card.weekCountLabel && (
              <p className="text-xs text-gray-500">{card.weekCountLabel}</p>
            )}
          </div>
        );
      case 'event':
        return (
          <div data-portal-v2-cell="event" className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">
              {card.name || card.programName}
            </p>
            {ageGenderLine && <p className="text-xs text-gray-500">{ageGenderLine}</p>}
            <div className="mt-1">
              {hasSegmentDetail(card) ? (
                <button
                  type="button"
                  data-testid="portal-v2-segments-chip"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 underline-offset-2 hover:underline"
                  aria-expanded={segmentsOpen}
                  onClick={() => onSegmentsOpenChange(!segmentsOpen)}
                >
                  {segmentsChipLabel(card)}
                  {segmentsOpen ? (
                    <ChevronUp size={12} aria-hidden />
                  ) : (
                    <ChevronDown size={12} aria-hidden />
                  )}
                </button>
              ) : (
                <VariableScheduleLine
                  card={card}
                  config={config}
                  onOpenSchedule={onOpenSchedule}
                  compact
                />
              )}
            </div>
          </div>
        );
      case 'program':
        return (
          <p data-portal-v2-cell="program" className="truncate text-sm text-gray-600">
            {card.programName}
          </p>
        );
      case 'location':
        return (
          <p data-portal-v2-cell="location" className="truncate text-sm text-gray-600">
            {card.facilityName || '—'}
          </p>
        );
      case 'spots':
        return (
          <span
            data-portal-v2-cell="spots"
            data-testid="portal-v2-availability"
            className="inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: pillStyle.background, color: pillStyle.color }}
          >
            {availability.label}
          </span>
        );
      case 'action':
        return (
          <div data-portal-v2-cell="action" className="flex items-center justify-end gap-3">
            {collapsedPriceLabel && (
              <span className="text-sm font-semibold tabular-nums text-gray-900">
                {collapsedPriceLabel}
              </span>
            )}
            {!hideRegistrationLinks && card.registerUrl && (
              <a
                href={card.registerUrl}
                target={linkTarget}
                rel={linkRel}
                {...registerAnalyticsAttributes}
                className={cn(
                  'inline-flex min-h-[36px] items-center justify-center rounded-lg px-3.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90',
                  card.isClosed && 'pointer-events-none cursor-not-allowed opacity-60',
                )}
                style={{
                  backgroundColor: card.isClosed ? CLOSED_REGISTER_BACKGROUND : accentColor,
                }}
                aria-disabled={card.isClosed}
                onClick={() => trackRegisterClick(config, card, card.registerProductId)}
              >
                {card.isClosed ? 'Closed' : 'Register'}
              </a>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      data-testid="portal-v2-card"
      data-card-style="rows"
      className="rounded-lg bg-white px-3 py-2.5 ring-1 ring-gray-200 sm:px-4"
    >
      <div
        className="flex flex-col gap-2 sm:grid sm:items-center sm:gap-3 sm:[grid-template-columns:var(--v2-row-cols)]"
        style={{ '--v2-row-cols': rowGridTemplate(columns) } as React.CSSProperties}
      >
        {columns.map((column) => (
          <div key={column}>{renderCell(column)}</div>
        ))}
      </div>
      {segmentsOpen && hasSegmentDetail(card) && (
        <HostPortalSessionSegmentsPanel card={card} config={config} variant="inline" />
      )}
    </div>
  );
}

interface ISessionRowsListProps {
  cards: IHostPortalSessionCardModel[];
  config: DiscoveryConfig;
  accentColor: string;
  hideRegistrationLinks: boolean;
  segmentsOpenSessionId: string | null;
  onSegmentsOpenChange: (sessionId: string, open: boolean) => void;
  onOpenSchedule?: (programId: string, sessionId: string) => void;
}

/** 'rows' card style — dense row per session honoring the page's tableColumns ordering. */
export function HostPortalV2SessionRowsList({
  cards,
  config,
  accentColor,
  hideRegistrationLinks,
  segmentsOpenSessionId,
  onSegmentsOpenChange,
  onOpenSchedule,
}: ISessionRowsListProps) {
  const columns = resolvePortalV2SessionRowColumns(config);

  return (
    <div className="space-y-2" data-testid="portal-v2-rows">
      <div
        className="hidden px-4 sm:grid sm:gap-3 sm:[grid-template-columns:var(--v2-row-cols)]"
        style={{ '--v2-row-cols': rowGridTemplate(columns) } as React.CSSProperties}
        aria-hidden
      >
        {columns.map((column) => (
          <span
            key={column}
            className="text-[11px] font-semibold uppercase tracking-wide text-gray-400"
          >
            {ROW_COLUMN_LABELS[column]}
          </span>
        ))}
      </div>
      {cards.map((card) => (
        <HostPortalV2SessionRow
          key={card.sessionId}
          card={card}
          config={config}
          columns={columns}
          accentColor={accentColor}
          hideRegistrationLinks={hideRegistrationLinks}
          segmentsOpen={segmentsOpenSessionId === card.sessionId}
          onSegmentsOpenChange={(open) => onSegmentsOpenChange(card.sessionId, open)}
          onOpenSchedule={onOpenSchedule}
        />
      ))}
    </div>
  );
}

interface IProgramGroup {
  programId: string;
  programName: string;
  cards: IHostPortalSessionCardModel[];
}

function groupCardsByProgram(cards: IHostPortalSessionCardModel[]): IProgramGroup[] {
  const groups: IProgramGroup[] = [];
  const byProgramId = new Map<string, IProgramGroup>();
  for (const card of cards) {
    let group = byProgramId.get(card.programId);
    if (!group) {
      group = { programId: card.programId, programName: card.programName, cards: [] };
      byProgramId.set(card.programId, group);
      groups.push(group);
    }
    group.cards.push(card);
  }
  return groups;
}

interface IHostPortalV2SessionsViewProps {
  cards: IHostPortalSessionCardModel[];
  config: DiscoveryConfig;
  filters: DiscoveryFilters;
  accentColor: string;
  cardStyle: PortalCardStyle;
  displayMode: 'programs' | 'sessions';
  cardMinWidthPx: number;
  onOpenSchedule?: (programId: string, sessionId: string) => void;
}

/**
 * v2 sessions surface: SESSION cards in the operator-selected style
 * ('classic' reuses the existing HostPortalSessionCard; 'stacked' and 'rows'
 * are built on the same IHostPortalSessionCardModel). 'programs' display mode
 * groups the same cards under program headings (programs → sessions → segments).
 */
export function HostPortalV2SessionsView({
  cards,
  config,
  filters,
  accentColor,
  cardStyle,
  displayMode,
  cardMinWidthPx,
  onOpenSchedule,
}: IHostPortalV2SessionsViewProps) {
  const [segmentsOpenSessionId, setSegmentsOpenSessionId] = useState<string | null>(null);
  const hideRegistrationLinks = config.features.hideRegistrationLinks === true;
  const accentContext = useMemo(
    () => buildPortalCardAccentContext(config, cards, filters),
    [config, cards, filters],
  );

  const handleSegmentsOpenChange = (sessionId: string, open: boolean) => {
    setSegmentsOpenSessionId(open ? sessionId : null);
  };

  const renderCardsGrid = (groupCards: IHostPortalSessionCardModel[]) => {
    if (cardStyle === 'rows') {
      return (
        <HostPortalV2SessionRowsList
          cards={groupCards}
          config={config}
          accentColor={accentColor}
          hideRegistrationLinks={hideRegistrationLinks}
          segmentsOpenSessionId={segmentsOpenSessionId}
          onSegmentsOpenChange={handleSegmentsOpenChange}
          onOpenSchedule={onOpenSchedule}
        />
      );
    }
    if (cardStyle === 'stacked') {
      return (
        <div
          className="grid grid-cols-1 gap-3 sm:gap-4 sm:[grid-template-columns:var(--v2-grid-cols)]"
          style={
            {
              '--v2-grid-cols': `repeat(auto-fill, minmax(min(100%, ${cardMinWidthPx}px), 1fr))`,
            } as React.CSSProperties
          }
        >
          {groupCards.map((card) => (
            <HostPortalV2StackedSessionCard
              key={card.sessionId}
              card={card}
              config={config}
              accentColor={accentColor}
              hideRegistrationLinks={hideRegistrationLinks}
              segmentsOpen={segmentsOpenSessionId === card.sessionId}
              onSegmentsOpenChange={(open) => handleSegmentsOpenChange(card.sessionId, open)}
              onOpenSchedule={onOpenSchedule}
            />
          ))}
        </div>
      );
    }
    // 'classic': the existing session card, reused (full feature parity by
    // construction); wrapped so v2 tooling/tests can target cards uniformly.
    return (
      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
        {groupCards.map((card) => (
          <div key={card.sessionId} data-testid="portal-v2-card" data-card-style="classic" className="h-full">
            <HostPortalSessionCard
              card={card}
              config={config}
              accentContext={accentContext}
              hideRegistrationLinks={hideRegistrationLinks}
              segmentsOpen={segmentsOpenSessionId === card.sessionId}
              onSegmentsOpenChange={(open) => handleSegmentsOpenChange(card.sessionId, open)}
              onOpenSchedule={onOpenSchedule}
            />
          </div>
        ))}
      </div>
    );
  };

  if (displayMode === 'programs') {
    const groups = groupCardsByProgram(cards);
    return (
      <div className="space-y-8 py-4 md:py-6" data-testid="portal-v2-program-groups">
        {groups.map((group) => (
          <section key={group.programId} aria-label={group.programName}>
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-base font-semibold text-gray-900">{group.programName}</h2>
              <span className="text-xs text-gray-500">
                {group.cards.length === 1 ? '1 session' : `${group.cards.length} sessions`}
              </span>
            </div>
            {renderCardsGrid(group.cards)}
          </section>
        ))}
      </div>
    );
  }

  return <div className="py-4 md:py-6">{renderCardsGrid(cards)}</div>;
}
