'use client';

import { useEffect } from 'react';
import { BOND_HOST_MESSAGE_OPEN_TAB } from '@/lib/host-shell/constants';
import { parseHostRegistrationPath } from '@/lib/host-shell/navigation';
import { DEFAULT_BOND_CONSUMER_ORIGIN } from '@/lib/host-shell/constants';

function isRegistrationAnchor(anchor: HTMLAnchorElement): boolean {
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#')) {
    return false;
  }
  if (href.includes('skipToProducts') || href.includes('productId=')) {
    return true;
  }
  return /\/programs\//i.test(href);
}

/**
 * Portal-only: intercepts register link clicks inside the discovery iframe and asks the
 * partner parent page (bond-host.js) to open org-domain checkout in a new tab.
 * Does not load on /{slug} or /embed routes.
 */
export function HostShellPortalBridge() {
  useEffect(() => {
    if (typeof window === 'undefined' || window.self === window.top) {
      return;
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const anchor = target.closest('a');
      if (!anchor || !isRegistrationAnchor(anchor)) {
        return;
      }
      const href = anchor.href || anchor.getAttribute('href') || '';
      if (!href) {
        return;
      }
      const { path, search } = parseHostRegistrationPath(href, DEFAULT_BOND_CONSUMER_ORIGIN);
      event.preventDefault();
      event.stopPropagation();
      window.parent.postMessage(
        {
          type: BOND_HOST_MESSAGE_OPEN_TAB,
          path,
          search,
        },
        '*',
      );
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
