export const BOND_HOST_MESSAGE_REQUEST_RESIZE = 'bond:request-resize';
export const PORTAL_EMBED_CONTENT_CHANGE_EVENT = 'bond-portal-embed-content-change';

const PORTAL_EMBED_HTML_CLASS = 'bond-portal-embed';

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
