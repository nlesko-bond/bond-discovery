const ALMOST_FULL_SPOTS_THRESHOLD = 5;

export interface ISegmentAvailabilityInput {
  spotsRemaining?: number;
  maxParticipants?: number;
  currentParticipants?: number;
  registrationWindowStatus?: string;
  isWaitlistEnabled?: boolean;
}

export type PortalSegmentAvailabilityKindEnum =
  | 'open'
  | 'almost_full'
  | 'full'
  | 'waitlist'
  | 'closed'
  | 'coming_soon';

export interface IPortalSegmentAvailability {
  kind: PortalSegmentAvailabilityKindEnum;
  label: string;
}

function resolveSpotsRemaining(input: ISegmentAvailabilityInput): number | undefined {
  if (input.spotsRemaining !== undefined) {
    return input.spotsRemaining;
  }
  if (
    input.maxParticipants !== undefined &&
    input.currentParticipants !== undefined
  ) {
    return Math.max(0, input.maxParticipants - input.currentParticipants);
  }
  return undefined;
}

export function resolvePortalSegmentAvailability(
  input: ISegmentAvailabilityInput,
): IPortalSegmentAvailability {
  const registrationStatus = input.registrationWindowStatus;

  if (registrationStatus === 'closed' || registrationStatus === 'ended') {
    return { kind: 'closed', label: 'Closed' };
  }

  if (registrationStatus === 'not_opened_yet') {
    return { kind: 'coming_soon', label: 'Coming soon' };
  }

  const spotsRemaining = resolveSpotsRemaining(input);
  const isFull = spotsRemaining !== undefined && spotsRemaining <= 0;
  const isRegistrationOpen =
    registrationStatus === undefined || registrationStatus === 'open';

  if (input.isWaitlistEnabled && isFull && isRegistrationOpen) {
    return { kind: 'waitlist', label: 'Waitlist' };
  }

  if (isFull) {
    return { kind: 'full', label: 'Full' };
  }

  if (spotsRemaining !== undefined && spotsRemaining > 0) {
    if (spotsRemaining <= ALMOST_FULL_SPOTS_THRESHOLD) {
      return {
        kind: 'almost_full',
        label: spotsRemaining === 1 ? '1 spot left' : `${spotsRemaining} spots left`,
      };
    }
    return { kind: 'open', label: 'Open' };
  }

  return { kind: 'open', label: 'Open' };
}
