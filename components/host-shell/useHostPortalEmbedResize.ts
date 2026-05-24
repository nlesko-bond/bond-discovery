'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  isBondHostRequestResizeMessage,
  isPortalEmbedFrame,
  measurePortalEmbedContentHeight,
} from '@/lib/host-shell/embed-resize';

const IFRAME_RESIZE_DEBOUNCE_MS = 100;
const IFRAME_INITIAL_RESIZE_DELAY_MS = 500;

interface IUseHostPortalEmbedResizeOptions {
  slug: string;
  remeasureKeys: readonly unknown[];
}

/**
 * Posts content height to bond-host parent for seamless iframe sizing.
 */
export function useHostPortalEmbedResize(
  rootRef: RefObject<HTMLElement | null>,
  { slug, remeasureKeys }: IUseHostPortalEmbedResizeOptions,
): boolean {
  const [isEmbedded, setIsEmbedded] = useState(false);
  const rootRefStable = useRef(rootRef);
  rootRefStable.current = rootRef;

  useEffect(() => {
    const embedded = isPortalEmbedFrame();
    setIsEmbedded(embedded);
    if (!embedded) {
      return;
    }

    let resizeTimeout: ReturnType<typeof setTimeout>;

    const sendHeight = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        window.parent.postMessage(
          {
            type: 'discovery-resize',
            height: measurePortalEmbedContentHeight(rootRefStable.current.current),
            slug,
          },
          '*',
        );
      }, IFRAME_RESIZE_DEBOUNCE_MS);
    };

    const onMessage = (event: MessageEvent) => {
      if (isBondHostRequestResizeMessage(event.data)) {
        sendHeight();
      }
    };

    window.scrollTo(0, 0);
    sendHeight();
    const initialResizeTimer = setTimeout(sendHeight, IFRAME_INITIAL_RESIZE_DELAY_MS);

    const resizeObserver = new ResizeObserver(sendHeight);
    const root = rootRefStable.current.current;
    if (root) {
      resizeObserver.observe(root);
    }
    resizeObserver.observe(document.body);
    window.addEventListener('resize', sendHeight);
    window.addEventListener('message', onMessage);

    return () => {
      clearTimeout(resizeTimeout);
      clearTimeout(initialResizeTimer);
      resizeObserver.disconnect();
      window.removeEventListener('resize', sendHeight);
      window.removeEventListener('message', onMessage);
    };
  }, [slug, ...remeasureKeys]);

  return isEmbedded;
}
