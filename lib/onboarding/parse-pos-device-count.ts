export const MIN_POS_DEVICES_ORDERED = 0;

export const MAX_POS_DEVICES_ORDERED = 99;

export function parsePosDeviceCount(raw: unknown): { value: number; error?: string } {
  if (raw === null || raw === undefined || raw === '') {
    return { value: 0, error: 'Enter how many POS devices you need (0 if none).' };
  }

  const parsed = typeof raw === 'number' ? raw : Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    return { value: 0, error: 'Enter a whole number.' };
  }

  if (parsed < MIN_POS_DEVICES_ORDERED || parsed > MAX_POS_DEVICES_ORDERED) {
    return {
      value: 0,
      error: `Enter a number between ${MIN_POS_DEVICES_ORDERED} and ${MAX_POS_DEVICES_ORDERED}.`,
    };
  }

  return { value: parsed };
}
