import { describe, expect, it } from 'vitest';
import {
  ageFromBirthDate,
  formatDisplayName,
  jerseySortValue,
  redactParticipant,
  resolveExpand,
  sortParticipants,
} from '@/lib/roster-privacy';
import {
  DEFAULT_ROSTER_FIELD_VISIBILITY,
  type BondParticipant,
  type RosterFieldVisibility,
  type RosterParticipant,
} from '@/types/rosters';

/** A participant with every PII block populated, as Bond would return it. */
const RAW: BondParticipant = {
  rosterParticipantId: 12345,
  userId: 67890,
  customerId: 11111,
  firstName: 'John',
  lastName: 'Doe',
  birthDate: '2005-06-15',
  gender: 'MALE',
  pictureUrl: 'https://example.com/photo.jpg',
  contact: { email: 'john@example.com', phoneNumber: '+1234567890' },
  registration: {
    waiverSigned: true,
    waiverSignedDate: '2024-01-10',
    registrationDate: '2024-01-08',
    productNames: ['Summer League 2024'],
  },
  playerInfo: { jerseyNumber: 7, position: 'Forward', teamRole: 'league_v2_player' },
  group: {
    groupId: 333,
    groupName: 'Blue Team',
    groupMetaType: 'TEAM',
    parentGroupId: 222,
    parentGroupName: 'Division A',
  },
  primary: {
    userId: 44444,
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'guardian@example.com',
    phoneNumber: '+0987654321',
  },
  deletedAt: null,
};

const named = (over: Partial<RosterFieldVisibility> = {}): RosterFieldVisibility => ({
  ...DEFAULT_ROSTER_FIELD_VISIBILITY,
  nameMode: 'full',
  ...over,
});

/** Every key that must never appear in a public payload. */
const PII_KEYS = [
  'email',
  'phone',
  'birthDate',
  'age',
  'gender',
  'waiverSigned',
  'waiverSignedDate',
  'registrationDate',
  'productNames',
  'guardianName',
] as const;

describe('formatDisplayName', () => {
  it('renders full names', () => {
    expect(formatDisplayName('John', 'Doe', 'full')).toBe('John Doe');
  });

  it('renders first name + last initial', () => {
    expect(formatDisplayName('John', 'Doe', 'lastInitial')).toBe('John D.');
  });

  it('renders first initial + last name', () => {
    expect(formatDisplayName('John', 'Doe', 'firstInitial')).toBe('J. Doe');
  });

  it('never leaks a name in numberOnly mode', () => {
    expect(formatDisplayName('John', 'Doe', 'numberOnly')).toBe('Player');
  });

  it('falls back to a neutral label when both names are missing', () => {
    for (const mode of ['full', 'lastInitial', 'firstInitial', 'numberOnly'] as const) {
      expect(formatDisplayName('', '', mode)).toBe('Player');
      expect(formatDisplayName(undefined, undefined, mode)).toBe('Player');
    }
  });

  it('degrades gracefully when only one name is present', () => {
    expect(formatDisplayName('John', '', 'lastInitial')).toBe('John');
    expect(formatDisplayName('', 'Doe', 'lastInitial')).toBe('D.');
    expect(formatDisplayName('John', '', 'firstInitial')).toBe('J.');
    expect(formatDisplayName('', 'Doe', 'firstInitial')).toBe('Doe');
  });
});

describe('resolveExpand', () => {
  it('never requests a PII block for a public viewer', () => {
    const expand = resolveExpand('public', named());
    for (const pii of ['contact', 'primary', 'primaryContact', 'registration']) {
      expect(expand).not.toContain(pii);
    }
  });

  it('requests playerInfo only when a playerInfo field is shown', () => {
    expect(resolveExpand('public', named())).toContain('playerInfo');
    const none = named({ showJerseyNumber: false, showPosition: false, showTeamRole: false });
    expect(resolveExpand('public', none)).not.toContain('playerInfo');
  });

  it('requests guardian blocks when staff contact comes from the primary account', () => {
    const expand = resolveExpand('staff', named({ contactSource: 'primary' }));
    expect(expand).toContain('primary');
    expect(expand).toContain('primaryContact');
    expect(expand).not.toContain('contact');
  });

  it('requests the participant contact block only when configured to', () => {
    const expand = resolveExpand('staff', named({ contactSource: 'participant' }));
    expect(expand).toContain('contact');
  });

  it('omits registration when neither waiver nor registration is shown', () => {
    const v = named({ staffShowWaiver: false, staffShowRegistration: false });
    expect(resolveExpand('staff', v)).not.toContain('registration');
  });

  it('returns no duplicates', () => {
    const expand = resolveExpand('staff', named());
    expect(expand.length).toBe(new Set(expand).size);
  });
});

