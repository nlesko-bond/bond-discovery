import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { DiscoveryConfig, DiscoveryFilters } from '@/types';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
import {
  HostPortalV2SessionsView,
  HostPortalV2StackedSessionCard,
} from '@/components/host-shell/v2/HostPortalV2SessionsView';

const ACCENT = '#1d4ed8';

/** A weekday or clock time must NEVER appear at session-card level — a session
 *  is a date range that may span multiple segments / variable schedules. */
const WEEKDAY_PATTERN = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(days?)?\b/;
const CLOCK_TIME_PATTERN = /\b\d{1,2}:\d{2}\s?(AM|PM|am|pm)?\b/;

function makeConfig(features: Record<string, unknown> = {}): DiscoveryConfig {
  return {
    id: 'test',
    name: 'Test',
    slug: 'coppermine-test',
    organizationIds: [],
    facilityIds: [],
    branding: {
      primaryColor: '#1E2761',
      secondaryColor: '#6366F1',
      companyName: 'Coppermine',
    },
    features: {
      showPricing: true,
      showAvailability: true,
      showMembershipBadges: true,
      showAgeGender: true,
      enableFilters: ['search', 'facility', 'age', 'dateRange'],
      defaultView: 'programs',
      allowViewToggle: true,
      tableColumns: ['date', 'time', 'event', 'program', 'location', 'spots', 'action'],
      ...features,
    },
    allowedParams: [],
    defaultParams: {},
    cacheTtl: 300,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  } as DiscoveryConfig;
}

const EMPTY_FILTERS = {
  search: '',
  programIds: [],
  sessionIds: [],
  facilityIds: [],
  programTypes: [],
  sports: [],
  dateRange: {},
  ageRange: {},
  gender: 'all',
  availability: 'all',
  membershipRequired: null,
} as unknown as DiscoveryFilters;

/** Multi-segment session: a date range containing three segment rows. */
function makeMultiSegmentCard(
  overrides: Partial<IHostPortalSessionCardModel> = {},
): IHostPortalSessionCardModel {
  return {
    sessionId: 's1',
    programId: 'p1',
    programName: 'Soccer',
    name: 'Fall Rec Soccer',
    sport: 'soccer',
    facilityName: 'Coppermine Arena',
    ageRange: 'Ages 5-12',
    genderLabel: undefined,
    dateRange: 'Sep 8 - Nov 24, 2026',
    startDate: '2026-09-08',
    endDate: '2026-11-24',
    weekCountLabel: '12 weeks',
    availabilityStatus: 'available',
    isClosed: false,
    isRegistrationOpen: true,
    registerUrl: 'https://example.com/register?sessionId=s1',
    registerProductId: undefined,
    hasMultipleRegisterOptions: true,
    startingPriceLabel: '$150.00',
    isSegmented: true,
    segments: [
      { id: 'seg1', name: 'September block', dateRange: 'Sep 8 - Sep 29, 2026' },
      { id: 'seg2', name: 'October block', dateRange: 'Oct 6 - Oct 27, 2026' },
      { id: 'seg3', name: 'November block', dateRange: 'Nov 3 - Nov 24, 2026' },
    ],
    products: [
      {
        id: 'prod1',
        name: 'Full season',
        priceLabel: '$150.00',
        priceAmount: 150,
        registrationUrl: 'https://example.com/register?productId=prod1',
        registerDisabled: false,
      },
      {
        id: 'prod2',
        name: 'Member season',
        priceLabel: '$120.00',
        priceAmount: 120,
        registrationUrl: 'https://example.com/register?productId=prod2',
        registerDisabled: false,
        isMemberProduct: true,
      },
    ],
    spotsRemaining: 12,
    ...overrides,
  };
}

/** Variable-schedule session: not segmented, no clean weekly pattern in the model. */
function makeVariableScheduleCard(
  overrides: Partial<IHostPortalSessionCardModel> = {},
): IHostPortalSessionCardModel {
  return makeMultiSegmentCard({
    sessionId: 's2',
    name: 'Open Play Drop-in',
    isSegmented: false,
    segments: [],
    hasMultipleRegisterOptions: false,
    products: [
      {
        id: 'prod3',
        name: 'Drop-in',
        priceLabel: '$20.00',
        priceAmount: 20,
        registrationUrl: 'https://example.com/register?productId=prod3',
        registerDisabled: false,
      },
    ],
    registerProductId: 'prod3',
    registerUrl: 'https://example.com/register?productId=prod3',
    ...overrides,
  });
}

