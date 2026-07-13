/**
 * Tests for the partner host kit (public/bond-host/v1.js).
 *
 * The kit is a plain static ES5 IIFE with no build step. We load it by reading
 * the file and evaluating it inside the jsdom window (which also acts as a
 * syntax/parse check), stub the /api/host/bootstrap fetch, then exercise the
 * window "message" handler by dispatching MessageEvents — exactly how the kit
 * receives BOND_GTM_EVENT conversion messages from the Bond checkout iframe.
 */
import fs from 'fs';
import path from 'path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const DISCOVERY_ORIGIN = 'https://discovery.bond.example';
const CONSUMER_ORIGIN = 'https://consumer.bond.example';

const bootstrap = {
  discoveryOrigin: DISCOVERY_ORIGIN,
  consumerOrigin: CONSUMER_ORIGIN,
  partnerPublicOrigin: 'https://partner.example',
  linkSeoPathPrefix: '/programs',
  checkoutLandingPath: '/programs/register',
  paths: {
    portalDiscoveryUrl: DISCOVERY_ORIGIN + '/portal/test-club',
  },
};

const win = window as unknown as Record<string, unknown> & Window;

function sendMessage(data: unknown, origin: string) {
  window.dispatchEvent(new MessageEvent('message', { data, origin }));
}

function gtmMessage(dataLayerEvent: unknown) {
  return { type: 'BOND_GTM_EVENT', dataLayerEvent };
}

function getDataLayer(): unknown[] {
  return (win as Record<string, unknown>).dataLayer as unknown[];
}

function getActiveIframe(): HTMLIFrameElement {
  const iframe = document.querySelector<HTMLIFrameElement>(
    'iframe[data-bond-discovery-iframe="1"]',
  );
  if (!iframe) throw new Error('discovery iframe not mounted');
  return iframe;
}

async function waitForIframe(mount: HTMLElement) {
  for (let i = 0; i < 50; i++) {
    if (mount.querySelector('iframe')) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('kit did not mount the discovery iframe');
}

const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => bootstrap,
}));

