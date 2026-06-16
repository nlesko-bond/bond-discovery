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
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
