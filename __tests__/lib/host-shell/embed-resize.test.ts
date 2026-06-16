import { describe, expect, it, vi } from 'vitest';
import {
  isBondHostRequestResizeMessage,
  measurePortalEmbedContentHeight,
  notifyPortalEmbedContentChange,
  PORTAL_EMBED_CONTENT_CHANGE_EVENT,
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

describe('notifyPortalEmbedContentChange', () => {
  it('dispatches a remeasure event when embedded', () => {
    const frameSpy = vi.spyOn(window, 'self', 'get').mockReturnValue({} as Window & typeof globalThis);
    const topSpy = vi.spyOn(window, 'top', 'get').mockReturnValue(window);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    notifyPortalEmbedContentChange();

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: PORTAL_EMBED_CONTENT_CHANGE_EVENT }),
    );

    frameSpy.mockRestore();
    topSpy.mockRestore();
    dispatchSpy.mockRestore();
  });
});
