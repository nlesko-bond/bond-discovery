export const BOND_HOST_MESSAGE_REQUEST_RESIZE = 'bond:request-resize';
export const BOND_HOST_MESSAGE_SCROLL = 'bond:scroll';
export const PORTAL_EMBED_CONTENT_CHANGE_EVENT = 'bond-portal-embed-content-change';

const PORTAL_EMBED_HTML_CLASS = 'bond-portal-embed';
const SCROLL_EDGE_TOLERANCE_PX = 1;

export function isPortalEmbedFrame(): boolean {
  return typeof window !== 'undefined' && window.self !== window.top;
}

/**
 * Signals that in-flow portal content changed height (row expand, filter panel, etc.).
 */
export function notifyPortalEmbedContentChange(): void {
  if (typeof window === 'undefined' || !isPortalEmbedFrame()) {
    return;
  }
  window.dispatchEvent(new Event(PORTAL_EMBED_CONTENT_CHANGE_EVENT));
}

/**
 * Prevents a second scrollbar inside the discovery iframe; the host kit owns page scroll.
 */
export function lockPortalEmbedDocumentScroll(): () => void {
  const html = document.documentElement;
  const body = document.body;
  html.classList.add(PORTAL_EMBED_HTML_CLASS);
  const previousHtmlOverflow = html.style.overflow;
  const previousBodyOverflow = body.style.overflow;
  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  return () => {
    html.classList.remove(PORTAL_EMBED_HTML_CLASS);
    html.style.overflow = previousHtmlOverflow;
    body.style.overflow = previousBodyOverflow;
  };
}

function isVerticallyScrollableElement(element: HTMLElement): boolean {
  const overflowY = window.getComputedStyle(element).overflowY;
  if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') {
    return false;
  }
  return element.scrollHeight > element.clientHeight + SCROLL_EDGE_TOLERANCE_PX;
}

/**
 * When the iframe document does not scroll, wheel/touch over the embed should move
 * the partner page. Skip forwarding when the event target is inside a nested
 * scroll container that can still absorb the gesture (filter sheets, etc.).
 */
export function shouldForwardEmbedScrollToParent(
  target: EventTarget | null,
  deltaY: number,
): boolean {
  if (!isPortalEmbedFrame() || deltaY === 0) {
    return false;
  }

  let node: Node | null = target instanceof Node ? target : null;
  while (node && node !== document.documentElement) {
    if (node instanceof HTMLElement && isVerticallyScrollableElement(node)) {
      const atTop = node.scrollTop <= SCROLL_EDGE_TOLERANCE_PX;
      const atBottom =
        node.scrollTop + node.clientHeight >= node.scrollHeight - SCROLL_EDGE_TOLERANCE_PX;
      if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) {
        return false;
      }
    }
    node = node.parentNode;
  }

  return true;
}

function postEmbedScrollToHostParent(deltaX: number, deltaY: number): void {
  window.parent.postMessage(
    {
      type: BOND_HOST_MESSAGE_SCROLL,
      deltaX,
      deltaY,
    },
    '*',
  );
}

/**
 * Forwards wheel and touch scroll from the discovery iframe to the host page.
 */
export function bindPortalEmbedParentScrollForward(): () => void {
  if (!isPortalEmbedFrame()) {
    return () => undefined;
  }

  let lastTouchY: number | null = null;

  const onWheel = (event: WheelEvent) => {
    if (!shouldForwardEmbedScrollToParent(event.target, event.deltaY)) {
      return;
    }
    event.preventDefault();
    postEmbedScrollToHostParent(event.deltaX, event.deltaY);
  };

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) {
      lastTouchY = null;
      return;
    }
    lastTouchY = event.touches[0].clientY;
  };

  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length !== 1 || lastTouchY === null) {
      return;
    }
    const currentTouchY = event.touches[0].clientY;
    const deltaY = lastTouchY - currentTouchY;
    lastTouchY = currentTouchY;
    if (!shouldForwardEmbedScrollToParent(event.target, deltaY)) {
      return;
    }
    event.preventDefault();
    postEmbedScrollToHostParent(0, deltaY);
  };

  const onTouchEnd = () => {
    lastTouchY = null;
  };

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });

  return () => {
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
  };
}

export function isBondHostRequestResizeMessage(data: unknown): data is { type: typeof BOND_HOST_MESSAGE_REQUEST_RESIZE } {
  if (!data || typeof data !== 'object') {
    return false;
  }
  return (data as { type?: unknown }).type === BOND_HOST_MESSAGE_REQUEST_RESIZE;
}

/**
 * Measures embed content height from a root element so min-h-screen does not inflate iframe size.
 */
export function measurePortalEmbedContentHeight(root: HTMLElement | null): number {
  const documentHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
    document.documentElement.offsetHeight,
  );

  if (!root) {
    return documentHeight;
  }

  const styles = window.getComputedStyle(root);
  const marginTop = parseFloat(styles.marginTop) || 0;
  const marginBottom = parseFloat(styles.marginBottom) || 0;
  const rootHeight = Math.max(root.scrollHeight, root.offsetHeight);

  return Math.ceil(Math.max(rootHeight + marginTop + marginBottom, documentHeight));
}
