import type { ISessionDescriptionSections } from '@/lib/host-shell/portal-session-description';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
import { cn } from '@/lib/utils';

interface IHostPortalV2RowDescriptionPanelProps {
  card: IHostPortalSessionCardModel;
  sections: ISessionDescriptionSections;
}

export function HostPortalV2RowDescriptionPanel({
  card,
  sections,
}: IHostPortalV2RowDescriptionPanelProps) {
  const sessionLabel = card.name || card.programName || 'Session';

  return (
    <div
      className="rounded-lg border border-gray-200 bg-gray-50 p-3"
      data-testid="portal-v2-row-description"
      aria-label={`About ${sessionLabel}`}
    >
      <p className="mb-2 text-[13px] font-semibold text-gray-800">
        {sessionLabel}{' '}
        <span className="font-normal text-gray-500">· about this session</span>
      </p>
      <div className="rounded-lg border border-gray-100 bg-white px-4 py-3">
        {card.programName && card.programName !== sessionLabel && (
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            {card.programName}
          </p>
        )}
        {sections.lead && (
          <p className="text-sm font-medium leading-relaxed text-gray-900">{sections.lead}</p>
        )}
        {sections.body && (
          <p
            className={cn(
              'whitespace-pre-wrap text-sm leading-relaxed text-gray-600',
              sections.lead && 'mt-2',
            )}
          >
            {sections.body}
          </p>
        )}
      </div>
    </div>
  );
}
