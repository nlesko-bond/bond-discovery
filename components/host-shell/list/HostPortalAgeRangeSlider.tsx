'use client';

interface IHostPortalAgeRangeSliderProps {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
}

export function HostPortalAgeRangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  onChange,
}: IHostPortalAgeRangeSliderProps) {
  const span = max - min;
  const minPercent = span > 0 ? ((valueMin - min) / span) * 100 : 0;
  const maxPercent = span > 0 ? ((valueMax - min) / span) * 100 : 100;

  return (
    <div className="relative mx-1 h-10 pt-1">
      <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gray-200" />
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-emerald-700"
        style={{ left: `${minPercent}%`, width: `${Math.max(0, maxPercent - minPercent)}%` }}
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
