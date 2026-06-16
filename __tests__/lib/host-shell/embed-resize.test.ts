import { describe, expect, it, vi } from 'vitest';
import {
  bindPortalEmbedParentScrollForward,
  isBondHostRequestResizeMessage,
  measurePortalEmbedContentHeight,
  notifyPortalEmbedContentChange,
  PORTAL_EMBED_CONTENT_CHANGE_EVENT,
  shouldForwardEmbedScrollToParent,
} from '@/lib/host-shell/embed-resize';

function mockEmbeddedFrame(isEmbedded: boolean) {
  const frameSpy = vi.spyOn(window, 'self', 'get');
  const topSpy = vi.spyOn(window, 'top', 'get');
  if (isEmbedded) {
    frameSpy.mockReturnValue({} as Window & typeof globalThis);
    topSpy.mockReturnValue(window);
  } else {
    frameSpy.mockReturnValue(window);
    topSpy.mockReturnValue(window);
  }
  return () => {
    frameSpy.mockRestore();
    topSpy.mockRestore();
  };
}

describe('shouldForwardEmbedScrollToParent', () => {
  it('returns false when not embedded', () => {
    const restore = mockEmbeddedFrame(false);
    expect(shouldForwardEmbedScrollToParent(document.body, 10)).toBe(false);
    restore();
  });

  it('returns true for embedded page scroll when no nested scroller absorbs the gesture', () => {
    const restore = mockEmbeddedFrame(true);
    expect(shouldForwardEmbedScrollToParent(document.body, 10)).toBe(true);
    restore();
  });

  it('returns false when a nested scroll container can still scroll', () => {
    const restore = mockEmbeddedFrame(true);
    const scroller = document.createElement('div');
    scroller.style.overflowY = 'auto';
    Object.defineProperty(scroller, 'scrollHeight', { value: 400, configurable: true });
    Object.defineProperty(scroller, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(scroller, 'scrollTop', { value: 50, configurable: true, writable: true });
    document.body.appendChild(scroller);

    expect(shouldForwardEmbedScrollToParent(scroller, 10)).toBe(false);

    scroller.remove();
    restore();
  });
});

describe('bindPortalEmbedParentScrollForward', () => {
  it('posts wheel deltas to the host parent when embedded', () => {
    const restore = mockEmbeddedFrame(true);
    const postMessage = vi.fn();
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage },
    });

    const unbind = bindPortalEmbedParentScrollForward();
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'bond:scroll',
        deltaX: 0,
        deltaY: 120,
      },
      '*',
    );

    unbind();
    restore();
  });
});

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
