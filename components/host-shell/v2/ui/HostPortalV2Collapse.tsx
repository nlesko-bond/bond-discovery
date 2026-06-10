'use client';

import { useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface IHostPortalV2CollapseProps {
  open: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * In-flow animated collapse — the v2 portal's ONLY disclosure mechanism.
 *
 * WHY INLINE EXPANSION (iframe constraint, plan 009 invariant): the portal
 * renders in a content-sized iframe, so a floating popover anchored near the
 * page bottom gets CLIPPED by the iframe edge, and `position: fixed` is
 * forbidden (it would detach from the visual viewport). Instead, every filter
 * panel expands IN normal document flow and pushes content down; the
 * ResizeObserver inside `useHostPortalEmbedResize` sees the height change and
 * the parent kit grows the iframe — nothing can ever clip.
 *
 * Height is animated with the grid-template-rows 0fr→1fr trick (no measured
 * max-height, no `height: auto` jank). `prefers-reduced-motion` disables the
 * transition. Closed content is hidden from AT (`aria-hidden`) and made
 * unfocusable (`inert`).
 */
export function HostPortalV2Collapse({
  open,
  id,
  className,
  children,
}: IHostPortalV2CollapseProps) {
  // React 18 has no first-class `inert` prop; manage the attribute via ref.
  const inertRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) {
        return;
      }
      if (open) {
        element.removeAttribute('inert');
      } else {
        element.setAttribute('inert', '');
      }
    },
    [open],
  );

  return (
    <div
      id={id}
      ref={inertRef}
      aria-hidden={!open}
      className={cn(
        'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        className,
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