function getBondHost() {
  return (win as Record<string, unknown>).BondHost as {
    init: (options: Record<string, unknown>) => Promise<void>;
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 4000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

beforeAll(async () => {
  vi.stubGlobal('fetch', fetchMock);

  const source = fs.readFileSync(
    path.resolve(__dirname, '../../../public/bond-host/v1.js'),
    'utf8',
  );
  // Evaluating the IIFE in the jsdom window doubles as a syntax/parse check.
  // eslint-disable-next-line no-new-func
  new Function(source)();

  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const bondHost = (win as Record<string, unknown>).BondHost as {
    init: (options: Record<string, unknown>) => Promise<void>;
  };
  expect(bondHost).toBeDefined();
  await bondHost.init({
    mount,
    slug: 'test-club',
    discoveryBase: DISCOVERY_ORIGIN,
  });
  await waitForIframe(mount);
});

beforeEach(() => {
  (win as Record<string, unknown>).dataLayer = [];
  delete (win as Record<string, unknown>).__bondGtmListenerAttached;
});

describe('bond-host kit BOND_GTM_EVENT forwarding', () => {
  it('forwards ecommerce events from the consumer origin, clearing ecommerce first', () => {
    const payload = {
      event: 'purchase',
      ecommerce: { transaction_id: 't1', value: 50, currency: 'USD', items: [] },
    };
    sendMessage(gtmMessage(payload), CONSUMER_ORIGIN);
    expect(getDataLayer()).toEqual([{ ecommerce: null }, payload]);
  });

  it('forwards non-ecommerce events without a preceding ecommerce reset', () => {
    const payload = { event: 'log_in' };
    sendMessage(gtmMessage(payload), CONSUMER_ORIGIN);
    expect(getDataLayer()).toEqual([payload]);
  });

  it('ignores events from unknown origins', () => {
    sendMessage(gtmMessage({ event: 'purchase', ecommerce: {} }), 'https://evil.example');
    expect(getDataLayer()).toEqual([]);
  });

  it('ignores GTM events from the discovery origin (consumer origin only)', () => {
    sendMessage(gtmMessage({ event: 'purchase', ecommerce: {} }), DISCOVERY_ORIGIN);
    expect(getDataLayer()).toEqual([]);
  });

  it('ignores malformed payloads without throwing', () => {
    expect(() => {
      sendMessage({ type: 'BOND_GTM_EVENT' }, CONSUMER_ORIGIN);
      sendMessage(gtmMessage(null), CONSUMER_ORIGIN);
      sendMessage(gtmMessage('purchase'), CONSUMER_ORIGIN);
      sendMessage(gtmMessage({ event: 42 }), CONSUMER_ORIGIN);
      sendMessage(gtmMessage({ noEvent: true }), CONSUMER_ORIGIN);
    }).not.toThrow();
    expect(getDataLayer()).toEqual([]);
  });

  it('does not double-fire when the manual Bond listener sentinel is set', () => {
    (win as Record<string, unknown>).__bondGtmListenerAttached = true;
    sendMessage(
      gtmMessage({ event: 'purchase', ecommerce: { transaction_id: 't2' } }),
      CONSUMER_ORIGIN,
    );
    expect(getDataLayer()).toEqual([]);
  });

  it('still resizes the active iframe on bond:resize (regression)', () => {
    sendMessage({ type: 'bond:resize', height: 900 }, DISCOVERY_ORIGIN);
    expect(getActiveIframe().style.height).toBe('900px');
  });

  it('mounts discovery iframe without internal scrolling', () => {
    const iframe = getActiveIframe();
    expect(iframe.getAttribute('scrolling')).toBe('no');
    expect(iframe.style.overflow).toBe('hidden');
  });

  it('scrolls the partner page when the discovery iframe posts bond:scroll', () => {
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    sendMessage({ type: 'bond:scroll', deltaY: 80, deltaX: 0 }, DISCOVERY_ORIGIN);
    expect(scrollBy).toHaveBeenCalledWith({ top: 80, left: 0, behavior: 'auto' });
    scrollBy.mockRestore();
  });
});

describe('bond-host kit register tab opening', () => {
  it('opens exactly one tab per open_tab message, without a features string, and severs opener', () => {
    const openedWindow = { opener: {} as unknown };
    const open = vi
      .spyOn(window, 'open')
      .mockReturnValue(openedWindow as unknown as Window);

    sendMessage({ type: 'bond:open_tab', path: '/activity/x', search: '?productId=1' }, DISCOVERY_ORIGIN);

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(
      'https://partner.example/programs/register?bondPath=' +
        encodeURIComponent('/activity/x?productId=1'),
      '_blank',
    );
    expect(openedWindow.opener).toBeNull();

    // Same URL again immediately (double-delivered message / Firefox double-fire) → deduped.
    sendMessage({ type: 'bond:open_tab', path: '/activity/x', search: '?productId=1' }, DISCOVERY_ORIGIN);
    expect(open).toHaveBeenCalledTimes(1);

    // A different registration path is a legitimate new tab.
    sendMessage({ type: 'bond:open_tab', path: '/activity/y', search: '' }, DISCOVERY_ORIGIN);
    expect(open).toHaveBeenCalledTimes(2);

    open.mockRestore();
  });
});

describe('bond-host kit checkout iframe sizing', () => {
  async function mountCheckout(mountAttrs: Record<string, string> = {}) {
    window.history.replaceState(
      null,
      '',
      '/discovery/register?bondPath=' + encodeURIComponent('/activity/checkout?productId=1'),
    );
    const mount = document.createElement('div');
    Object.entries(mountAttrs).forEach(([k, v]) => mount.setAttribute(k, v));
    document.body.appendChild(mount);
    const bondHost = (win as Record<string, unknown>).BondHost as {
      init: (options: Record<string, unknown>) => Promise<void>;
    };
    await bondHost.init({ mount, slug: 'test-club', discoveryBase: DISCOVERY_ORIGIN });
    await waitForIframe(mount);
    const iframe = mount.querySelector<HTMLIFrameElement>(
      'iframe[data-bond-checkout-iframe="1"]',
    );
    if (!iframe) throw new Error('checkout iframe not mounted');
    return { mount, iframe };
  }

  afterEach(() => {
    window.history.replaceState(null, '', '/');
    document
      .querySelectorAll('iframe[data-bond-checkout-iframe="1"]')
      .forEach((el) => el.parentElement?.remove());
  });

  function stubInnerHeight(px: number) {
    Object.defineProperty(window, 'innerHeight', {
      value: px,
      configurable: true,
      writable: true,
    });
  }

  it('auto-fits checkout height to the viewport below the mount when no offset attr is set', async () => {
    // Tall viewport so the fitted height sits above the checkout fallback floor
    // and the reserve math itself is what's asserted.
    stubInnerHeight(1400);
    try {
      const { mount, iframe } = await mountCheckout();
      vi.spyOn(mount, 'getBoundingClientRect').mockReturnValue({
        top: 200,
      } as DOMRect);
      window.dispatchEvent(new Event('resize'));
      expect(iframe.style.height).toBe('1200px');
    } finally {
      stubInnerHeight(768);
    }
  });

  it('fits to the viewport minus chrome on the default (short) jsdom viewport', async () => {
    // Registration contract: the fitted height wins even when small, so the
    // checkout's sticky footer is visible without scrolling the partner page.
    const { mount, iframe } = await mountCheckout();
    vi.spyOn(mount, 'getBoundingClientRect').mockReturnValue({
      top: 200,
    } as DOMRect);
    window.dispatchEvent(new Event('resize'));
    expect(iframe.style.height).toBe(`${window.innerHeight - 200}px`);
  });

  it('caps the reserved chrome at half the viewport and enforces the min height', async () => {
    const { mount, iframe } = await mountCheckout();
    vi.spyOn(mount, 'getBoundingClientRect').mockReturnValue({
      top: window.innerHeight * 2,
    } as DOMRect);
    window.dispatchEvent(new Event('resize'));
    const reserved = Math.round(window.innerHeight * 0.5);
    expect(iframe.style.height).toBe(
      `${Math.max(window.innerHeight - reserved, 480)}px`,
    );
  });

  it('keeps the legacy calc(100dvh - offset) sizing when the offset attr is set', async () => {
    const { iframe } = await mountCheckout({ 'data-bond-chrome-offset-px': '80' });
    expect(iframe.style.height).toBe('calc(100dvh - 80px)');
    expect(iframe.style.minHeight).toBe('calc(100dvh - 80px)');
    window.dispatchEvent(new Event('resize'));
    expect(iframe.style.height).toBe('calc(100dvh - 80px)');
  });

  it('a bond:resize from the checkout sets the exact reported height', async () => {
    const { iframe } = await mountCheckout();
    sendMessage({ type: 'bond:resize', height: 600 }, CONSUMER_ORIGIN);
    expect(iframe.style.height).toBe('600px');
    expect(iframe.style.minHeight).toBe('600px');
  });

  it('stops auto-fitting once the checkout posts its own bond:resize height', async () => {
    const { mount, iframe } = await mountCheckout();
    sendMessage({ type: 'bond:resize', height: 1200 }, CONSUMER_ORIGIN);
    expect(iframe.style.height).toBe('1200px');
    vi.spyOn(mount, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect);
    window.dispatchEvent(new Event('resize'));
    expect(iframe.style.height).toBe('1200px');
  });
});

describe('bond-host kit bondPath validation', () => {
  const mounts: HTMLElement[] = [];

  async function initWithBondPath(bondPath: string) {
    window.history.replaceState(
      null,
      '',
      '/discovery/register?bondPath=' + encodeURIComponent(bondPath),
    );
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    mounts.push(mount);
    await getBondHost().init({ mount, slug: 'test-club', discoveryBase: DISCOVERY_ORIGIN });
    await waitForIframe(mount);
    return mount;
  }

  afterEach(() => {
    window.history.replaceState(null, '', '/');
    mounts.splice(0).forEach((el) => el.remove());
  });

  it('mounts checkout on the consumer origin for a normal absolute path', async () => {
    const mount = await initWithBondPath('/activity/checkout?productId=1');
    const iframe = mount.querySelector<HTMLIFrameElement>(
      'iframe[data-bond-checkout-iframe="1"]',
    );
    expect(iframe?.src).toBe(CONSUMER_ORIGIN + '/activity/checkout?productId=1');
  });

  // Each of these, appended to consumerOrigin, would (or could) resolve to a
  // foreign host — e.g. 'https://consumer.bond.example.evil.com'. The kit must
  // refuse them and fall back to the discovery page.
  [
    '.evil.com/checkout',
    '@evil.com/checkout',
    ':8080@evil.com/checkout',
    '//evil.com/checkout',
    '/\\evil.com/checkout',
    'https://evil.com/checkout',
  ].forEach((bad) => {
    it(`rejects non-same-origin bondPath ${JSON.stringify(bad)}`, async () => {
      const mount = await initWithBondPath(bad);
      expect(mount.querySelector('iframe[data-bond-checkout-iframe="1"]')).toBeNull();
      expect(mount.querySelector('iframe[data-bond-discovery-iframe="1"]')).not.toBeNull();
    });
  });
});

describe('bond-host kit bootstrap retry', () => {
  const mounts: HTMLElement[] = [];

  function initMount() {
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    mounts.push(mount);
    getBondHost().init({ mount, slug: 'test-club', discoveryBase: DISCOVERY_ORIGIN });
    return mount;
  }

  beforeEach(() => {
    fetchMock.mockClear();
  });

  afterEach(() => {
    mounts.splice(0).forEach((el) => el.remove());
  });

  it('retries once after a network error and still mounts', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network failure'));
    const mount = initMount();
    await waitFor(() => mount.querySelector('iframe[data-bond-discovery-iframe="1"]') !== null);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries once after a 5xx response and still mounts', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 } as unknown as Awaited<
      ReturnType<typeof fetchMock>
    >);
    const mount = initMount();
    await waitFor(() => mount.querySelector('iframe[data-bond-discovery-iframe="1"]') !== null);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 404 and shows the fallback message', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 } as unknown as Awaited<
      ReturnType<typeof fetchMock>
    >);
    const mount = initMount();
    await waitFor(() => mount.textContent === 'Programs could not be loaded.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
