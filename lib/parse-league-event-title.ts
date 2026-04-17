/**
 * Split a Bond event title like "Home Team vs Away Team" into home / away.
 * Uses a case-insensitive "vs" or "vs." delimiter with surrounding whitespace.
 */
export function parseHomeAwayFromEventTitle(title: string): { home: string; away: string } {
  const t = (title || '').trim();
  if (!t) return { home: '', away: '' };

  const vs = /\s+vs\.?\s+/i;
  const parts = t.split(vs);
  if (parts.length >= 2) {
    return {
      home: parts[0].trim(),
      away: parts.slice(1).join(' vs ').trim(),
    };
  }
  return { home: t, away: '' };
}
