interface ISurfaceBadgeProps {
  surfaces: ReadonlyArray<'Public' | 'Embed' | 'Portal' | 'Host'>;
}

export function SurfaceBadge({ surfaces }: ISurfaceBadgeProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {surfaces.map((surface) => (
        <span
          key={surface}
          className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600"
        >
          {surface}
        </span>
      ))}
    </div>
  );
}
