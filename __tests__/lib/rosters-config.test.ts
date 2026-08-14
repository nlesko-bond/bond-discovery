import { describe, expect, it } from 'vitest';
import {
  isReservedRosterSlug,
  normalizeBranding,
  normalizeFieldVisibility,
  normalizePinnedSessions,
  normalizeProgramFilter,
  normalizeRosterConfig,
  normalizeSessionWindow,
  normalizeSlug,
  DEFAULT_ROSTER_BRANDING,
  DEFAULT_SESSION_WINDOW,
} from '@/lib/rosters-config';
import { DEFAULT_ROSTER_FIELD_VISIBILITY } from '@/types/rosters';

describe('normalizeFieldVisibility', () => {
  it('defaults an empty object to the most private useful roster', () => {
    expect(normalizeFieldVisibility({})).toEqual(DEFAULT_ROSTER_FIELD_VISIBILITY);
  });

  it('falls back to the private default for an unknown name mode', () => {
    expect(normalizeFieldVisibility({ nameMode: 'everything' }).nameMode).toBe('numberOnly');
    expect(normalizeFieldVisibility({ nameMode: null }).nameMode).toBe('numberOnly');
  });

  it('accepts each valid name mode', () => {
    for (const mode of ['numberOnly', 'lastInitial', 'firstInitial', 'full'] as const) {
      expect(normalizeFieldVisibility({ nameMode: mode }).nameMode).toBe(mode);
    }
  });

  it('forces guardian contact on youth pages even when the row says otherwise', () => {
    const v = normalizeFieldVisibility({ contactSource: 'participant' }, true);
    expect(v.contactSource).toBe('primary');
  });

  it('honours participant contact on non-youth pages', () => {
    const v = normalizeFieldVisibility({ contactSource: 'participant' }, false);
    expect(v.contactSource).toBe('participant');
  });

  it('ignores non-boolean switch values rather than treating them as true', () => {
    const v = normalizeFieldVisibility({ showPhoto: 'yes', staffShowGender: 1 });
    expect(v.showPhoto).toBe(false);
    expect(v.staffShowGender).toBe(false);
  });
});

describe('normalizeProgramFilter', () => {
  it('defaults to all programs', () => {
    expect(normalizeProgramFilter(undefined)).toEqual({ mode: 'all', programIds: [] });
  });

  it('keeps include and exclude modes', () => {
    expect(normalizeProgramFilter({ mode: 'include', programIds: [1, 2] })).toEqual({
      mode: 'include',
      programIds: [1, 2],
    });
    expect(normalizeProgramFilter({ mode: 'exclude', programIds: ['3'] })).toEqual({
      mode: 'exclude',
      programIds: [3],
    });
  });

  it('drops non-numeric program ids', () => {
    expect(normalizeProgramFilter({ mode: 'include', programIds: [1, 'x', null] }).programIds).toEqual([1]);
  });

  it('does not coerce null, empty string, false or [] into id 0', () => {
    const ids = normalizeProgramFilter({
      mode: 'include',
      programIds: [null, '', false, [], {}, undefined, 5],
    }).programIds;
    expect(ids).toEqual([5]);
  });

  it('falls back to all for an unknown mode', () => {
    expect(normalizeProgramFilter({ mode: 'sometimes' }).mode).toBe('all');
  });
});

describe('normalizeSessionWindow', () => {
  it('defaults when absent', () => {
    expect(normalizeSessionWindow(undefined)).toEqual(DEFAULT_SESSION_WINDOW);
  });

  it('rejects negative and non-numeric day counts', () => {
    expect(normalizeSessionWindow({ pastDays: -10, futureDays: 'soon' })).toEqual(DEFAULT_SESSION_WINDOW);
  });

  it('accepts zero', () => {
    expect(normalizeSessionWindow({ pastDays: 0, futureDays: 0 })).toEqual({ pastDays: 0, futureDays: 0 });
  });
});

describe('normalizePinnedSessions', () => {
  it('keeps well-formed pins and drops malformed ones', () => {
    const pins = normalizePinnedSessions([
      { programId: 1, sessionId: 10 },
      { programId: 'x', sessionId: 11 },
      { programId: 2 },
      null,
    ]);
    expect(pins).toEqual([{ programId: 1, sessionId: 10 }]);
  });

  it('returns an empty list for a non-array', () => {
    expect(normalizePinnedSessions('nope')).toEqual([]);
  });
});

describe('normalizeBranding', () => {
  it('fills every missing key from the default', () => {
    expect(normalizeBranding({})).toEqual(DEFAULT_ROSTER_BRANDING);
  });

  it('keeps provided values and nulls empty optional strings', () => {
    const b = normalizeBranding({ primaryColor: '#123456', logoUrl: '', heroTitle: 'Rosters' });
    expect(b.primaryColor).toBe('#123456');
    expect(b.logoUrl).toBeNull();
    expect(b.heroTitle).toBe('Rosters');
  });
});

describe('normalizeRosterConfig', () => {
  const row = {
    id: 'uuid-1',
    slug: 'coppermine',
    name: 'Coppermine Rosters',
    is_active: true,
    organization_ids: [7, '8', 'x'],
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-02T00:00:00Z',
  };

  it('normalizes a minimal row without throwing', () => {
    const config = normalizeRosterConfig(row);
    expect(config.slug).toBe('coppermine');
    expect(config.organizationIds).toEqual([7, 8]);
    expect(config.fieldVisibility).toEqual(DEFAULT_ROSTER_FIELD_VISIBILITY);
    expect(config.sessionWindow).toEqual(DEFAULT_SESSION_WINDOW);
  });

  it('defaults an unpublished page to inactive and unindexed', () => {
    const config = normalizeRosterConfig({ ...row, is_active: undefined, allow_indexing: undefined });
    expect(config.isActive).toBe(false);
    expect(config.allowIndexing).toBe(false);
  });

  it('never exposes password hashes, only their presence', () => {
    const config = normalizeRosterConfig({
      ...row,
      viewer_password_hash: 'hash-a',
      staff_password_hash: 'hash-b',
    });
    expect(config.hasViewerPassword).toBe(true);
    expect(config.hasStaffPassword).toBe(true);
    expect(JSON.stringify(config)).not.toContain('hash-a');
    expect(JSON.stringify(config)).not.toContain('hash-b');
  });

  it('treats an empty hash as no password', () => {
    const config = normalizeRosterConfig({ ...row, viewer_password_hash: '' });
    expect(config.hasViewerPassword).toBe(false);
  });

  it('falls back to public for an unknown access mode', () => {
    expect(normalizeRosterConfig({ ...row, page_access: 'wide-open' }).pageAccess).toBe('public');
    expect(normalizeRosterConfig({ ...row, page_access: 'staff' }).pageAccess).toBe('staff');
  });

  it('applies the youth guardian-contact rule end to end', () => {
    const config = normalizeRosterConfig({
      ...row,
      is_youth: true,
      field_visibility: { contactSource: 'participant', nameMode: 'full' },
    });
    expect(config.fieldVisibility.contactSource).toBe('primary');
  });
});

describe('slugs', () => {
  it('lowercases and strips unsafe characters', () => {
    expect(normalizeSlug('Coppermine Rosters!')).toBe('coppermine-rosters');
    expect(normalizeSlug('--a__b--')).toBe('a-b');
  });

  it('flags reserved slugs that would collide with routes', () => {
    expect(isReservedRosterSlug('api')).toBe(true);
    expect(isReservedRosterSlug('Admin')).toBe(true);
    expect(isReservedRosterSlug('coppermine')).toBe(false);
  });
});
