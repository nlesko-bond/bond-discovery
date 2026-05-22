import { describe, expect, it } from 'vitest';
import { getSportIconAssetPath } from '@/lib/host-shell/sport-visuals';

describe('getSportIconAssetPath', () => {
  it('maps sport keys to icn-sport-*.svg filenames', () => {
    expect(getSportIconAssetPath('soccer')).toBe('/icons/sports/icn-sport-soccer.svg');
    expect(getSportIconAssetPath('ice hockey')).toBe('/icons/sports/icn-sport-ice-hockey.svg');
    expect(getSportIconAssetPath('martial_arts')).toBe('/icons/sports/icn-sport-martial-arts.svg');
  });
});
