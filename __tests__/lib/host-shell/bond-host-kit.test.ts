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

beforeAll(async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => bootstrap,
    })),
  );

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

  it('auto-fits checkout height to the viewport below the mount when no offset attr is set', async () => {
    const { mount, iframe } = await mountCheckout();
    // jsdom: mount rect top is 0, innerHeight defaults to 768 → fills the viewport.
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
    window.dispatchEvent(new Event('resize'));
    expect(iframe.style.height).toBe('calc(100dvh - 80px)');
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
