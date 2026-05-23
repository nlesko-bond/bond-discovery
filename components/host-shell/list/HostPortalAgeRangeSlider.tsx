'use client';

interface IHostPortalAgeRangeSliderProps {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
  className?: string;
}

const TRACK_HEIGHT_PX = 4;
const THUMB_SIZE_PX = 16;

export function HostPortalAgeRangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  onChange,
  className,
}: IHostPortalAgeRangeSliderProps) {
  const span = max - min;
  const minPercent = span > 0 ? ((valueMin - min) / span) * 100 : 0;
  const maxPercent = span > 0 ? ((valueMax - min) / span) * 100 : 100;

  return (
    <div
      className={className ?? 'relative w-full'}
      style={{ height: `${THUMB_SIZE_PX}px` }}
    >
      <div
        className="absolute left-0 right-0 rounded-full bg-gray-200"
        style={{
          top: '50%',
          height: `${TRACK_HEIGHT_PX}px`,
          transform: 'translateY(-50%)',
        }}
      />
      <div
        className="absolute rounded-full bg-emerald-700"
        style={{
          top: '50%',
          height: `${TRACK_HEIGHT_PX}px`,
          transform: 'translateY(-50%)',
          left: `${minPercent}%`,
          width: `${Math.max(0, maxPercent - minPercent)}%`,
        }}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={valueMin}
        onChange={(event) => {
          const nextMin = Number(event.target.value);
          onChange(Math.min(nextMin, valueMax), valueMax);
        }}
        className="portal-age-dual-range absolute inset-0 z-20 w-full"
        aria-label="Minimum age"
      />
      <input
        type="range"
        min={min}
        max={max}
        value={valueMax}
        onChange={(event) => {
          const nextMax = Number(event.target.value);
          onChange(valueMin, Math.max(nextMax, valueMin));
        }}
        className="portal-age-dual-range absolute inset-0 z-30 w-full"
        aria-label="Maximum age"
      />
    </div>
  );
}
