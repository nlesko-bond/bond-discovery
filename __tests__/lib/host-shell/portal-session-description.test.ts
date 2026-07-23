import { describe, expect, it } from 'vitest';
import {
  formatHostPortalSessionDescription,
  hasHostPortalSessionDescription,
} from '@/lib/host-shell/portal-session-description';

describe('hasHostPortalSessionDescription', () => {
  it('returns false when both fields are empty', () => {
    expect(hasHostPortalSessionDescription(undefined, '   ')).toBe(false);
  });

  it('returns true when either field has text', () => {
    expect(hasHostPortalSessionDescription('Short blurb', undefined)).toBe(true);
    expect(hasHostPortalSessionDescription(undefined, 'Longer copy')).toBe(true);
  });
});

describe('formatHostPortalSessionDescription', () => {
  it('deduplicates identical short and long descriptions', () => {
    expect(formatHostPortalSessionDescription('Same text', 'Same text')).toEqual({
      body: 'Same text',
    });
  });

  it('returns lead and body when both are distinct', () => {
    expect(
      formatHostPortalSessionDescription('Short summary', 'Longer details with more context'),
    ).toEqual({
      lead: 'Short summary',
      body: 'Longer details with more context',
    });
  });

  it('returns only long text when short is a prefix of long', () => {
    expect(
      formatHostPortalSessionDescription('Intro', 'Intro with additional paragraphs'),
    ).toEqual({
      body: 'Intro with additional paragraphs',
    });
  });

  it('decodes common HTML entities in description text', () => {
    expect(formatHostPortalSessionDescription(undefined, 'Ages 3&ndash;6 welcome')).toEqual({
      body: 'Ages 3–6 welcome',
    });
    expect(
      formatHostPortalSessionDescription("Soccer&rsquo;s very first hello.", undefined),
    ).toEqual({
      body: "Soccer\u2019s very first hello.",
    });
  });
});
