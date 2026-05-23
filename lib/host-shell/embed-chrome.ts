export const EMBED_CHROME_QUERY_PARAM = 'embedChromePx';

export const BOND_HOST_MESSAGE_CHROME_OFFSET = 'bond:chrome-offset';
export const BOND_HOST_MESSAGE_REQUEST_CHROME_OFFSET = 'bond:request-chrome-offset';

export function parseEmbedChromePx(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    return 0;
  }
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function isBondHostChromeOffsetMessage(
  data: unknown,
): data is { type: typeof BOND_HOST_MESSAGE_CHROME_OFFSET; px: number } {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const record = data as { type?: unknown; px?: unknown };
  return (
    record.type === BOND_HOST_MESSAGE_CHROME_OFFSET &&
    typeof record.px === 'number' &&
    Number.isFinite(record.px) &&
    record.px >= 0
  );
}
