interface IHostPortalV2TieredPricingLineProps {
  label: string;
}

export function HostPortalV2TieredPricingLine({ label }: IHostPortalV2TieredPricingLineProps) {
  return (
    <p
      className="text-xs font-medium leading-snug text-amber-800"
      data-testid="portal-v2-tiered-pricing"
    >
      {label}
    </p>
  );
}
