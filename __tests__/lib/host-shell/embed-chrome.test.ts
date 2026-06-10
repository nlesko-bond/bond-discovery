import { describe, expect, it } from 'vitest';
import {
  parseEmbedChromePx,
  isBondHostChromeOffsetMessage,
  BOND_HOST_MESSAGE_CHROME_OFFSET,
} from '@/lib/host-shell/embed-chrome';

describe('parseEmbedChromePx', () => {
  it('returns 0 for empty input', () => {
    expect(parseEmbedChromePx(undefined)).toBe(0);
    expect(parseEmbedChromePx('')).toBe(0);
  });

  it('parses positive integers', () => {
    expect(parseEmbedChromePx('80')).toBe(80);
    expect(parseEmbedChromePx(['64'])).toBe(64);
  });

  it('rejects invalid values', () => {
    expect(parseEmbedChromePx('0')).toBe(0);
    expect(parseEmbedChromePx('-10')).toBe(0);
    expect(parseEmbedChromePx('abc')).toBe(0);
  });
});

describe('isBondHostChromeOffsetMessage', () => {
  it('accepts valid chrome offset messages', () => {
    expect(
      isBondHostChromeOffsetMessage({
        type: BOND_HOST_MESSAGE_CHROME_OFFSET,
        px: 72,
      }),
    ).toBe(true);
  });

  it('rejects invalid payloads', () => {
    expect(isBondHostChromeOffsetMessage(null)).toBe(false);
    expect(isBondHostChromeOffsetMessage({ type: 'other', px: 10 })).toBe(false);
    expect(isBondHostChromeOffsetMessage({ type: BOND_HOST_MESSAGE_CHROME_OFFSET, px: -1 })).toBe(
      false,
    );
  });
});
