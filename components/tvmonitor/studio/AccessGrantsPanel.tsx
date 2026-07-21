'use client';

import { useEffect, useState } from 'react';
import { Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
import { Field, NumberInput, SectionCard, TextInput } from '@/components/tvmonitor/studio/fields';
import type { ITvMonitorAccessGrant } from '@/types/tvmonitor';

/**
 * Bond-admin panel for provisioning org-scoped studio access links.
 * The link (with its token) is displayed exactly once, right after creation.
 */
export default function AccessGrantsPanel() {
  const [grants, setGrants] = useState<ITvMonitorAccessGrant[]>([]);
  const [label, setLabel] = useState('');
  const [orgId, setOrgId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function grantLink(token: string): string {
    return `${window.location.origin}/tvmonitor/studio?key=${token}`;
  }

  async function copyGrantLink(grant: ITvMonitorAccessGrant) {
    if (!grant.token) return;
    await navigator.clipboard.writeText(grantLink(grant.token));
    setCopiedId(grant.id);
    setTimeout(() => setCopiedId((current) => (current === grant.id ? null : current)), 2000);
  }

  async function fetchGrants() {
    const res = await fetch('/api/admin/tvmonitor/access', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setGrants(data.grants || []);
    }
  }

  useEffect(() => {
    void fetchGrants();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/admin/tvmonitor/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: orgId, label }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to create access link');
      return;
    }
    setLabel('');
    // Copy the fresh link right away; it also stays copyable from the list below.
    if (data.url) {
      try {
        await navigator.clipboard.writeText(data.url);
        setCopiedId(data.grant?.id ?? null);
        setTimeout(() => setCopiedId(null), 2000);
      } catch {
        // Clipboard can fail without focus — the list copy button still works.
      }
    }
    void fetchGrants();
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this access link? The person will lose builder access immediately.')) return;
    await fetch(`/api/admin/tvmonitor/access/${id}`, { method: 'DELETE' });
    void fetchGrants();
  }

  const activeGrants = grants.filter((g) => !g.revoked_at);

  return (
    <SectionCard
      title="Builder access links"
      subtitle="Give someone outside Bond access to build monitors for their organization. Anyone with the link can edit that org's monitors — treat it like a password."
    >
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <Field label="Who is this for?">
            <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Jamie — Hatfield Ice front desk" required />
          </Field>
        </div>
        <div className="w-36">
          <Field label="Organization ID">
            <NumberInput value={orgId} min={1} onChange={setOrgId} />
          </Field>
        </div>
        <button
          type="submit"
          disabled={!label || !orgId}
          className="flex items-center gap-1 rounded-lg bg-toca-navy px-4 py-2 text-sm font-semibold text-white hover:bg-toca-purple disabled:opacity-50"
        >
          <Plus size={14} /> Create link
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {activeGrants.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {activeGrants.map((grant) => (
            <li key={grant.id} className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <KeyRound size={15} className="shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-800">{grant.label}</div>
                  <div className="text-xs text-gray-500">
                    org #{grant.organization_id}
                    {grant.last_used_at
                      ? ` · last used ${new Date(grant.last_used_at).toLocaleDateString()}`
                      : ' · never used'}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {grant.token ? (
                  <button
                    onClick={() => copyGrantLink(grant)}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:border-toca-navy hover:text-toca-navy"
                  >
                    <Copy size={12} /> {copiedId === grant.id ? 'Copied' : 'Copy link'}
                  </button>
                ) : (
                  <span className="text-xs text-gray-400" title="Created before links were stored — revoke and create a new one to get a copyable link.">
                    link not stored
                  </span>
                )}
                <button
                  onClick={() => handleRevoke(grant.id)}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:border-red-300 hover:text-red-600"
                >
                  <Trash2 size={12} /> Revoke
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No active access links.</p>
      )}
    </SectionCard>
  );
}
