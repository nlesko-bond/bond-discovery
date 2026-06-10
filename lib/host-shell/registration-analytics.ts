import { bondAnalytics } from '@/lib/analytics';
import { gtmEvent } from '@/components/analytics/GoogleTagManager';
import { DEFAULT_BOND_CONSUMER_ORIGIN } from '@/lib/host-shell/constants';

const PROGRAM_ID_PATH_PATTERN = /\/programs\/([^/?#]+)/i;
const SESSION_ID_PATH_PATTERN = /\/session\/([^/?#]+)/i;

export interface IRegistrationAnalyticsPayload {
  programId: string;
  programName: string;
  sessionId?: string;
  sessionName?: string;
  productId?: string;
}

export interface IBondRegisterLinkAnalyticsInput {
  programId: string;
  programName: string;
  sessionId?: string;
  sessionName?: string;
  productId?: string;
}

/**
 * HTML data attributes read by host-shell register click tracking (names + ids).
 */
export function getBondRegisterLinkAnalyticsAttributes(
  input: IBondRegisterLinkAnalyticsInput,
): Record<string, string> {
  const attributes: Record<string, string> = {
    'data-bond-program-id': input.programId,
    'data-bond-program-name': input.programName,
  };
  if (input.sessionId) {
    attributes['data-bond-session-id'] = input.sessionId;
  }
  if (input.sessionName) {
    attributes['data-bond-session-name'] = input.sessionName;
  }
  if (input.productId) {
    attributes['data-bond-product-id'] = input.productId;
  }
  return attributes;
}

function mergeRegistrationAnalyticsFromAnchor(
  payload: IRegistrationAnalyticsPayload,
  anchor: HTMLAnchorElement | null | undefined,
): IRegistrationAnalyticsPayload {
  if (!anchor) {
    return payload;
  }
  const { dataset } = anchor;
  return {
    programId: dataset.bondProgramId?.trim() || payload.programId,
    programName: dataset.bondProgramName?.trim() || payload.programName,
    sessionId: dataset.bondSessionId?.trim() || payload.sessionId,
    sessionName: dataset.bondSessionName?.trim() || payload.sessionName,
    productId: dataset.bondProductId?.trim() || payload.productId,
  };
}

function resolveRegistrationUrl(href: string, consumerOrigin: string): URL | null {
  try {
    const base = consumerOrigin.endsWith('/') ? consumerOrigin : `${consumerOrigin}/`;
    return href.startsWith('http') ? new URL(href) : new URL(href, base);
  } catch {
    return null;
  }
}

/**
 * Derives GTM / Bond analytics fields from a registration href (linkSEO or absolute consumer URL).
 */
export function parseRegistrationAnalyticsFromHref(
  href: string,
  consumerOrigin: string = DEFAULT_BOND_CONSUMER_ORIGIN,
): IRegistrationAnalyticsPayload | null {
  const url = resolveRegistrationUrl(href, consumerOrigin);
  if (!url) {
    const programMatch = href.match(PROGRAM_ID_PATH_PATTERN);
    if (!programMatch?.[1]) {
      return null;
    }
    const programId = programMatch[1];
    const sessionMatch = href.match(SESSION_ID_PATH_PATTERN);
    const productMatch = href.match(/[?&]productId=([^&]+)/i);
    return {
      programId,
      programName: programId,
      sessionId: sessionMatch?.[1],
      sessionName: sessionMatch?.[1],
      productId: productMatch?.[1],
    };
  }

  const programMatch = url.pathname.match(PROGRAM_ID_PATH_PATTERN);
  if (!programMatch?.[1]) {
    return null;
  }

  const programId = programMatch[1];
  const sessionMatch = url.pathname.match(SESSION_ID_PATH_PATTERN);
  const sessionId = sessionMatch?.[1];
  const productId = url.searchParams.get('productId') ?? undefined;

  return {
    programId,
    programName: programId,
    sessionId,
    sessionName: sessionId,
    productId,
  };
}

export function getPortalPageSlugFromLocation(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const match = window.location.pathname.match(/^\/portal\/([^/]+)/);
  return match?.[1] ?? null;
}

/**
 * Fires discovery register analytics before host-shell navigation intercepts the click.
 */
export function trackHostShellRegisterClick(
  href: string,
  pageSlug: string | null,
  anchor?: HTMLAnchorElement | null,
): void {
  const parsed = parseRegistrationAnalyticsFromHref(href);
  if (!parsed || !pageSlug) {
    return;
  }
  const payload = mergeRegistrationAnalyticsFromAnchor(parsed, anchor);

  gtmEvent.clickRegister({
    programId: payload.programId,
    programName: payload.programName,
    sessionId: payload.sessionId,
    sessionName: payload.sessionName,
    productId: payload.productId,
  });

  bondAnalytics.clickRegister(pageSlug, {
    programId: payload.programId,
    programName: payload.programName,
    sessionId: payload.sessionId,
    sessionName: payload.sessionName,
    productId: payload.productId,
  });
}
