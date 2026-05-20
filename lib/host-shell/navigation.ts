import type { LinkBehavior } from '@/types';
import { BOND_HOST_MESSAGE_NAVIGATE } from '@/lib/host-shell/constants';

export interface IHostRegistrationPath {
  path: string;
  search: string;
}

/**
 * Parses a registration href into a path + search suitable for the partner host URL bar.
 */
export function parseHostRegistrationPath(href: string, consumerOrigin: string): IHostRegistrationPath {
  try {
    const base = consumerOrigin.endsWith('/') ? consumerOrigin : `${consumerOrigin}/`;
    const url = href.startsWith('http') ? new URL(href) : new URL(href, base);
    return { path: url.pathname, search: url.search };
  } catch {
    const q = href.indexOf('?');
    if (q === -1) {
      return { path: href.startsWith('/') ? href : `/${href}`, search: '' };
    }
    const path = href.slice(0, q);
    return {
      path: path.startsWith('/') ? path : `/${path}`,
      search: href.slice(q),
    };
  }
}

export function isHostRoutedLinkBehavior(linkBehavior: LinkBehavior | undefined): boolean {
  return linkBehavior === 'host_routed';
}

export function isInsidePartnerIframe(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.self !== window.top;
}

/**
 * When discovery runs in a partner iframe with host_routed, delegate navigation to bond-host.js on the parent page.
 */
export function tryHostRoutedRegistrationNavigate(
  href: string | undefined,
  linkBehavior: LinkBehavior | undefined,
  consumerOrigin: string = 'https://bondsports.co',
): boolean {
  if (!href || !isHostRoutedLinkBehavior(linkBehavior) || !isInsidePartnerIframe()) {
    return false;
  }
  const { path, search } = parseHostRegistrationPath(href, consumerOrigin);
  window.parent.postMessage(
    {
      type: BOND_HOST_MESSAGE_NAVIGATE,
      path,
      search,
    },
    '*',
  );
  return true;
}
