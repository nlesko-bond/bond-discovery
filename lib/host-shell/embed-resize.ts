export const BOND_HOST_MESSAGE_REQUEST_RESIZE = 'bond:request-resize';

export function isPortalEmbedFrame(): boolean {
  return typeof window !== 'undefined' && window.self !== window.top;
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
  if (root) {
    const rect = root.getBoundingClientRect();
    const styles = window.getComputedStyle(root);
    const marginTop = parseFloat(styles.marginTop) || 0;
    const marginBottom = parseFloat(styles.marginBottom) || 0;
    return Math.ceil(root.scrollHeight + marginTop + marginBottom);
  }
  return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
}
