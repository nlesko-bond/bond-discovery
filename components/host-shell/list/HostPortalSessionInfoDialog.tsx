'use client';

import { useEffect, useRef } from 'react';
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sections = formatHostPortalSessionDescription(description, longDescription);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open) {
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    } else {
      dialog.close();
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!sections) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-black/45"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div
        className="flex min-h-full items-end justify-center p-4 sm:items-center"
        role="document"
      >
        <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
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
          <div className="max-h-[calc(85vh-5rem)] overflow-y-auto px-5 py-4">
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
      </div>
    </dialog>
  );
}
