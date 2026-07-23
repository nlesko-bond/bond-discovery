export interface ISessionDescriptionSections {
  lead?: string;
  body?: string;
}

function normalizeDescriptionText(value?: string): string | undefined {
  const trimmed = decodeBasicHtmlEntities(value?.trim() ?? '');
  return trimmed || undefined;
}

const BASIC_HTML_ENTITY_PATTERN =
  /&(?:amp|ndash|mdash|lsquo|rsquo|ldquo|rdquo|lt|gt|quot|apos|nbsp|#39|#8216|#8217|#x2018|#x2019|#x2013|#8211);/gi;

const BASIC_HTML_ENTITY_VALUES: Record<string, string> = {
  '&amp;': '&',
  '&ndash;': '–',
  '&mdash;': '—',
  '&lsquo;': '\u2018',
  '&rsquo;': '\u2019',
  '&ldquo;': '\u201C',
  '&rdquo;': '\u201D',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
  '&#8211;': '–',
  '&#8216;': '\u2018',
  '&#8217;': '\u2019',
  '&#x2013;': '–',
  '&#x2018;': '\u2018',
  '&#x2019;': '\u2019',
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
