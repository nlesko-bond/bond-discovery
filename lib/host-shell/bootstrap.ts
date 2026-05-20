import type { DiscoveryConfig } from '@/types';
import {
  DEFAULT_BOND_CONSUMER_ORIGIN,
  DEFAULT_LINK_SEO_PATH_PREFIX,
} from '@/lib/host-shell/constants';

export interface IHostBootstrapPayload {
  slug: string;
  discoveryOrigin: string;
  consumerOrigin: string;
  partnerPublicOrigin: string | null;
  linkSeoPathPrefix: string;
  paths: {
    portalDiscoveryUrl: string;
    discoveryBootstrapUrl: string;
    hostBootstrapUrl: string;
  };
  branding: {
    companyName: string;
    primaryColor: string;
    accentColor: string;
  };
}

function readFeatureString(features: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = features[key];
    if (typeof v === 'string' && v.trim().length > 0) {
      return v.trim();
    }
  }
  return undefined;
}

export function resolveHostShellSettings(config: DiscoveryConfig): {
  consumerOrigin: string;
  partnerPublicOrigin: string | null;
  linkSeoPathPrefix: string;
} {
  const raw = config.features as Record<string, unknown>;
  const consumerOrigin =
    readFeatureString(raw, 'consumerOrigin', 'consumer_origin') ??
    process.env.NEXT_PUBLIC_BOND_CONSUMER_ORIGIN ??
    DEFAULT_BOND_CONSUMER_ORIGIN;
  const partnerPublicOrigin =
    readFeatureString(raw, 'partnerPublicOrigin', 'partner_public_origin') ?? null;
  const linkSeoPathPrefix =
    readFeatureString(raw, 'linkSeoPathPrefix', 'link_seo_path_prefix') ??
    DEFAULT_LINK_SEO_PATH_PREFIX;

  const normalizedPrefix = linkSeoPathPrefix.startsWith('/')
    ? linkSeoPathPrefix
    : `/${linkSeoPathPrefix}`;

  const normalizedConsumer = consumerOrigin.replace(/\/$/, '');

  return {
    consumerOrigin: normalizedConsumer,
    partnerPublicOrigin,
    linkSeoPathPrefix: normalizedPrefix,
  };
}

export function buildHostBootstrapPayload(
  config: DiscoveryConfig,
  discoveryOrigin: string,
): IHostBootstrapPayload {
  const host = resolveHostShellSettings(config);

  return {
    slug: config.slug,
    discoveryOrigin,
    consumerOrigin: host.consumerOrigin,
    partnerPublicOrigin: host.partnerPublicOrigin,
    linkSeoPathPrefix: host.linkSeoPathPrefix,
    paths: {
      portalDiscoveryUrl: `${discoveryOrigin}/portal/${encodeURIComponent(config.slug)}`,
      discoveryBootstrapUrl: `${discoveryOrigin}/api/embed/bootstrap?slug=${encodeURIComponent(config.slug)}`,
      hostBootstrapUrl: `${discoveryOrigin}/api/host/bootstrap?slug=${encodeURIComponent(config.slug)}`,
    },
    branding: {
      companyName: config.branding.companyName,
      primaryColor: config.branding.primaryColor,
      accentColor: config.branding.accentColor,
    },
  };
}
