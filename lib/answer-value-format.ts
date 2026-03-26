/**
 * Normalize Bond Answers.answerValue for display (JSON or plain text).
 * Handles PascalCase (.NET), json/jsonb objects, double-encoded JSON strings, and text columns.
 */

export interface FormattedAnswer {
  display: string;
  linkUrl?: string;
  /** True when the answer is an affirmative boolean / waiver (show checkmark in UI). */
  checkmark?: boolean;
}

function formatAddress(o: Record<string, unknown>): string {
  const street = String(o.street ?? o.Street ?? '');
  const city = String(o.city ?? o.City ?? '');
  const state = String(o.state ?? o.State ?? '');
  const zip = String(o.zip ?? o.Zip ?? o.postalCode ?? o.PostalCode ?? '');
  const parts = [street, [city, state].filter(Boolean).join(', '), zip].filter((p) => p.length > 0);
  return parts.join(' · ');
}

function isBooleanishQuestionType(questionType: string | null | undefined): boolean {
  const qt = (questionType || '').toLowerCase();
  return (
    qt === 'boolean' ||
    qt === 'bool' ||
    qt === 'checkbox' ||
    qt === 'terms' ||
    qt === 'termsandconditions' ||
    qt === 'waiver' ||
    qt === 'consent' ||
    qt === 'agreement' ||
    qt === 'acknowledgment' ||
    qt === 'acknowledgement'
  );
}

function isDateQuestionType(questionType: string | null | undefined): boolean {
  const qt = (questionType || '').toLowerCase();
  return qt === 'date' || qt === 'datetime' || qt === 'birthdate' || qt === 'dob';
}

function parseTruthy(raw: unknown): boolean | null {
  if (raw === true) return true;
  if (raw === false) return false;
  if (typeof raw === 'number') {
    if (raw === 1) return true;
    if (raw === 0) return false;
    return null;
  }
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on') return true;
    if (s === 'false' || s === '0' || s === 'no' || s === 'n' || s === 'off' || s === '') return false;
    return null;
  }
  return null;
}

/** Format ISO-like date strings for display in the staff locale. */
function formatDateDisplay(trimmed: string): string {
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed;
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(trimmed.includes('T') ? { hour: 'numeric', minute: '2-digit' } : {}),
    }).format(d);
  } catch {
    return trimmed;
  }
}

function booleanFormattedAnswer(truthy: boolean): FormattedAnswer {
  if (truthy) return { display: '', checkmark: true };
  return { display: '—' };
}

function formatStringChoiceList(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const parts = value
    .map((x) => (typeof x === 'string' ? x.trim() : String(x)))
    .filter((s) => s.length > 0);
  if (parts.length === 0) return '';
  return parts.join(', ');
}

/** Primary payload: Bond often uses `Value` (PascalCase) instead of `value`. */
function bondPrimaryValue(o: Record<string, unknown>): unknown {
  if ('value' in o) return o.value;
  if ('Value' in o) return o.Value;
  return undefined;
}

function bondTruthyField(o: Record<string, unknown>, key: string, pascalKey: string): unknown {
  if (key in o) return o[key];
  if (pascalKey in o) return o[pascalKey];
  return undefined;
}

/**
 * Parse JSON strings that may be wrapped in quotes or double-encoded (e.g. text column storing
 * a JSON-encoded string whose content is itself JSON).
 */
function unwrapJsonTextToValue(text: string): unknown {
  let cur: unknown = text.trim();
  for (let depth = 0; depth < 12; depth++) {
    if (typeof cur !== 'string') {
      return cur;
    }
    const s = cur.trim();
    if (s.startsWith('"') && s.endsWith('"')) {
      try {
        cur = JSON.parse(s);
        continue;
      } catch {
        return cur;
      }
    }
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        cur = JSON.parse(s);
        continue;
      } catch {
        return cur;
      }
    }
    return cur;
  }
  return cur;
}

function looksLikeAddressShape(o: Record<string, unknown>): boolean {
  const street = o.street ?? o.Street;
  const city = o.city ?? o.City;
  return typeof street === 'string' && typeof city === 'string';
}

/** Shared shape for JSON answers (string column or json/jsonb returned as object by node-pg). */
function formattedFromObject(o: Record<string, unknown>, questionType: string | null | undefined): FormattedAnswer | null {
  const qt = (questionType || '').toLowerCase();

  if (qt === 'address' || looksLikeAddressShape(o)) {
    return { display: formatAddress(o) };
  }

  const pv = bondPrimaryValue(o);

  if (typeof pv === 'boolean') {
    return booleanFormattedAnswer(pv);
  }

  if (isBooleanishQuestionType(questionType)) {
    const t =
      parseTruthy(pv) ??
      parseTruthy(bondTruthyField(o, 'accepted', 'Accepted')) ??
      parseTruthy(bondTruthyField(o, 'agreed', 'Agreed'));
    if (t !== null) return booleanFormattedAnswer(t);
  }

  const choiceList = formatStringChoiceList(pv);
  if (choiceList !== null) {
    return { display: choiceList };
  }

  if (typeof pv === 'string') {
    const v = pv;
    if (isDateQuestionType(questionType) && /^\d{4}-\d{2}-\d{2}/.test(v.trim())) {
      return { display: formatDateDisplay(v.trim()) };
    }
    if (/^https?:\/\//i.test(v)) {
      return { display: v, linkUrl: v };
    }
    if (v.startsWith('{') || v.startsWith('[')) {
      const inner = unwrapJsonTextToValue(v);
      if (inner !== v && typeof inner === 'object' && inner !== null && !Array.isArray(inner)) {
        return formattedFromObject(inner as Record<string, unknown>, questionType);
      }
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

  const looksJsonish =
    trimmed.startsWith('{') ||
    trimmed.startsWith('[') ||
    (trimmed.startsWith('"') && (trimmed.includes('{') || trimmed.includes('[')));
  if (looksJsonish) {
    const unwrapped = unwrapJsonTextToValue(trimmed);
    if (unwrapped !== trimmed) {
      return formatAnswerValue(unwrapped, questionType);
    }
  }

  if (isBooleanishQuestionType(questionType)) {
    const t = parseTruthy(trimmed);
    if (t !== null) return booleanFormattedAnswer(t);
  }

  if (isDateQuestionType(questionType) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return { display: formatDateDisplay(trimmed) };
  }

  const tryJson = trimmed.startsWith('{') || trimmed.startsWith('[');
  if (tryJson) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const fromObj = formattedFromObject(parsed as Record<string, unknown>, questionType);
        if (fromObj) return fromObj;
      }
    } catch {
      /* fall through */
    }
  }

  return { display: trimmed };
}
