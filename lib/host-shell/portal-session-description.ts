export interface ISessionDescriptionSections {
  lead?: string;
  body?: string;
}

function normalizeDescriptionText(value?: string): string | undefined {
  const trimmed = decodeBasicHtmlEntities(value?.trim() ?? '');
  return trimmed || undefined;
}

const BASIC_HTML_ENTITY_PATTERN =
  /&(?:amp|ndash|mdash|lt|gt|quot|apos|nbsp|#39|#x2013|#8211);/gi;

const BASIC_HTML_ENTITY_VALUES: Record<string, string> = {
  '&amp;': '&',
  '&ndash;': '–',
  '&mdash;': '—',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
  '&#8211;': '–',
  '&#x2013;': '–',
};

function decodeBasicHtmlEntities(value: string): string {
  return value.replace(BASIC_HTML_ENTITY_PATTERN, (entity) => {
    const normalized = entity.toLowerCase();
    return BASIC_HTML_ENTITY_VALUES[normalized] ?? entity;
  });
}

export function hasHostPortalSessionDescription(
  description?: string,
  longDescription?: string,
): boolean {
  return Boolean(
    normalizeDescriptionText(description) || normalizeDescriptionText(longDescription),
  );
}

/**
 * Builds modal copy from short and long session descriptions, deduplicating overlap.
 */
export function formatHostPortalSessionDescription(
  description?: string,
  longDescription?: string,
): ISessionDescriptionSections | null {
  const shortText = normalizeDescriptionText(description);
  const longText = normalizeDescriptionText(longDescription);

  if (!shortText && !longText) {
    return null;
  }
  if (!shortText) {
    return { body: longText };
  }
  if (!longText) {
    return { body: shortText };
  }
  if (shortText === longText) {
    return { body: longText };
  }
  if (longText.startsWith(shortText)) {
    return { body: longText };
  }
  return { lead: shortText, body: longText };
}
