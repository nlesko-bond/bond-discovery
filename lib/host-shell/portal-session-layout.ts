import type { DiscoveryConfig } from '@/types';
import { HostPortalLayoutEnum, PortalSessionLayoutEnum } from '@/types';
import { isHostPortalSessionLayout } from '@/lib/host-shell/portal-config';
import { isPortalHeroEnabled } from '@/lib/host-shell/portal-list-layout';

export const PORTAL_SESSION_LAYOUT_QUERY_KEY = 'sessionLayout';

export function parsePortalSessionLayoutParam(
  raw: string | null | undefined,
): PortalSessionLayoutEnum | undefined {
  if (raw === PortalSessionLayoutEnum.LIST || raw === 'list') {
    return PortalSessionLayoutEnum.LIST;
  }
  if (raw === PortalSessionLayoutEnum.GRID || raw === 'grid') {
    return PortalSessionLayoutEnum.GRID;
  }
  return undefined;
}

/**
 * Admin default for list rows vs grid cards on the portal sessions shell.
 */
export function resolvePortalSessionLayoutDefault(
  config: DiscoveryConfig,
): PortalSessionLayoutEnum {
  const explicit = config.features.portalSessionLayoutDefault;
  if (explicit === PortalSessionLayoutEnum.LIST || explicit === PortalSessionLayoutEnum.GRID) {
    return explicit;
  }
  if (config.features.hostPortalLayout === HostPortalLayoutEnum.SESSIONS_FIRST) {
    return PortalSessionLayoutEnum.GRID;
  }
  return PortalSessionLayoutEnum.LIST;
}

export function isPortalSessionLayoutToggleAllowed(config: DiscoveryConfig): boolean {
  if (!isHostPortalSessionLayout(config)) {
    return false;
  }
  return config.features.allowPortalSessionLayoutToggle === true;
}

/**
 * Resolves list vs grid from admin default and optional URL override when toggle is enabled.
 */
export function resolvePortalSessionLayout(
  config: DiscoveryConfig,
  layoutParam: string | null | undefined,
): PortalSessionLayoutEnum {
  const defaultLayout = resolvePortalSessionLayoutDefault(config);
  const parsed = parsePortalSessionLayoutParam(layoutParam);
  if (parsed !== undefined && isPortalSessionLayoutToggleAllowed(config)) {
    return parsed;
  }
  return defaultLayout;
}

export function shouldShowPortalSessionHero(
  config: DiscoveryConfig,
  sessionLayout: PortalSessionLayoutEnum,
): boolean {
  if (sessionLayout !== PortalSessionLayoutEnum.LIST) {
    return false;
  }
  return isPortalHeroEnabled(config);
}
