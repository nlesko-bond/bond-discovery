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

export function formatAnswerValue(
  raw: string | null | undefined,
  questionType: string | null | undefined
): FormattedAnswer {
  if (raw == null || raw === '') return { display: '' };
  const trimmed = raw.trim();

  const tryJson = trimmed.startsWith('{') || trimmed.startsWith('[');
  if (tryJson) {
    try {
      const o = JSON.parse(trimmed) as Record<string, unknown>;
      if (o && typeof o === 'object' && !Array.isArray(o)) {
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
      }
    } catch {
      /* fall through */
    }
  }

  return { display: trimmed };
}
