import type { DiscoveryConfig, DiscoveryFilters } from '@/types';
import { PortalAccentSourceEnum } from '@/types';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
import {
  resolvePortalAccentSource,
  resolvePortalVisualTheme,
} from '@/lib/host-shell/portal-accent-theme';
import { shiftHexHue } from '@/lib/host-shell/portal-color-utils';
import {
  getSportVisualTheme,
  normalizeSportKey,
  type ISportVisualTheme,
} from '@/lib/host-shell/sport-visuals';

export enum PortalCardAccentModeEnum {
  SPORT = 'sport',
  FACILITY = 'facility',
}

export interface IPortalCardAccentContext {
  mode: PortalCardAccentModeEnum;
  anchorSportId?: string;
  getCardVisualTheme: (card: IHostPortalSessionCardModel) => ISportVisualTheme;
}

const FACILITY_HUE_WAVE_SHIFTS_DEG = [0, 32, -28, 48, -18, 22, -38, 14] as const;
const FACILITY_GRADIENT_TO_HUE_RATIO = 0.65;
const FACILITY_ICON_BACKGROUND_HUE_RATIO = 0.25;

function resolveCardFacilityKey(card: IHostPortalSessionCardModel): string {
  if (card.facilityId?.trim()) {
    return card.facilityId;
  }
  if (card.facilityName?.trim()) {
    return card.facilityName.trim().toLowerCase();
  }
  return 'unknown-facility';
}

function collectDistinctSports(cards: IHostPortalSessionCardModel[]): string[] {
  const sports = new Set<string>();
  cards.forEach((card) => {
    if (card.sport?.trim()) {
      sports.add(normalizeSportKey(card.sport));
    }
  });
  return Array.from(sports);
}

function collectSortedFacilityKeys(cards: IHostPortalSessionCardModel[]): string[] {
  const byKey = new Map<string, string>();
  cards.forEach((card) => {
    const key = resolveCardFacilityKey(card);
    const label = card.facilityName?.trim() || key;
    if (!byKey.has(key)) {
      byKey.set(key, label);
    }
  });
  return Array.from(byKey.entries())
    .sort((left, right) => left[1].localeCompare(right[1]))
    .map(([key]) => key);
}

function shiftSportVisualTheme(
  theme: ISportVisualTheme,
  hueShiftDeg: number,
): ISportVisualTheme {
  return {
    gradientFrom: shiftHexHue(theme.gradientFrom, hueShiftDeg),
    gradientTo: shiftHexHue(theme.gradientTo, hueShiftDeg * FACILITY_GRADIENT_TO_HUE_RATIO),
    iconBackground: shiftHexHue(
      theme.iconBackground,
      hueShiftDeg * FACILITY_ICON_BACKGROUND_HUE_RATIO,
    ),
    iconColor: shiftHexHue(theme.iconColor, hueShiftDeg),
  };
}

function buildFacilityThemeMap(
  anchorSportId: string | undefined,
  facilityKeys: string[],
): Map<string, ISportVisualTheme> {
  const baseTheme = getSportVisualTheme(anchorSportId);
  const themeByFacility = new Map<string, ISportVisualTheme>();

  facilityKeys.forEach((facilityKey, index) => {
    const hueShift =
      FACILITY_HUE_WAVE_SHIFTS_DEG[index % FACILITY_HUE_WAVE_SHIFTS_DEG.length];
    themeByFacility.set(facilityKey, shiftSportVisualTheme(baseTheme, hueShift));
  });

  return themeByFacility;
}

/**
 * When one sport is in view and multiple facilities exist, accent by facility.
 * Otherwise accent each card by its sport palette.
 */
export function resolvePortalCardAccentMode(
  cards: IHostPortalSessionCardModel[],
  filters: DiscoveryFilters,
): PortalCardAccentModeEnum {
  const distinctSports = collectDistinctSports(cards);
  const distinctFacilities = collectSortedFacilityKeys(cards);
  const sportFilterCount = filters.sports?.length ?? 0;
  const isSingleSportContext =
    sportFilterCount === 1 ||
    (sportFilterCount === 0 && distinctSports.length === 1);

  if (isSingleSportContext && distinctFacilities.length > 1) {
    return PortalCardAccentModeEnum.FACILITY;
  }

  return PortalCardAccentModeEnum.SPORT;
}

/**
 * Builds per-card visual themes: sport palette by default, facility hue waves when one sport spans many locations.
 */
export function buildPortalCardAccentContext(
  config: DiscoveryConfig,
  cards: IHostPortalSessionCardModel[],
  filters: DiscoveryFilters,
): IPortalCardAccentContext {
  if (resolvePortalAccentSource(config) === PortalAccentSourceEnum.BRANDING) {
    const brandingTheme = resolvePortalVisualTheme(config);
    return {
      mode: PortalCardAccentModeEnum.SPORT,
      getCardVisualTheme: () => brandingTheme,
    };
  }

  const mode = resolvePortalCardAccentMode(cards, filters);

  if (mode === PortalCardAccentModeEnum.SPORT) {
    return {
      mode,
      getCardVisualTheme: (card) => getSportVisualTheme(card.sport),
    };
  }

  const anchorSportId =
    filters.sports?.[0] ??
    cards.find((card) => card.sport)?.sport ??
    collectDistinctSports(cards)[0];
  const facilityKeys = collectSortedFacilityKeys(cards);
  const themeByFacility = buildFacilityThemeMap(anchorSportId, facilityKeys);
  const anchorTheme = getSportVisualTheme(anchorSportId);

  return {
    mode,
    anchorSportId,
    getCardVisualTheme: (card) =>
      themeByFacility.get(resolveCardFacilityKey(card)) ?? anchorTheme,
  };
}
