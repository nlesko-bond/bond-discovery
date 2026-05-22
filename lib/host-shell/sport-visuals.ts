export interface ISportVisualTheme {
  gradientFrom: string;
  gradientTo: string;
  iconBackground: string;
  iconColor: string;
}

const DEFAULT_SPORT_THEME: ISportVisualTheme = {
  gradientFrom: '#4f46e5',
  gradientTo: '#7c3aed',
  iconBackground: '#eef2ff',
  iconColor: '#4338ca',
};

const SPORT_THEMES: Record<string, ISportVisualTheme> = {
  soccer: {
    gradientFrom: '#16a34a',
    gradientTo: '#059669',
    iconBackground: '#dcfce7',
    iconColor: '#15803d',
  },
  football: {
    gradientFrom: '#b45309',
    gradientTo: '#c2410c',
    iconBackground: '#ffedd5',
    iconColor: '#9a3412',
  },
  basketball: {
    gradientFrom: '#ea580c',
    gradientTo: '#dc2626',
    iconBackground: '#ffedd5',
    iconColor: '#c2410c',
  },
  tennis: {
    gradientFrom: '#ca8a04',
    gradientTo: '#65a30d',
    iconBackground: '#fef9c3',
    iconColor: '#a16207',
  },
  baseball: {
    gradientFrom: '#dc2626',
    gradientTo: '#e11d48',
    iconBackground: '#ffe4e6',
    iconColor: '#be123c',
  },
  softball: {
    gradientFrom: '#e11d48',
    gradientTo: '#db2777',
    iconBackground: '#fce7f3',
    iconColor: '#be185d',
  },
  volleyball: {
    gradientFrom: '#db2777',
    gradientTo: '#e11d48',
    iconBackground: '#fce7f3',
    iconColor: '#be185d',
  },
  hockey: {
    gradientFrom: '#475569',
    gradientTo: '#334155',
    iconBackground: '#f1f5f9',
    iconColor: '#334155',
  },
  ice_hockey: {
    gradientFrom: '#0ea5e9',
    gradientTo: '#0284c7',
    iconBackground: '#e0f2fe',
    iconColor: '#0369a1',
  },
  lacrosse: {
    gradientFrom: '#2563eb',
    gradientTo: '#4f46e5',
    iconBackground: '#dbeafe',
    iconColor: '#1d4ed8',
  },
  swimming: {
    gradientFrom: '#0891b2',
    gradientTo: '#2563eb',
    iconBackground: '#cffafe',
    iconColor: '#0e7490',
  },
  pool: {
    gradientFrom: '#0891b2',
    gradientTo: '#2563eb',
    iconBackground: '#cffafe',
    iconColor: '#0e7490',
  },
  yoga: {
    gradientFrom: '#9333ea',
    gradientTo: '#7c3aed',
    iconBackground: '#f3e8ff',
    iconColor: '#7e22ce',
  },
  fitness: {
    gradientFrom: '#2563eb',
    gradientTo: '#4f46e5',
    iconBackground: '#dbeafe',
    iconColor: '#1d4ed8',
  },
  golf: {
    gradientFrom: '#15803d',
    gradientTo: '#166534',
    iconBackground: '#dcfce7',
    iconColor: '#166534',
  },
  martial_arts: {
    gradientFrom: '#57534e',
    gradientTo: '#44403c',
    iconBackground: '#f5f5f4',
    iconColor: '#44403c',
  },
  dance: {
    gradientFrom: '#c026d3',
    gradientTo: '#9333ea',
    iconBackground: '#fae8ff',
    iconColor: '#a21caf',
  },
  skiing: {
    gradientFrom: '#64748b',
    gradientTo: '#0ea5e9',
    iconBackground: '#f1f5f9',
    iconColor: '#475569',
  },
};

/**
 * Normalizes SessionDto.sport / SportNameEnum values for asset lookup.
 */
export function normalizeSportKey(sportId: string): string {
  return sportId.toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Bond sport icon filenames in public/icons/sports/ (e.g. icn-sport-soccer.svg).
 */
export function getSportIconAssetFileName(sportId: string): string {
  const slug = normalizeSportKey(sportId).replace(/_/g, '-');
  return `icn-sport-${slug}.svg`;
}

/**
 * Theme colors for sport accent chips and icon badges on portal session cards.
 */
export function getSportVisualTheme(sportId: string | undefined): ISportVisualTheme {
  if (!sportId?.trim()) {
    return DEFAULT_SPORT_THEME;
  }
  const key = normalizeSportKey(sportId);
  if (SPORT_THEMES[key]) {
    return SPORT_THEMES[key];
  }
  const match = Object.keys(SPORT_THEMES).find(
    (candidate) => key.includes(candidate) || candidate.includes(key),
  );
  return match ? SPORT_THEMES[match] : DEFAULT_SPORT_THEME;
}

/**
 * Public path for partner-provided sport SVGs (public/icons/sports/icn-sport-*.svg).
 */
export function getSportIconAssetPath(sportId: string): string {
  return `/icons/sports/${getSportIconAssetFileName(sportId)}`;
}