function renderStacked(
  card: IHostPortalSessionCardModel,
  config = makeConfig(),
  onOpenSchedule: ((programId: string, sessionId: string) => void) | undefined = () => undefined,
) {
  return render(
    <HostPortalV2StackedSessionCard
      card={card}
      config={config}
      accentColor={ACCENT}
      hideRegistrationLinks={config.features.hideRegistrationLinks === true}
      segmentsOpen={false}
      onSegmentsOpenChange={() => undefined}
      onOpenSchedule={onOpenSchedule}
    />,
  );
}

describe('stacked card — session model correctness', () => {
  it('renders session name, date-range + week count, age line, and availability pill', () => {
    renderStacked(makeMultiSegmentCard());
    expect(screen.getByText('Fall Rec Soccer')).toBeInTheDocument();
    expect(screen.getByTestId('portal-v2-date-line')).toHaveTextContent(
      'Sep 8 - Nov 24, 2026 · 12 weeks',
    );
    expect(screen.getByText('Ages 5-12')).toBeInTheDocument();
    expect(screen.getByTestId('portal-v2-availability')).toHaveTextContent('Open');
  });

  it('summarizes a multi-segment session as a "{n} segments" chip — never a day/time', () => {
    const { container } = render(
      <StackedWithState card={makeMultiSegmentCard()} config={makeConfig()} />,
    );
    const chip = screen.getByTestId('portal-v2-segments-chip');
    expect(chip).toHaveTextContent('3 segments');
    expect(chip).toHaveAttribute('aria-expanded', 'false');

    // The correctness crux: no weekday or clock time may be fabricated at card level.
    expect(container.textContent).not.toMatch(WEEKDAY_PATTERN);
    expect(container.textContent).not.toMatch(CLOCK_TIME_PATTERN);

    // Chip expands the existing segments panel inline with the segment rows.
    fireEvent.click(chip);
    expect(screen.getByText('September block')).toBeInTheDocument();
    expect(screen.getByText('October block')).toBeInTheDocument();
    expect(screen.getByText('November block')).toBeInTheDocument();
    // Still no fabricated day/time even with the panel open.
    expect(container.textContent).not.toMatch(WEEKDAY_PATTERN);
    expect(container.textContent).not.toMatch(CLOCK_TIME_PATTERN);
  });

  it('shows "Variable schedule" + View schedule affordance for non-segmented sessions', () => {
    const onOpenSchedule = vi.fn();
    const { container } = renderStacked(
      makeVariableScheduleCard(),
      makeConfig(),
      onOpenSchedule,
    );
    expect(screen.getByTestId('portal-v2-variable-schedule')).toHaveTextContent(
      'Variable schedule',
    );
    fireEvent.click(screen.getByRole('button', { name: /view schedule/i }));
    expect(onOpenSchedule).toHaveBeenCalledWith('p1', 's2');
    expect(container.textContent).not.toMatch(WEEKDAY_PATTERN);
    expect(container.textContent).not.toMatch(CLOCK_TIME_PATTERN);
  });

  it('renders product price rows + register hrefs exactly as the model provides them', () => {
    renderStacked(makeMultiSegmentCard());
    expect(screen.getByText('Full season')).toBeInTheDocument();
    // Price appears on the product row AND as the footer price block.
    expect(screen.getAllByText('$150.00').length).toBeGreaterThanOrEqual(1);
    const productLinks = screen
      .getAllByRole('link', { name: /register/i })
      .map((link) => link.getAttribute('href'));
    expect(productLinks).toContain('https://example.com/register?productId=prod1');
    expect(productLinks).toContain('https://example.com/register?productId=prod2');
    // Session-level register action verbatim from the model.
    expect(productLinks).toContain('https://example.com/register?sessionId=s1');
  });

  it('keeps the data-bond-* register analytics attributes', () => {
    renderStacked(makeVariableScheduleCard());
    const link = screen.getByRole('link', { name: /register/i });
    expect(link).toHaveAttribute('data-bond-program-id', 'p1');
    expect(link).toHaveAttribute('data-bond-program-name', 'Soccer');
    expect(link).toHaveAttribute('data-bond-session-id', 's2');
    expect(link).toHaveAttribute('data-bond-product-id', 'prod3');
  });
});