describe('redactParticipant — public mode', () => {
  it('emits no PII key at all, even when the raw record has every field', () => {
    const out = redactParticipant(RAW, named(), 'public');
    for (const key of PII_KEYS) {
      expect(out).not.toHaveProperty(key);
    }
  });

  it('emits only the four public fields plus group context', () => {
    const out = redactParticipant(RAW, named(), 'public');
    expect(Object.keys(out).sort()).toEqual(
      ['displayName', 'groupId', 'groupName', 'id', 'jerseyNumber', 'parentGroupId', 'parentGroupName', 'position', 'teamRole'].sort()
    );
  });

  it('never emits a last name in numberOnly mode', () => {
    const out = redactParticipant(RAW, named({ nameMode: 'numberOnly' }), 'public');
    expect(out.displayName).toBe('Player');
    expect(JSON.stringify(out)).not.toContain('Doe');
  });

  it('never emits a full last name in lastInitial mode', () => {
    const out = redactParticipant(RAW, named({ nameMode: 'lastInitial' }), 'public');
    expect(out.displayName).toBe('John D.');
    expect(JSON.stringify(out)).not.toContain('Doe');
  });

  it('suppresses the photo when the roster is de-identified', () => {
    const v = named({ nameMode: 'numberOnly', showPhoto: true });
    expect(redactParticipant(RAW, v, 'public').photoUrl).toBeUndefined();
  });

  it('emits the photo when names are shown and photos are enabled', () => {
    const v = named({ nameMode: 'full', showPhoto: true });
    expect(redactParticipant(RAW, v, 'public').photoUrl).toBe('https://example.com/photo.jpg');
  });

  it('omits jersey, position and role when switched off', () => {
    const v = named({ showJerseyNumber: false, showPosition: false, showTeamRole: false });
    const out = redactParticipant(RAW, v, 'public');
    expect(out).not.toHaveProperty('jerseyNumber');
    expect(out).not.toHaveProperty('position');
    expect(out).not.toHaveProperty('teamRole');
  });
});

describe('redactParticipant — staff mode', () => {
  it('emits guardian contact when contactSource is primary', () => {
    const out = redactParticipant(RAW, named({ contactSource: 'primary' }), 'staff');
    expect(out.email).toBe('guardian@example.com');
    expect(out.phone).toBe('+0987654321');
    expect(out.contactIsGuardian).toBe(true);
  });

  it('emits the participant contact when contactSource is participant', () => {
    const out = redactParticipant(RAW, named({ contactSource: 'participant' }), 'staff');
    expect(out.email).toBe('john@example.com');
    expect(out.contactIsGuardian).toBe(false);
  });

  it('emits waiver and registration detail', () => {
    const out = redactParticipant(RAW, named(), 'staff', new Date('2026-08-14T00:00:00Z'));
    expect(out.waiverSigned).toBe(true);
    expect(out.waiverSignedDate).toBe('2024-01-10');
    expect(out.registrationDate).toBe('2024-01-08');
    expect(out.productNames).toEqual(['Summer League 2024']);
    expect(out.guardianName).toBe('Jane Doe');
    expect(out.age).toBe(21);
  });

  it('honours each staff switch independently', () => {
    const v = named({
      staffShowContact: false,
      staffShowBirthDate: false,
      staffShowWaiver: false,
      staffShowRegistration: false,
      staffShowGuardian: false,
    });
    const out = redactParticipant(RAW, v, 'staff');
    for (const key of PII_KEYS) {
      expect(out).not.toHaveProperty(key);
    }
  });

  it('does not emit gender unless explicitly enabled', () => {
    expect(redactParticipant(RAW, named(), 'staff')).not.toHaveProperty('gender');
    expect(redactParticipant(RAW, named({ staffShowGender: true }), 'staff').gender).toBe('MALE');
  });
});

