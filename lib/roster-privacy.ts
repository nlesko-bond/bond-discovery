/**
 * The single choke point between Bond's participant records and anything we
 * send to a browser.
 *
 * Two rules hold this together and must survive any refactor:
 *
 * 1. `redactParticipant` builds a fresh object and only ever *adds* permitted
 *    keys. It never takes a raw participant and deletes from it. A public
 *    payload therefore contains no key hinting that contact data exists.
 * 2. `resolveExpand` asks Bond only for the blocks the viewer is allowed to
 *    see, so in public mode the PII never enters this process at all. That is
 *    defence in depth — rule 1 would be sufficient on its own, and rule 2 means
 *    a bug in rule 1 still cannot leak a phone number.
 */

import type {
  BondParticipant,
  BondParticipantExpand,
  RosterFieldVisibility,
  RosterNameMode,
  RosterParticipant,
  RosterViewerMode,
} from '@/types/rosters';

/** Blocks that carry PII and must never be requested for a public viewer. */
const STAFF_ONLY_EXPANDS: BondParticipantExpand[] = [
  'contact',
  'primary',
  'primaryContact',
  'registration',
];

/**
 * Which `expand` values to send to Bond. Public viewers get only the blocks
 * needed to render a name, jersey number, position and group.
 */
export function resolveExpand(
  mode: RosterViewerMode,
  visibility: RosterFieldVisibility
): BondParticipantExpand[] {
  const expand: BondParticipantExpand[] = ['group'];

  if (visibility.showJerseyNumber || visibility.showPosition || visibility.showTeamRole) {
    expand.push('playerInfo');
  }

  if (mode !== 'staff') {
    return expand;
  }

  if (visibility.staffShowContact && visibility.contactSource === 'participant') {
    expand.push('contact');
  }
  if (visibility.staffShowGuardian || visibility.contactSource === 'primary') {
    expand.push('primary');
    if (visibility.staffShowContact) {
      expand.push('primaryContact');
    }
  }
  if (visibility.staffShowWaiver || visibility.staffShowRegistration) {
    expand.push('registration');
  }

  return Array.from(new Set(expand));
}

/**
 * Render a participant's name at the configured level of exposure.
 *
 * `numberOnly` deliberately returns a constant rather than an index-based
 * label — a stable "Player 4" would still let someone correlate across page
 * loads. Callers render the jersey number alongside it.
 */
export function formatDisplayName(
  firstName: string | undefined,
  lastName: string | undefined,
  mode: RosterNameMode
): string {
  const first = (firstName || '').trim();
  const last = (lastName || '').trim();

  if (mode === 'numberOnly') return 'Player';

  if (mode === 'lastInitial') {
    const initial = last.charAt(0);
    if (!first) return initial ? `${initial}.` : 'Player';
    return initial ? `${first} ${initial}.` : first;
  }

  if (mode === 'firstInitial') {
    const initial = first.charAt(0);
    if (!last) return initial ? `${initial}.` : 'Player';
    return initial ? `${initial}. ${last}` : last;
  }

  const full = [first, last].filter(Boolean).join(' ');
  return full || 'Player';
}

/** Whole years elapsed, or undefined if the date is missing or unparseable. */
export function ageFromBirthDate(birthDate: string | undefined | null, now = new Date()): number | undefined {
  if (!birthDate) return undefined;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return undefined;

  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < born.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 && age < 150 ? age : undefined;
}

/**
 * Stable per-participant key for React lists and matrix lookups. Uses Bond's
 * own ids, never a name, so it is safe to send in an anonymized payload.
 */
function participantKey(raw: BondParticipant): string {
  const id = raw.rosterParticipantId ?? raw.eventParticipantId ?? raw.userId;
  return String(id);
}

/**
 * Build the client-facing participant. Adds only permitted keys — see rule 1
 * in the file header.
 */
