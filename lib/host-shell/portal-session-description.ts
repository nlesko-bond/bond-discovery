export interface ISessionDescriptionSections {
  lead?: string;
  body?: string;
}

function normalizeDescriptionText(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
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
