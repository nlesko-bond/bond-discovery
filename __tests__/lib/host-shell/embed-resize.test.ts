import { describe, expect, it } from 'vitest';
import {
  isBondHostRequestResizeMessage,
  measurePortalEmbedContentHeight,
} from '@/lib/host-shell/embed-resize';

describe('isBondHostRequestResizeMessage', () => {
  it('accepts bond:request-resize messages', () => {
    expect(isBondHostRequestResizeMessage({ type: 'bond:request-resize' })).toBe(true);
  });

  it('rejects other messages', () => {
    expect(isBondHostRequestResizeMessage({ type: 'discovery-resize' })).toBe(false);
  });
});

describe('measurePortalEmbedContentHeight', () => {
  it('uses root scroll height when provided', () => {
    const root = document.createElement('div');
    Object.defineProperty(root, 'scrollHeight', { value: 420, configurable: true });
    Object.defineProperty(root, 'getBoundingClientRect', {
      value: () => ({ height: 420 }),
      configurable: true,
    });
    expect(measurePortalEmbedContentHeight(root)).toBeGreaterThanOrEqual(420);
  });
});
