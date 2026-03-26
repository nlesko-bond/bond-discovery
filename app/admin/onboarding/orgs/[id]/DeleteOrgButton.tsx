'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deleteOrg } from '../actions';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';

export function DeleteOrgButton({ orgId, orgName }: { orgId: string; orgName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (
      !window.confirm(
        `Delete “${orgName}”? This cannot be undone. All onboarding progress and activity for this organization will be removed.`,
      )
    ) {
      return;
    }
    setPending(true);
    const r = await deleteOrg(orgId);
    setPending(false);
    if (r.success) {
      router.push(`${ONBOARDING_BASE}/orgs`);
      router.refresh();
      return;
    }
    window.alert(r.error ?? 'Could not delete organization.');
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void onDelete()}
      className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? 'Deleting…' : 'Delete organization'}
    </button>
  );
}
