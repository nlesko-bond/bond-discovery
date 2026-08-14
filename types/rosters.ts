/**
 * Rosters — Bond public API DTOs and page-config types.
 *
 * The Bond* types mirror the v1 public API responses verbatim (see
 * docs.bondsports.co/programs/groups-participants). The Roster* types are ours.
 *
 * Participant records carry PII. Nothing raw from Bond should reach a client:
 * everything passes through `redactParticipant` in lib/roster-privacy.ts first.
 */

// ============================================
// Bond API — groups
// ============================================

export type BondGroupType =
  | 'division'
  | 'team'
  | 'conference'
  | 'level'
  | 'age_group'
  | 'skill_level'
  | 'group';

export const BOND_GROUP_TYPES: BondGroupType[] = [
  'division',
  'team',
  'conference',
  'level',
  'age_group',
  'skill_level',
  'group',
];

export type BondRegistrationAccess = 'open' | 'invite_link_only';

export interface BondGroupCapacity {
  max: number | null;
  current: number;
  remaining: number | null;
}

export interface BondGroupEligibility {
  allowedGenders: string[] | null;
  bornOnOrAfter: string | null;
  bornOnOrBefore: string | null;
  minAgeAtRegistration: number | null;
  maxAgeAtRegistration: number | null;
}

export interface BondGroupRestrictions {
  playerCapacity?: BondGroupCapacity;
  groupCapacity?: BondGroupCapacity;
  eligibility?: BondGroupEligibility;
}

export interface BondTeamIdentity {
  id: number;
  name: string;
  sport: string;
  logoUrl: string | null;
}

export interface BondGroup {
  id: number;
  organizationId: number;
  name: string;
  groupType: BondGroupType;
  isTeam: boolean;
  parentId: number | null;
  parentName: string | null;
  registrationAccess: BondRegistrationAccess;
  hasPlayers: boolean;
  /** Direct player members only — excludes coaches, organizers and nested groups. */
  playerCount: number;
  hasGroups: boolean;
  groupCount: number;
  mainMediaUrl: string | null;
  organizationName: string;
  facilityId: number | null;
  sessionId: number;
  sessionName: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  restrictions?: BondGroupRestrictions;
  teamIdentity?: BondTeamIdentity;
  invitedPlayerRegistrationEnd?: string | null;
}

export type BondGroupExpand =
  | 'restrictions'
  | 'teamIdentity'
  | 'invitedPlayerRegistrationEnd'
  | 'facility';

// ============================================
// Bond API — participants
// ============================================

export type BondGender = 'MALE' | 'FEMALE' | 'OTHER';

export interface BondParticipantContact {
  email?: string | null;
  phoneNumber?: string | null;
}

export interface BondParticipantRegistration {
  waiverSigned?: boolean | null;
  waiverSignedDate?: string | null;
  registrationDate?: string | null;
  productNames?: string[] | null;
}

export interface BondParticipantPlayerInfo {
  jerseyNumber?: number | string | null;
  position?: string | null;
  teamRole?: string | null;
}

/** The guardian / family primary account holder. */
export interface BondParticipantPrimary {
  userId?: number | null;
  customerId?: number | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
}

export interface BondParticipantGroupContext {
  groupId: number;
  groupName: string;
  groupMetaType?: string | null;
  parentGroupId?: number | null;
  parentGroupName?: string | null;
  parentGroupMetaType?: string | null;
}

/** Shared shape of the group- and event-participant responses. */
export interface BondParticipant {
  rosterParticipantId?: number;
  /** Present only on the event-participants endpoint. */
  eventParticipantId?: number;
  userId: number;
  customerId?: number;
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  gender?: BondGender | null;
  pictureUrl?: string | null;
  groupId?: number;
  contact?: BondParticipantContact;
  registration?: BondParticipantRegistration;
  playerInfo?: BondParticipantPlayerInfo;
  primary?: BondParticipantPrimary;
  group?: BondParticipantGroupContext;
  deletedAt?: string | null;
}

export type BondParticipantExpand =
  | 'contact'
  | 'group'
  | 'primary'
  | 'primaryContact'
  | 'registration'
  | 'playerInfo';

