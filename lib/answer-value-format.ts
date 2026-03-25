/**
 * Normalize Bond Answers.answerValue for display (JSON or plain text)
 */

export interface FormattedAnswer {
  display: string;
  linkUrl?: string;
}

function formatAddress(o: Record<string, unknown>): string {
  const street = String(o.street ?? '');
  const city = String(o.city ?? '');
  const state = String(o.state ?? '');
  const zip = String(o.zip ?? '');
  const parts = [street, [city, state].filter(Boolean).join(', '), zip].filter((p) => p.length > 0);
  return parts.join(' · ');
}

/** Shared shape for JSON answers (string column or json/jsonb returned as object by node-pg). */
function formattedFromObject(o: Record<string, unknown>, questionType: string | null | undefined): FormattedAnswer | null {
  const qt = (questionType || '').toLowerCase();
  if (
    qt === 'address' ||
    (typeof o.street === 'string' && typeof o.city === 'string')
  ) {
    return { display: formatAddress(o) };
  }
  if (typeof o.value === 'string') {
    const v = o.value;
    if (/^https?:\/\//i.test(v)) {
      return { display: v, linkUrl: v };
    }
    return { display: v };
  }
  return null;
}

export function formatAnswerValue(
  raw: string | null | undefined | unknown,
  questionType: string | null | undefined
): FormattedAnswer {
  if (raw == null || raw === '') return { display: '' };

  // node-pg returns json/jsonb columns as parsed objects, not strings — never call .trim() blindly
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const fromObj = formattedFromObject(o, questionType);
    if (fromObj) return fromObj;
    try {
      return { display: JSON.stringify(raw) };
    } catch {
      return { display: String(raw) };
    }
  }

  const asString = typeof raw === 'string' ? raw : String(raw);
  const trimmed = asString.trim();
  if (trimmed === '') return { display: '' };

  const tryJson = trimmed.startsWith('{') || trimmed.startsWith('[');
  if (tryJson) {
    try {
      const o = JSON.parse(trimmed) as Record<string, unknown>;
      if (o && typeof o === 'object' && !Array.isArray(o)) {
        const fromObj = formattedFromObject(o, questionType);
        if (fromObj) return fromObj;
      }
    } catch {
      /* fall through */
    }
  }

  return { display: trimmed };
}
