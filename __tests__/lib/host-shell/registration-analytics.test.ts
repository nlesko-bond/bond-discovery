import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseRegistrationAnalyticsFromHref,
  trackHostShellRegisterClick,
} from '@/lib/host-shell/registration-analytics';
import { gtmEvent } from '@/components/analytics/GoogleTagManager';
import { bondAnalytics } from '@/lib/analytics';

vi.mock('@/components/analytics/GoogleTagManager', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/components/analytics/GoogleTagManager')
  >();
  return {
    gtmEvent: {
      ...actual.gtmEvent,
      // Pass-through spy: records calls AND performs the real dataLayer push
      clickRegister: vi.fn(actual.gtmEvent.clickRegister),
    },
  };
});

vi.mock('@/lib/analytics', () => ({
  bondAnalytics: {
    clickRegister: vi.fn(),
  },
}));

describe('parseRegistrationAnalyticsFromHref', () => {
  it('parses program, session, and productId from absolute URL', () => {
    const result = parseRegistrationAnalyticsFromHref(
      'https://bondsports.co/programs/3817/session/87596?skipToProducts=true&productId=119110',
      'https://bondsports.co',
    );
    expect(result).toEqual({
      programId: '3817',
      programName: '3817',
      sessionId: '87596',
      sessionName: '87596',
      productId: '119110',
    });
  });

  it('parses program-only relative path', () => {
    const result = parseRegistrationAnalyticsFromHref(
      '/programs/abc?productId=9',
      'https://bondsports.co',
    );
    expect(result).toEqual({
      programId: 'abc',
      programName: 'abc',
      sessionId: undefined,
      sessionName: undefined,
      productId: '9',
    });
  });

  it('returns null when href has no program segment', () => {
    expect(parseRegistrationAnalyticsFromHref('/about', 'https://bondsports.co')).toBeNull();
  });
});

describe('trackHostShellRegisterClick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.dataLayer = [];
  });

  it('pushes a click_register event to the GTM dataLayer', () => {
    trackHostShellRegisterClick(
      'https://bondsports.co/programs/3817/session/87596?productId=119110',
      'toca-evanston',
    );

    expect(window.dataLayer).toContainEqual({
      event: 'click_register',
      program_id: '3817',
      program_name: '3817',
      session_id: '87596',
      session_name: '87596',
      product_id: '119110',
      price: undefined,
      currency: 'USD',
    });
  });

  it('fires GTM and Bond analytics when slug and href are valid', () => {
    trackHostShellRegisterClick(
      'https://bondsports.co/programs/1/session/2?productId=99',
      'toca-evanston',
    );

    expect(gtmEvent.clickRegister).toHaveBeenCalledWith({
      programId: '1',
      programName: '1',
      sessionId: '2',
      sessionName: '2',
      productId: '99',
    });

    expect(bondAnalytics.clickRegister).toHaveBeenCalledWith('toca-evanston', {
      programId: '1',
      programName: '1',
      sessionId: '2',
      sessionName: '2',
      productId: '99',
    });
  });

  it('skips tracking when page slug is missing', () => {
    trackHostShellRegisterClick('https://bondsports.co/programs/1', null);
    expect(gtmEvent.clickRegister).not.toHaveBeenCalled();
    expect(bondAnalytics.clickRegister).not.toHaveBeenCalled();
  });
});
