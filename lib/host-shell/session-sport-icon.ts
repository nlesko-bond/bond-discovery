import {
  Activity,
  Cake,
  CircleDot,
  Dumbbell,
  Flag,
  Footprints,
  Heart,
  Mountain,
  Music,
  Snowflake,
  Swords,
  Waves,
  type LucideIcon,
} from 'lucide-react';

const SPORT_ICONS: Record<string, LucideIcon> = {
  soccer: CircleDot,
  football: CircleDot,
  basketball: CircleDot,
  volleyball: CircleDot,
  tennis: CircleDot,
  baseball: CircleDot,
  softball: CircleDot,
  hockey: Activity,
  ice_hockey: Snowflake,
  lacrosse: Activity,
  swimming: Waves,
  pool: Waves,
  yoga: Heart,
  fitness: Dumbbell,
  running: Footprints,
  track: Footprints,
  cycling: Footprints,
  golf: Flag,
  wrestling: Swords,
  gymnastics: Dumbbell,
  skating: Snowflake,
  ice_skating: Snowflake,
  figure_skating: Snowflake,
  roller_skating: Footprints,
  dance: Music,
  martial_arts: Swords,
  karate: Swords,
  taekwondo: Swords,
  judo: Swords,
  mma: Swords,
  boxing: Swords,
  cheer: Dumbbell,
  cheerleading: Dumbbell,
  birthday: Cake,
  party: Cake,
  cricket: CircleDot,
  handball: CircleDot,
  rugby: CircleDot,
  skiing: Mountain,
  snowboarding: Mountain,
  surfing: Waves,
  kayaking: Waves,
  rowing: Waves,
  hiking: Mountain,
};

const DEFAULT_SPORT_ICON = Activity;

/**
 * Resolves a Lucide icon for SessionDto.sport (SportNameEnum string).
 */
export function getHostPortalSportIcon(sportId: string): LucideIcon {
  const key = sportId.toLowerCase().replace(/[\s-]+/g, '_');
  if (SPORT_ICONS[key]) {
    return SPORT_ICONS[key];
  }
  const match = Object.keys(SPORT_ICONS).find(
    (candidate) => key.includes(candidate) || candidate.includes(key),
  );
  return match ? SPORT_ICONS[match] : DEFAULT_SPORT_ICON;
}
