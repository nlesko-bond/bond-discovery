import { X } from 'lucide-react';
import { formatHostPortalSessionDescription } from '@/lib/host-shell/portal-session-description';

const DEFAULT_DIALOG_ACCENT_COLOR = '#1E2761';

interface IHostPortalSessionInfoDialogProps {
  open: boolean;
  onClose: () => void;
  programName?: string;
  sessionName: string;
  description?: string;
  longDescription?: string;
  accentColor?: string;
}

export function HostPortalSessionInfoDialog({
  open,
  onClose,
  programName,
  sessionName,
  description,
  longDescription,
  accentColor,
}: IHostPortalSessionInfoDialogProps) {
  const sections = formatHostPortalSessionDescription(description, longDescription);

  if (!open || !sections) {
    return null;
  }

  return (
    <section className="border-t border-gray-100 bg-gray-50 px-4 py-4 sm:px-5">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            {programName && (
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {programName}
              </p>
            )}
            <h2 className="mt-0.5 text-lg font-semibold text-gray-900">{sessionName}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close session details"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="px-5 py-4">
          {sections.lead && (
            <p className="text-sm font-medium leading-relaxed text-gray-800">{sections.lead}</p>
          )}
          {sections.body && (
            <p
              className={`whitespace-pre-wrap text-sm leading-relaxed text-gray-600 ${
                sections.lead ? 'mt-3' : ''
              }`}
            >
              {sections.body}
            </p>
          )}
        </div>
        <div className="border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: accentColor ?? DEFAULT_DIALOG_ACCENT_COLOR }}
          >
            Close
          </button>
        </div>
      </div>
    </section>
  );
}
