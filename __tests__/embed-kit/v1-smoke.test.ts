import { readFileSync } from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockProgram, mockProgramNoSessions } from '../fixtures/mockData';

const KIT_PATH = path.join(process.cwd(), 'public/embed-kit/v1.js');
const BASE_URL = 'http://localhost:3000';
const SLUG = 'test-page';

function mockBootstrap(overrides?: { portalTemplate?: string; linkBehavior?: string }) {
  return {
    slug: SLUG,
    origin: BASE_URL,
    branding: {
      primaryColor: '#1E2761',
      secondaryColor: '#6366F1',
      accentColor: '#8B5CF6',
      companyName: 'Test Facility',
      logo: 'https://example.com/logo.png',
    },
    features: {
      linkBehavior: overrides?.linkBehavior ?? 'new_tab',
      defaultView: 'programs',
      embedPortalTemplate: overrides?.portalTemplate ?? 'classic',
      hideRegistrationLinks: false,
      enabledTabs: ['programs', 'schedule'],
      showPricing: true,
      showAvailability: true,
      showAgeGender: true,
    },
    paths: {
      fullDiscoveryUrl: `${BASE_URL}/${SLUG}`,
      embedIframeUrl: `${BASE_URL}/embed/${SLUG}`,
      programsApi: `${BASE_URL}/api/embed/programs?slug=${SLUG}`,
      eventsApi: `${BASE_URL}/api/events?slug=${SLUG}`,
    },
  };
}

function loadBondDiscovery(): { init: (options: object) => void } {
  const code = readFileSync(KIT_PATH, 'utf8');
  const runner = new Function(
    'window',
  `${code}\n;return window.BondDiscovery;`,
  ) as (w: Window) => { init: (options: object) => void };
  const api = runner(window);
  if (!api || typeof api.init !== 'function') {
    throw new Error('BondDiscovery.init was not exported from embed kit');
  }
  return api;
}

function mockFetch(programs: unknown[]) {
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/embed/bootstrap')) {
      return Promise.resolve({
        ok: true,
        json: async () => mockBootstrap(),
      } as Response);
    }
    if (url.includes('/api/embed/programs')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: programs }),
      } as Response);
    }
    if (url.includes('/api/events')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

async function flushInit(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

describe('embed kit v1.js smoke', () => {
  let mount: HTMLDivElement;

  beforeEach(() => {
    mount = document.createElement('div');
    mount.id = 'bond-embed-mount';
    document.body.appendChild(mount);
    mockFetch([mockProgram, mockProgramNoSessions]);
  });

  afterEach(() => {
    mount.remove();
    vi.restoreAllMocks();
  });

  it('init renders program cards without ReferenceError', async () => {
    const BondDiscovery = loadBondDiscovery();
    BondDiscovery.init({ mount, slug: SLUG, baseUrl: BASE_URL });
    await flushInit();

    const shell = mount.shadowRoot?.querySelector('.bd-shell');
    expect(shell).toBeTruthy();

    const cards = mount.shadowRoot?.querySelectorAll('.bd-card');
    expect(cards?.length).toBeGreaterThanOrEqual(1);

    const err = mount.shadowRoot?.querySelector('pre');
    expect(err).toBeFalsy();
  });

  it('hero-carousel template renders cards', async () => {
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/embed/bootstrap')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockBootstrap({ portalTemplate: 'hero-carousel' }),
        } as Response);
      }
      if (url.includes('/api/embed/programs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [mockProgram] }),
        } as Response);
      }
      if (url.includes('/api/events')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const BondDiscovery = loadBondDiscovery();
    BondDiscovery.init({
      mount,
      slug: SLUG,
      baseUrl: BASE_URL,
      portalTemplate: 'hero-carousel',
    });
    await flushInit();

    expect(mount.shadowRoot?.querySelector('.bd-carousel .bd-card')).toBeTruthy();
    expect(mount.shadowRoot?.querySelector('pre')).toBeFalsy();
  });

  it('in_frame uses same-window navigation without iframe overlay', async () => {
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/embed/bootstrap')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockBootstrap({ linkBehavior: 'in_frame' }),
        } as Response);
      }
      if (url.includes('/api/embed/programs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [mockProgram] }),
        } as Response);
      }
      if (url.includes('/api/events')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const BondDiscovery = loadBondDiscovery();
    BondDiscovery.init({ mount, slug: SLUG, baseUrl: BASE_URL });
    await flushInit();

    const register = mount.shadowRoot?.querySelector('a.bd-btn:not(.bd-detail-link)');
    expect(register?.getAttribute('target')).toBe('_self');
    expect(mount.shadowRoot?.querySelector('.bd-overlay')).toBeFalsy();
  });
});
