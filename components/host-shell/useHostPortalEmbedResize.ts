'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  bindPortalEmbedParentScrollForward,
  isBondHostRequestResizeMessage,
  isPortalEmbedFrame,
  lockPortalEmbedDocumentScroll,
  measurePortalEmbedContentHeight,
  PORTAL_EMBED_CONTENT_CHANGE_EVENT,
} from '@/lib/host-shell/embed-resize';

const IFRAME_RESIZE_DEBOUNCE_MS = 100;
const IFRAME_INITIAL_RESIZE_DELAY_MS = 500;
const IFRAME_COLLAPSE_ANIMATION_RESIZE_DELAY_MS = 250;

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
    let animationResizeTimeout: ReturnType<typeof setTimeout>;
    const unlockScroll = lockPortalEmbedDocumentScroll();
    const unbindParentScrollForward = bindPortalEmbedParentScrollForward();

    const sendHeight = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        window.scrollTo(0, 0);
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

    const sendHeightAfterAnimation = () => {
      clearTimeout(animationResizeTimeout);
      animationResizeTimeout = setTimeout(sendHeight, IFRAME_COLLAPSE_ANIMATION_RESIZE_DELAY_MS);
    };

    const onMessage = (event: MessageEvent) => {
      if (isBondHostRequestResizeMessage(event.data)) {
        sendHeight();
      }
    };

    const onContentChange = () => {
      sendHeight();
      sendHeightAfterAnimation();
    };

    sendHeight();
    const initialResizeTimer = setTimeout(sendHeight, IFRAME_INITIAL_RESIZE_DELAY_MS);

    const resizeObserver = new ResizeObserver(sendHeight);
    const root = rootRefStable.current.current;
    if (root) {
      resizeObserver.observe(root);
    }
    resizeObserver.observe(document.body);
    resizeObserver.observe(document.documentElement);

    window.addEventListener('resize', sendHeight);
    window.addEventListener('message', onMessage);
    window.addEventListener(PORTAL_EMBED_CONTENT_CHANGE_EVENT, onContentChange);

    return () => {
      clearTimeout(resizeTimeout);
      clearTimeout(animationResizeTimeout);
      clearTimeout(initialResizeTimer);
      resizeObserver.disconnect();
      window.removeEventListener('resize', sendHeight);
      window.removeEventListener('message', onMessage);
      window.removeEventListener(PORTAL_EMBED_CONTENT_CHANGE_EVENT, onContentChange);
      unlockScroll();
      unbindParentScrollForward();
    };
  }, [slug, ...remeasureKeys]);

  return isEmbedded;
}
