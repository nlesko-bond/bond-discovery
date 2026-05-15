import { describe, expect, it } from 'vitest';
import { resolveEmbedPortalTemplate } from '@/lib/embed-portal-template';

describe('resolveEmbedPortalTemplate', () => {
  it('uses query when valid', () => {
    expect(resolveEmbedPortalTemplate('hero-carousel', 'classic')).toBe('hero-carousel');
  });

  it('ignores invalid query', () => {
    expect(resolveEmbedPortalTemplate('nope', 'schedule-first')).toBe('schedule-first');
  });

  it('falls back when query null', () => {
    expect(resolveEmbedPortalTemplate(null, undefined)).toBe('classic');
  });
});
