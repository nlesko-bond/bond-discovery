import { describe, it, expect } from 'vitest';
import { buildHostBootstrapPayload, resolveHostShellSettings } from '@/lib/host-shell/bootstrap';
import { mockConfig } from '@/__tests__/fixtures/mockData';

describe('resolveHostShellSettings', () => {
  it('uses defaults when features omit host shell fields', () => {
    const settings = resolveHostShellSettings(mockConfig);
    expect(settings.consumerOrigin).toBe('https://bondsports.co');
    expect(settings.linkSeoPathPrefix).toBe('/programs');
    expect(settings.partnerPublicOrigin).toBeNull();
  });

  it('reads consumerOrigin from features', () => {
    const config = {
      ...mockConfig,
      features: {
        ...mockConfig.features,
        consumerOrigin: 'https://app.bondsports.co',
        linkSeoPathPrefix: '/register',
        partnerPublicOrigin: 'https://www.example.com',
      },
    };
    const settings = resolveHostShellSettings(config);
    expect(settings.consumerOrigin).toBe('https://app.bondsports.co');
    expect(settings.linkSeoPathPrefix).toBe('/register');
    expect(settings.partnerPublicOrigin).toBe('https://www.example.com');
  });
});

describe('buildHostBootstrapPayload', () => {
  it('includes portal discovery URL', () => {
    const payload = buildHostBootstrapPayload(mockConfig, 'https://discovery.test');
    expect(payload.paths.portalDiscoveryUrl).toBe(
      'https://discovery.test/portal/test-page',
    );
    expect(payload.slug).toBe('test-page');
  });
});
