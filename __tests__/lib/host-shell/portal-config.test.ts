import { describe, it, expect } from 'vitest';
import {
  isSessionsFirstPortalLayout,
  resolveHostPortalLayout,
} from '@/lib/host-shell/portal-config';
import { HostPortalLayoutEnum } from '@/types';
import { mockConfig } from '../../fixtures/mockData';

describe('portal-config layout', () => {
  it('defaults to legacy programs layout', () => {
    expect(resolveHostPortalLayout(mockConfig)).toBe(HostPortalLayoutEnum.LEGACY_PROGRAMS);
    expect(isSessionsFirstPortalLayout(mockConfig)).toBe(false);
  });

  it('detects sessions_first layout', () => {
    const config = {
      ...mockConfig,
      features: {
        ...mockConfig.features,
        hostPortalLayout: HostPortalLayoutEnum.SESSIONS_FIRST,
      },
    };
    expect(isSessionsFirstPortalLayout(config)).toBe(true);
  });
});
