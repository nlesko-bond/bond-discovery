'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setOrgStatus } from '../actions';
import { useOptionalOrgDetailLive } from './OrgDetailLive';

export function OrgActions({
  orgId,
  currentStatus,
}: {
  orgId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const live = useOptionalOrgDetailLive();
  const currentStatusLive = live?.status ?? currentStatus;
  const [pending, setPending] = useState(false);

  async function run(status: 'active' | 'paused' | 'archived') {
    setPending(true);
    const r = await setOrgStatus(orgId, status);
    setPending(false);
    if (r.success) router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {currentStatusLive === 'archived' ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void run('active')}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Unarchive
        </button>
      ) : null}
      {currentStatusLive === 'paused' ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void run('active')}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Resume
        </button>
      ) : null}
      {currentStatusLive === 'active' ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void run('paused')}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 disabled:opacity-50"
        >
          Pause
        </button>
      ) : null}
      {currentStatusLive !== 'archived' ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void run('archived')}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 disabled:opacity-50"
        >
          Archive
        </button>
      ) : null}
    </div>
  );
}
