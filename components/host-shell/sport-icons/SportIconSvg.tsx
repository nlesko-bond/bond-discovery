import type { ReactNode } from 'react';
import { normalizeSportKey } from '@/lib/host-shell/sport-visuals';

interface ISportIconSvgProps {
  sportKey: string;
  size?: number;
  className?: string;
}

function IconFrame({
  size,
  className,
  children,
}: {
  size: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

function SoccerIcon({ size, className }: { size: number; className?: string }) {
  return (
    <IconFrame size={size} className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 5.5 14.8 8.2 14.2 11.8 9.8 11.8 9.2 8.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 5.5V3M14.8 8.2 17 7M14.2 11.8 16 14M9.8 11.8 8 14M9.2 8.2 7 7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </IconFrame>
  );
}

function BasketballIcon({ size, className }: { size: number; className?: string }) {
  return (
    <IconFrame size={size} className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3.5 12h17M12 3.5c2.8 2.5 4.5 5.8 4.5 8.5S14.8 17.5 12 20M12 3.5C9.2 6 7.5 9.3 7.5 12S9.2 17.5 12 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </IconFrame>
  );
}

function FootballIcon({ size, className }: { size: number; className?: string }) {
  return (
    <IconFrame size={size} className={className}>
      <path
        d="M6.5 5.5c4-2.5 9-1.5 12.5 2.5 2 2.5 2.5 6 1 9.5-1.5 3.5-4.5 5.5-8 6-3 .5-6.5-1-9-4C3 16.5 2.5 10.5 6.5 5.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M8 9.5 11.5 13M13 11 16.5 14.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </IconFrame>
  );
}

function TennisIcon({ size, className }: { size: number; className?: string }) {
  return (
    <IconFrame size={size} className={className}>
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M13.5 13.5 20 20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M6.5 6.5 11.5 11.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </IconFrame>
  );
}

function BaseballIcon({ size, className }: { size: number; className?: string }) {
  return (
    <IconFrame size={size} className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8.5 6.5c1.5 3 1.5 7.5 0 11M15.5 6.5c-1.5 3-1.5 7.5 0 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </IconFrame>
  );
}

function VolleyballIcon({ size, className }: { size: number; className?: string }) {
  return (
    <IconFrame size={size} className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 3v18M4.5 7.5 19.5 16.5M4.5 16.5 19.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </IconFrame>
  );
}

function HockeyIcon({ size, className }: { size: number; className?: string }) {
  return (
    <IconFrame size={size} className={className}>
      <path d="M5 19 14 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M14 10c1.5-1 3-1.5 5-.5 1 .5 1.5 1.5 1 2.5-.5 1-2 1.5-3.5 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="6" cy="19" r="2" fill="currentColor" />
    </IconFrame>
  );
}

function SwimmingIcon({ size, className }: { size: number; className?: string }) {
  return (
    <IconFrame size={size} className={className}>
      <path d="M4 14c2-1 4-1 6 0s4 1 6 0 4-1 6 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M6 10c1.5-.5 3-.5 4.5 0M13 10c1.5-.5 3-.5 4.5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" />
    </IconFrame>
  );
}

function YogaIcon({ size, className }: { size: number; className?: string }) {
  return (
    <IconFrame size={size} className={className}>
      <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v4M9 11h6M8 19l4-4 4 4M10 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  );
}

function FitnessIcon({ size, className }: { size: number; className?: string }) {
  return (
    <IconFrame size={size} className={className}>
      <path d="M6 9v6M18 9v6M6 12H4M20 12h-2M18 12H6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M8 9V7a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2M16 9V7a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </IconFrame>
  );
}

function DefaultSportIcon({ size, className }: { size: number; className?: string }) {
  return (
    <IconFrame size={size} className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </IconFrame>
  );
}

const BUILTIN_SPORT_RENDERERS: Record<
  string,
  (props: { size: number; className?: string }) => ReactNode
> = {
  soccer: SoccerIcon,
  football: FootballIcon,
  basketball: BasketballIcon,
  tennis: TennisIcon,
  baseball: BaseballIcon,
  softball: BaseballIcon,
  volleyball: VolleyballIcon,
  hockey: HockeyIcon,
  ice_hockey: HockeyIcon,
  lacrosse: HockeyIcon,
  swimming: SwimmingIcon,
  pool: SwimmingIcon,
  yoga: YogaIcon,
  fitness: FitnessIcon,
  gymnastics: FitnessIcon,
  dance: YogaIcon,
  martial_arts: FitnessIcon,
  karate: FitnessIcon,
  golf: TennisIcon,
  cricket: BaseballIcon,
  rugby: FootballIcon,
};

export function SportIconSvg({ sportKey, size = 20, className }: ISportIconSvgProps) {
  const normalized = normalizeSportKey(sportKey);
  const Renderer =
    BUILTIN_SPORT_RENDERERS[normalized] ??
    Object.entries(BUILTIN_SPORT_RENDERERS).find(
      ([candidate]) => normalized.includes(candidate) || candidate.includes(normalized),
    )?.[1] ??
    DefaultSportIcon;

  return <Renderer size={size} className={className} />;
}