export function redactParticipant(
  raw: BondParticipant,
  visibility: RosterFieldVisibility,
  mode: RosterViewerMode,
  now = new Date()
): RosterParticipant {
  const out: RosterParticipant = {
    id: participantKey(raw),
    displayName: formatDisplayName(raw.firstName, raw.lastName, visibility.nameMode),
  };

  // Photos identify a person as surely as a name does, so a de-identified
  // roster never carries one regardless of the showPhoto switch.
  if (visibility.showPhoto && visibility.nameMode !== 'numberOnly' && raw.pictureUrl) {
    out.photoUrl = raw.pictureUrl;
  }

  const jersey = raw.playerInfo?.jerseyNumber;
  if (visibility.showJerseyNumber && jersey !== undefined && jersey !== null && jersey !== '') {
    out.jerseyNumber = String(jersey);
  }
  if (visibility.showPosition && raw.playerInfo?.position) {
    out.position = raw.playerInfo.position;
  }
  if (visibility.showTeamRole && raw.playerInfo?.teamRole) {
    out.teamRole = formatTeamRole(raw.playerInfo.teamRole);
  }

  const group = raw.group;
  if (group) {
    out.groupId = group.groupId;
    out.groupName = group.groupName;
    if (group.parentGroupId != null) out.parentGroupId = group.parentGroupId;
    if (group.parentGroupName) out.parentGroupName = group.parentGroupName;
  } else if (raw.groupId != null) {
    out.groupId = raw.groupId;
  }

  if (mode !== 'staff') {
    return out;
  }

  if (visibility.staffShowContact) {
    const useGuardian = visibility.contactSource === 'primary';
    const email = useGuardian ? raw.primary?.email : raw.contact?.email;
    const phone = useGuardian ? raw.primary?.phoneNumber : raw.contact?.phoneNumber;
    if (email) out.email = email;
    if (phone) out.phone = phone;
    if (email || phone) out.contactIsGuardian = useGuardian;
  }

  if (visibility.staffShowBirthDate && raw.birthDate) {
    out.birthDate = raw.birthDate;
    const age = ageFromBirthDate(raw.birthDate, now);
    if (age !== undefined) out.age = age;
  }

  if (visibility.staffShowGender && raw.gender) {
    out.gender = raw.gender;
  }

  if (visibility.staffShowWaiver && raw.registration) {
    if (raw.registration.waiverSigned != null) {
      out.waiverSigned = raw.registration.waiverSigned;
    }
    if (raw.registration.waiverSignedDate) {
      out.waiverSignedDate = raw.registration.waiverSignedDate;
    }
  }

  if (visibility.staffShowRegistration && raw.registration) {
    if (raw.registration.registrationDate) {
      out.registrationDate = raw.registration.registrationDate;
    }
    if (raw.registration.productNames?.length) {
      out.productNames = raw.registration.productNames;
    }
  }

  if (visibility.staffShowGuardian && raw.primary) {
    const guardian = [raw.primary.firstName, raw.primary.lastName].filter(Boolean).join(' ').trim();
    if (guardian) out.guardianName = guardian;
  }

  return out;
}

/**
 * Bond's team-role tokens are internal enums (`league_v2_invited_player`,
 * `league_v2_captain`); no surface should render them raw. Formatted here, at
 * the choke point, so the table, the sheets and the CSV all agree.
 */
export function formatTeamRole(role: string): string {
  const cleaned = role
    .replace(/^league(_v\d+)?_/, '')
    .replace(/_/g, ' ')
    .trim();
  if (!cleaned) return role;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Sort key for jersey numbers, which are strings and include values like "00". */
export function jerseySortValue(jerseyNumber: string | undefined): number {
  if (!jerseyNumber) return Number.MAX_SAFE_INTEGER;
  const n = Number.parseInt(jerseyNumber, 10);
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
}

/** Default roster order: jersey number, then display name. */
export function sortParticipants(participants: RosterParticipant[]): RosterParticipant[] {
  return [...participants].sort((a, b) => {
    const jerseyDelta = jerseySortValue(a.jerseyNumber) - jerseySortValue(b.jerseyNumber);
    if (jerseyDelta !== 0) return jerseyDelta;
    return a.displayName.localeCompare(b.displayName);
  });
}
