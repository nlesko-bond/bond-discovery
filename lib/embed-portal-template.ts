import type { BondEmbedPortalTemplate } from '@/types';

const VALID_EMBED_PORTAL_TEMPLATES: BondEmbedPortalTemplate[] = [
  'classic',
  'hero-carousel',
  'schedule-first',
];

/**
 * Resolves embed portal template from an optional query string, falling back to config.
 */
export function resolveEmbedPortalTemplate(
  queryValue: string | null,
  configured: BondEmbedPortalTemplate | undefined,
): BondEmbedPortalTemplate {
  const fallback: BondEmbedPortalTemplate = configured || 'classic';
  if (
    queryValue &&
    VALID_EMBED_PORTAL_TEMPLATES.includes(queryValue as BondEmbedPortalTemplate)
  ) {
    return queryValue as BondEmbedPortalTemplate;
  }
  return fallback;
}