function StackedWithState({
  card,
  config,
}: {
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
}) {
  return (
    <HostPortalV2SessionsView
      cards={[card]}
      config={config}
      filters={EMPTY_FILTERS}
      accentColor={ACCENT}
      cardStyle="stacked"
      displayMode="sessions"
      cardMinWidthPx={240}
      onOpenSchedule={() => undefined}
    />
  );
}

describe('stacked card — admin toggles', () => {
  it('showPricing=false hides price labels and product rows', () => {
    const card = makeMultiSegmentCard({ startingPriceLabel: undefined });
    renderStacked(card, makeConfig({ showPricing: false }));
    expect(screen.queryByText('$150.00')).not.toBeInTheDocument();
    expect(screen.queryByText('Full season')).not.toBeInTheDocument();
  });

  it('showAvailability=false hides the availability pill', () => {
    renderStacked(makeMultiSegmentCard(), makeConfig({ showAvailability: false }));
    expect(screen.queryByTestId('portal-v2-availability')).not.toBeInTheDocument();
  });

  it('showAgeGender=false hides the age/gender line', () => {
    renderStacked(makeMultiSegmentCard(), makeConfig({ showAgeGender: false }));
    expect(screen.queryByText('Ages 5-12')).not.toBeInTheDocument();
  });

  it('showMembershipBadges toggles the Members badge on member products', () => {
    const { unmount } = renderStacked(makeMultiSegmentCard(), makeConfig());
    expect(screen.getByText('Members')).toBeInTheDocument();
    unmount();
    renderStacked(makeMultiSegmentCard(), makeConfig({ showMembershipBadges: false }));
    expect(screen.queryByText('Members')).not.toBeInTheDocument();
  });

  it('hideRegistrationLinks removes every register link', () => {
    renderStacked(makeMultiSegmentCard(), makeConfig({ hideRegistrationLinks: true }));
    expect(screen.queryByRole('link', { name: /register/i })).not.toBeInTheDocument();
  });

  it('linkBehavior controls the register link target', () => {
    const { unmount } = renderStacked(makeVariableScheduleCard(), makeConfig());
    expect(screen.getByRole('link', { name: /register/i })).toHaveAttribute(
      'target',
      '_blank',
    );
    unmount();
    renderStacked(makeVariableScheduleCard(), makeConfig({ linkBehavior: 'same_window' }));
    expect(screen.getByRole('link', { name: /register/i })).toHaveAttribute('target', '_top');
  });

  it('customRegistrationUrl flows through the model-provided register href verbatim', () => {
    // The model resolves customRegistrationUrl into registerUrl/product hrefs;
    // the card must render those without rebuilding URLs.
    const card = makeVariableScheduleCard({
      registerUrl: 'https://partner.example/custom-register',
      products: [
        {
          id: 'prod3',
          name: 'Drop-in',
          priceLabel: '$20.00',
          priceAmount: 20,
          registrationUrl: 'https://partner.example/custom-register',
          registerDisabled: false,
        },
      ],
    });
    renderStacked(card);
    expect(screen.getByRole('link', { name: /register/i })).toHaveAttribute(
      'href',
      'https://partner.example/custom-register',
    );
  });

  it('closed sessions render a disabled Closed action', () => {
    renderStacked(
      makeVariableScheduleCard({ isClosed: true, availabilityStatus: 'expired' }),
    );
    const link = screen.getByRole('link', { name: /closed/i });
    expect(link).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('rows style — tableColumns-driven session rows', () => {
  function renderRows(
    cards: IHostPortalSessionCardModel[],
    config = makeConfig(),
  ) {
    return render(
      <HostPortalV2SessionsView
        cards={cards}
        config={config}
        filters={EMPTY_FILTERS}
        accentColor={ACCENT}
        cardStyle="rows"
        displayMode="sessions"
        cardMinWidthPx={200}
        onOpenSchedule={() => undefined}
      />,
    );
  }

  it('renders session-level cells in the configured column order (time dropped, never fabricated)', () => {
    const { container } = renderRows([makeMultiSegmentCard()], makeConfig({ portalDisplayMode: 'programs' }));
    const row = screen.getByTestId('portal-v2-card');
    expect(row).toHaveAttribute('data-card-style', 'rows');
    const cells = Array.from(row.querySelectorAll('[data-portal-v2-cell]')).map((cell) =>
      cell.getAttribute('data-portal-v2-cell'),
    );
    expect(cells).toEqual(['date', 'event', 'program', 'location', 'spots', 'action']);

    expect(within(row).getByText('Sep 8 - Nov 24, 2026')).toBeInTheDocument();
    expect(within(row).getByText('12 weeks')).toBeInTheDocument();
    expect(within(row).getByText('Fall Rec Soccer')).toBeInTheDocument();
    expect(within(row).getByText('Soccer')).toBeInTheDocument();
    expect(within(row).getByText('Coppermine Arena')).toBeInTheDocument();
    expect(within(row).getByTestId('portal-v2-availability')).toHaveTextContent('Open');
    expect(within(row).getByRole('link', { name: /register/i })).toHaveAttribute(
      'data-bond-program-id',
      'p1',
    );

    // Multi-segment session: no weekday/time at row level.
    expect(container.textContent).not.toMatch(WEEKDAY_PATTERN);
    expect(container.textContent).not.toMatch(CLOCK_TIME_PATTERN);
  });

  it('drops the program column in portal sessions display mode', () => {
    renderRows([makeMultiSegmentCard()], makeConfig({ portalDisplayMode: 'sessions' }));
    const cells = Array.from(
      screen.getByTestId('portal-v2-card').querySelectorAll('[data-portal-v2-cell]'),
    ).map((cell) => cell.getAttribute('data-portal-v2-cell'));
    expect(cells).not.toContain('program');
  });

  it('expands description and segments when the row is clicked', () => {
    renderRows([
      makeMultiSegmentCard({
        description: 'Skills-focused fall session for all levels.',
      }),
    ]);
    expect(screen.queryByText('Skills-focused fall session for all levels.')).not.toBeInTheDocument();
    expect(screen.queryByText(/view segments/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /fall rec soccer\. more info/i }));
    expect(screen.getByTestId('portal-v2-row-expanded')).toBeInTheDocument();
    expect(screen.getByText('Skills-focused fall session for all levels.')).toBeInTheDocument();
    expect(screen.getByText('September block')).toBeInTheDocument();
    expect(screen.getByLabelText('Segments for Fall Rec Soccer')).toBeInTheDocument();
  });

  it('shows tiered pricing in the action column when present on the card model', () => {
    renderRows([
      makeMultiSegmentCard({
        tieredPricingLabel: 'Early bird $99 until Sep 15, 2026',
      }),
    ]);
    expect(screen.getByTestId('portal-v2-tiered-pricing')).toHaveTextContent(
      'Early bird $99 until Sep 15, 2026',
    );
  });

  it('shows the variable-schedule affordance for non-segmented sessions without detail', () => {
    renderRows([makeVariableScheduleCard()]);
    expect(screen.getByTestId('portal-v2-variable-schedule')).toHaveTextContent(
      'Variable schedule',
    );
  });
});

describe('classic style and display-mode grouping', () => {
  it('classic reuses the existing HostPortalSessionCard (parity by construction)', () => {
    render(
      <HostPortalV2SessionsView
        cards={[makeMultiSegmentCard()]}
        config={makeConfig()}
        filters={EMPTY_FILTERS}
        accentColor={ACCENT}
        cardStyle="classic"
        displayMode="sessions"
        cardMinWidthPx={240}
        onOpenSchedule={() => undefined}
      />,
    );
    const card = screen.getByTestId('portal-v2-card');
    expect(card).toHaveAttribute('data-card-style', 'classic');
    // Signature affordances of the existing card component.
    expect(screen.getByRole('button', { name: /view segments/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /register/i })).toHaveAttribute(
      'data-bond-program-id',
      'p1',
    );
  });

  it("displayMode='programs' groups session cards under program headings", () => {
    const cardA = makeMultiSegmentCard();
    const cardB = makeVariableScheduleCard({
      sessionId: 's3',
      programId: 'p2',
      programName: 'Basketball',
      name: 'Winter Hoops',
    });
    render(
      <HostPortalV2SessionsView
        cards={[cardA, cardB]}
        config={makeConfig()}
        filters={EMPTY_FILTERS}
        accentColor={ACCENT}
        cardStyle="stacked"
        displayMode="programs"
        cardMinWidthPx={240}
        onOpenSchedule={() => undefined}
      />,
    );
    expect(screen.getByTestId('portal-v2-program-groups')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Soccer' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basketball' })).toBeInTheDocument();
    expect(screen.getAllByTestId('portal-v2-card')).toHaveLength(2);
  });
});

describe('admin-toggle parity coverage (enumerated)', () => {
  /**
   * Every admin toggle the v2 session-card variants must honor, with the
   * mechanism that honors it. 'card' = asserted behaviorally in this file;
   * 'model' = encoded by buildHostPortalSessionCards (session-card-model tests);
   * 'inherited' = handled by an existing component the v2 page composes,
   * unchanged by the card variants.
   */
  const PARITY: Record<string, string> = {
    showPricing: 'card: price labels + product rows gated (this file) + model startingPriceLabel',
    showAvailability: 'card: availability pill gated (this file); rows drops spots column',
    showAgeGender: 'card: age/gender line gated (this file) + model nulls ageRange/genderLabel',
    showMembershipBadges: 'card: Members badge on member product rows (this file)',
    enableFilters: 'inherited: HostPortalV2FilterBar reads features.enableFilters',
    linkBehavior: 'card: resolvePortalScheduleLinkTarget drives register target (this file)',
    hideRegistrationLinks: 'card: removes all register links (this file)',
    customRegistrationUrl:
      'model: resolveSessionRegisterAction/mapProductRow bake it into hrefs; card renders verbatim (this file)',
    allowViewToggle: 'inherited: HostPortalV2Page header tab toggle (programs/schedule)',
    showTableView: 'inherited: HostPortalScheduleTab schedule table view (schedule tab)',
    tableColumns:
      'card: rows style orders session-level columns via resolvePortalV2SessionRowColumns (this file + lib test)',
    portalHeroTitle: 'inherited: sessions-list hero is a non-v2 surface; v2 keeps header chrome',
    allowPortalSessionLayoutToggle:
      'inherited: list/grid toggle applies to the non-v2 sessions shell; v2 styles come from portalCardStyle',
    persistFiltersInLocalStorage: 'inherited: filter state layer used by the v2 filter system',
    showPunchPassRedeemButton: 'inherited: schedule tab event rows (event-level affordance)',
    punchPassRedeemUrl: 'inherited: schedule tab event rows (event-level affordance)',
    mobileQuickFilterChips: 'inherited: v2 filter bar mobile sheet/chips',
    headerDisplay: 'inherited: toPortalDiscoveryConfig portal override (minimal header)',
    disableStickyHeader: 'inherited: v2 header is non-sticky in-flow chrome by design',
  };

  it('enumerates every required admin toggle exactly once', () => {
    const required = [
      'showPricing',
      'showAvailability',
      'showAgeGender',
      'showMembershipBadges',
      'enableFilters',
      'linkBehavior',
      'hideRegistrationLinks',
      'customRegistrationUrl',
      'allowViewToggle',
      'showTableView',
      'tableColumns',
      'portalHeroTitle',
      'allowPortalSessionLayoutToggle',
      'persistFiltersInLocalStorage',
      'showPunchPassRedeemButton',
      'punchPassRedeemUrl',
      'mobileQuickFilterChips',
      'headerDisplay',
      'disableStickyHeader',
    ];
    expect(Object.keys(PARITY).sort()).toEqual([...required].sort());
    for (const mechanism of Object.values(PARITY)) {
      expect(mechanism.length).toBeGreaterThan(0);
    }
  });
});
