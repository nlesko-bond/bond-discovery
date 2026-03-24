import { gtmEvent } from '@/components/analytics/GoogleTagManager';
import { bondAnalytics } from '@/lib/analytics';
import type { CalendarEvent, DiscoveryConfig } from '@/types';
import { getPunchPassRedeemUrl } from '@/lib/punch-pass';

export { getPunchPassRedeemUrl };

export function eventShowsRedeemPass(event: CalendarEvent, config: DiscoveryConfig): boolean {
  return config.features.showPunchPassRedeemButton === true && Boolean(event.hasPunchPassProduct);
}

export function trackRedeemPassClick(config: DiscoveryConfig, event: CalendarEvent): void {
  gtmEvent.clickRedeemPass({
    eventId: event.id,
    programId: event.programId,
    programName: event.programName,
    sessionId: event.sessionId,
    sessionName: event.sessionName,
  });
  bondAnalytics.clickRedeemPass(config.slug, {
    eventId: event.id,
    programId: event.programId,
    programName: event.programName,
    sessionId: event.sessionId,
    sessionName: event.sessionName,
  });
}