describe('team role formatting', () => {
  it('humanizes Bond role tokens instead of leaking the enum', () => {
    const out = redactParticipant(RAW, named(), 'public');
    // RAW carries teamRole: 'league_v2_player'
    expect(out.teamRole).toBe('Player');
  });

  it('handles captain and invited variants', () => {
    const captain = { ...RAW, playerInfo: { ...RAW.playerInfo, teamRole: 'league_v2_captain' } };
    const invited = {
      ...RAW,
      playerInfo: { ...RAW.playerInfo, teamRole: 'league_v2_invited_player' },
    };
    expect(redactParticipant(captain, named(), 'public').teamRole).toBe('Captain');
    expect(redactParticipant(invited, named(), 'public').teamRole).toBe('Invited player');
  });
});

describe('redactParticipant — identity', () => {
  it('prefers the roster participant id', () => {
    expect(redactParticipant(RAW, named(), 'public').id).toBe('12345');
  });

  it('falls back to the event participant id, then the user id', () => {
    const evt = { ...RAW, rosterParticipantId: undefined, eventParticipantId: 999 };
    expect(redactParticipant(evt, named(), 'public').id).toBe('999');
    const bare = { ...RAW, rosterParticipantId: undefined, eventParticipantId: undefined };
    expect(redactParticipant(bare, named(), 'public').id).toBe('67890');
  });

  it('handles a participant with no expanded blocks at all', () => {
    const bare: BondParticipant = { userId: 1, firstName: 'A', lastName: 'B' };
    const out = redactParticipant(bare, named(), 'staff');
    expect(out).toEqual({ id: '1', displayName: 'A B' });
  });
});

describe('ageFromBirthDate', () => {
  const now = new Date('2026-08-14T00:00:00Z');

  it('computes whole years', () => {
    expect(ageFromBirthDate('2005-06-15', now)).toBe(21);
  });

  it('does not count a birthday that has not happened yet this year', () => {
    expect(ageFromBirthDate('2005-08-15', now)).toBe(20);
    expect(ageFromBirthDate('2005-08-14', now)).toBe(21);
  });

  it('returns undefined for missing or unparseable dates', () => {
    expect(ageFromBirthDate(undefined, now)).toBeUndefined();
    expect(ageFromBirthDate(null, now)).toBeUndefined();
    expect(ageFromBirthDate('not-a-date', now)).toBeUndefined();
  });

  it('rejects implausible ages', () => {
    expect(ageFromBirthDate('2030-01-01', now)).toBeUndefined();
    expect(ageFromBirthDate('1800-01-01', now)).toBeUndefined();
  });
});

describe('sorting', () => {
  it('treats "00" as zero and sorts missing numbers last', () => {
    expect(jerseySortValue('00')).toBe(0);
    expect(jerseySortValue('7')).toBe(7);
    expect(jerseySortValue(undefined)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('orders by jersey number, then name', () => {
    const list = [
      { id: '1', displayName: 'Zoe', jerseyNumber: '12' },
      { id: '2', displayName: 'Amy' },
      { id: '3', displayName: 'Bob', jerseyNumber: '00' },
      { id: '4', displayName: 'Cal', jerseyNumber: '2' },
    ] as RosterParticipant[];
    expect(sortParticipants(list).map((p) => p.displayName)).toEqual(['Bob', 'Cal', 'Zoe', 'Amy']);
  });

  it('does not mutate the input', () => {
    const list = [
      { id: '1', displayName: 'B', jerseyNumber: '2' },
      { id: '2', displayName: 'A', jerseyNumber: '1' },
    ] as RosterParticipant[];
    sortParticipants(list);
    expect(list[0].displayName).toBe('B');
  });
});
