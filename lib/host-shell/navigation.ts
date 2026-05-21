import { BOND_HOST_MESSAGE_OPEN_TAB } from '@/lib/host-shell/constants';

export interface IHostRegistrationPath {
  path: string;
  search: string;
}

/**
 * Parses a registration href into a path + search for the partner org domain URL bar.
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

export { BOND_HOST_MESSAGE_OPEN_TAB };