export interface BondEventContext {
  eventId: number;
  eventName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

// ============================================
// Our types — privacy
// ============================================

/**
 * How much of a participant's identity a public viewer sees. Staff mode is a
 * separate, orthogonal flag — see `RosterViewerMode`.
 *
 * The four options mirror SportsSignUp's league-scoped name-display setting,
 * which is the best-developed control found in this category. `numberOnly`
 * is the full de-identification escape hatch for youth pages.
 */
export type RosterNameMode = 'numberOnly' | 'lastInitial' | 'firstInitial' | 'full';

export const ROSTER_NAME_MODES: RosterNameMode[] = [
  'numberOnly',
  'lastInitial',
  'firstInitial',
  'full',
];

export const ROSTER_NAME_MODE_LABELS: Record<RosterNameMode, string> = {
  numberOnly: 'Jersey number only',
  lastInitial: 'First name, last initial',
  firstInitial: 'First initial, last name',
  full: 'Full name',
};

/** Who is asking. Staff requires a verified staff session. */
export type RosterViewerMode = 'public' | 'staff';

/**
 * Per-field switches. Every field defaults to its most private setting; a field
 * absent from this object is not shown. `contactSource` decides whether staff
 * contact columns render the participant's own details or their guardian's —
 * youth pages should use 'primary'.
 */
export interface RosterFieldVisibility {
  nameMode: RosterNameMode;
  showPhoto: boolean;
  showJerseyNumber: boolean;
  showPosition: boolean;
  showTeamRole: boolean;
  /** Staff-only fields below. Ignored entirely for public viewers. */
  staffShowContact: boolean;
  staffShowBirthDate: boolean;
  staffShowGender: boolean;
  staffShowWaiver: boolean;
  staffShowRegistration: boolean;
  staffShowGuardian: boolean;
  contactSource: 'participant' | 'primary';
}

export const DEFAULT_ROSTER_FIELD_VISIBILITY: RosterFieldVisibility = {
  nameMode: 'numberOnly',
  showPhoto: false,
  showJerseyNumber: true,
  showPosition: true,
  showTeamRole: true,
  staffShowContact: true,
  staffShowBirthDate: true,
  staffShowGender: false,
  staffShowWaiver: true,
  staffShowRegistration: true,
  staffShowGuardian: true,
  contactSource: 'primary',
};

/**
 * A participant as it leaves the server. Every field is optional because the
 * redactor omits keys entirely rather than nulling them — a public payload
 * should contain no evidence that contact data exists.
 */
export interface RosterParticipant {
  id: string;
  displayName: string;
  photoUrl?: string;
  jerseyNumber?: string;
  position?: string;
  teamRole?: string;
  groupId?: number;
  groupName?: string;
  parentGroupId?: number;
  parentGroupName?: string;
  email?: string;
  phone?: string;
  contactIsGuardian?: boolean;
  birthDate?: string;
  age?: number;
  gender?: BondGender;
  waiverSigned?: boolean;
  waiverSignedDate?: string;
  registrationDate?: string;
  productNames?: string[];
  guardianName?: string;
}

// ============================================
// Our types — page config
// ============================================

export type RosterPageAccess = 'public' | 'password' | 'staff';

export type RosterViewType = 'browse' | 'team' | 'checkin' | 'matrix';

export const ROSTER_VIEW_TYPES: RosterViewType[] = ['browse', 'team', 'checkin', 'matrix'];

export interface RosterBranding {
  primaryColor: string;
  accentColor: string;
  accentColorLight: string;
  bgColor: string;
  fontHeading: string;
  fontBody: string;
  logoUrl: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
}

/** Bounds which programs/sessions a page can ever reach. */
export interface RosterProgramFilter {
  mode: 'all' | 'include' | 'exclude';
  programIds: number[];
}

/** Rolling window, so new seasons appear without re-configuring the page. */
export interface RosterSessionWindow {
  pastDays: number;
  futureDays: number;
}

export interface RosterPageConfig {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  organizationIds: number[];
  programFilter: RosterProgramFilter;
  /** Explicit override; when non-empty the rolling window is ignored. */
  pinnedSessions: Array<{ programId: number; sessionId: number }>;
  sessionWindow: RosterSessionWindow;
  branding: RosterBranding;
  pageAccess: RosterPageAccess;
  fieldVisibility: RosterFieldVisibility;
  allowIndexing: boolean;
  allowPrint: boolean;
  /** Marks the page as youth-facing; tightens defaults and copy. */
  isYouth: boolean;
  hasViewerPassword: boolean;
  hasStaffPassword: boolean;
  apiKey?: string;
  bondEnv?: string;
  createdAt: string;
  updatedAt: string;
}

/** One session a viewer can pick, resolved from the page's scope. */
export interface RosterSessionRef {
  programId: number;
  programName: string;
  sessionId: number;
  sessionName: string;
  linkSEO?: string;
  startDate?: string;
  endDate?: string;
  sport?: string;
  /**
   * IANA facility timezone, e.g. `America/New_York`. Every date and time shown
   * for this session is rendered in it, and it is stated in the UI.
   *
   * Not available from the session list — it is resolved later from
   * `expand=facility` on the groups call, or from an event's own `timezone`.
   * See lib/roster-time.ts.
   */
  timezone?: string;
}

/** Division/team hierarchy built from the flat group list. */
export interface RosterGroupNode {
  id: number;
  name: string;
  groupType: BondGroupType;
  isTeam: boolean;
  playerCount: number;
  logoUrl?: string;
  children: RosterGroupNode[];
}
