/**
 * Pure rules for which schedule view to show from URL + viewport + org admin defaults.
 *
 * Narrow + scheduleView=table + !allowTableOnMobile → use mobile default path (not URL table).
 * Wide + scheduleView=table → table (desktop honors the link).
 */

/**
 * Viewports at most this many CSS pixels wide use “mobile” schedule rules
 * (mobile default view, `scheduleView=table` gating unless admin allows table on mobile).
 * Uses 767 so “wide” starts at 768px — same as Tailwind `md` and common tablet portrait widths.
 */
export const SCHEDULE_VIEW_MOBILE_MAX_WIDTH_PX = 767;

export const SCHEDULE_VIEW_NARROW_MEDIA_QUERY = `(max-width: ${SCHEDULE_VIEW_MOBILE_MAX_WIDTH_PX}px)`;

export function isNarrowScheduleViewport(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') {
    return (
      window.innerWidth > 0 &&
      window.innerWidth <= SCHEDULE_VIEW_MOBILE_MAX_WIDTH_PX
    );
  }
  return window.matchMedia(SCHEDULE_VIEW_NARROW_MEDIA_QUERY).matches;
}

/** Accepts FeatureConfig or any partial; snake_case may appear on raw DB JSON. */
export function readAllowTableOnMobileFromFeatures(features: {
  allowTableViewOnMobile?: boolean;
  allow_table_view_on_mobile?: boolean;
}): boolean {
  return (
    features.allowTableViewOnMobile === true ||
    features.allow_table_view_on_mobile === true
  );
}

export type ScheduleViewResolutionMode =
  | 'list'
  | 'table'
  | 'day'
  | 'week'
  | 'month';

export const VALID_SCHEDULE_VIEW_MODES: ScheduleViewResolutionMode[] = [
  'list',
  'table',
  'day',
  'week',
  'month',
];

export type ScheduleViewResolutionOptions = {
  allowTableOnMobile: boolean;
  desktopDefaultView: ScheduleViewResolutionMode;
  mobileDefaultRaw: ScheduleViewResolutionMode | undefined;
};

export function resolveScheduleViewMode(
  urlParam: string | null,
  narrow: boolean,
  opts: ScheduleViewResolutionOptions,
): ScheduleViewResolutionMode {
  const { allowTableOnMobile, desktopDefaultView, mobileDefaultRaw } = opts;

  const paramOk =
    !!urlParam && VALID_SCHEDULE_VIEW_MODES.includes(urlParam as ScheduleViewResolutionMode);
  const requested = urlParam as ScheduleViewResolutionMode | null;

  const effectiveMobileDefault = (): ScheduleViewResolutionMode => {
    if (
      mobileDefaultRaw &&
      VALID_SCHEDULE_VIEW_MODES.includes(mobileDefaultRaw)
    ) {
      return mobileDefaultRaw;
    }
    return desktopDefaultView;
  };

  /** On narrow viewports, table is only allowed when admin enables it. */
  const stripDisallowedTable = (v: ScheduleViewResolutionMode): ScheduleViewResolutionMode => {
    if (v === 'table' && narrow && !allowTableOnMobile) {
      if (
        mobileDefaultRaw &&
        VALID_SCHEDULE_VIEW_MODES.includes(mobileDefaultRaw) &&
        mobileDefaultRaw !== 'table'
      ) {
        return mobileDefaultRaw;
      }
      if (desktopDefaultView !== 'table') {
        return desktopDefaultView;
      }
      return 'list';
    }
    return v;
  };

  const autoDefault = (): ScheduleViewResolutionMode => {
    if (!narrow) {
      return stripDisallowedTable(desktopDefaultView);
    }
    return stripDisallowedTable(effectiveMobileDefault());
  };

  if (!paramOk) {
    return autoDefault();
  }

  // Explicit table in URL: desktop honors it; mobile only if allowed, else mobile default path.
  if (requested === 'table' && narrow) {
    if (allowTableOnMobile) return 'table';
    return autoDefault();
  }

  return stripDisallowedTable(requested!);
}

/**
 * When narrow + URL asks for table but org disallows, we keep `scheduleView=table` in the query
 * so widening the viewport can restore table; the UI still shows `resolvedView`.
 */
export function shouldRewriteScheduleViewParam(
  urlParam: string | null,
  narrow: boolean,
  allowTableOnMobile: boolean,
  resolvedView: ScheduleViewResolutionMode,
): boolean {
  if (urlParam === 'table' && narrow && !allowTableOnMobile && resolvedView !== 'table') {
    return false;
  }
  return true;
}
