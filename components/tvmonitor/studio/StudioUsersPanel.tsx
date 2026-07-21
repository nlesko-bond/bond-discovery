'use client';

import { useEffect, useState } from 'react';
import { Copy, Link2, Plus, Trash2, UserRound } from 'lucide-react';
import { Field, SectionCard, TextInput } from '@/components/tvmonitor/studio/fields';
import type { ITvMonitorUser } from '@/lib/tvmonitor-users';

/**
 * Bond-admin panel for named studio users (email magic-link sign-in).
 * Adding a user mints a 7-day single-use invite link (and emails it when
 * email delivery is configured).
 */
export default function StudioUsersPanel() {
  const [users, setUsers] = useState<ITvMonitorUser[]>([]);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [form, setForm] = useState({ email: '', organization_ids: '' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function fetchUsers() {
    const res = await fetch('/api/admin/tvmonitor/users', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users || []);
      setEmailConfigured(Boolean(data.emailConfigured));
    }
  }

  useEffect(() => {
    void fetchUsers();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    setInviteUrl(null);
    try {
      const res = await fetch('/api/admin/tvmonitor/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add user');
      setForm({ email: '', organization_ids: '' });
      setInviteUrl(data.inviteUrl ?? null);
      setNotice(
        data.emailSent
          ? `Invite emailed to ${data.user.email}. The link below also works if they can't find it.`
          : `Added ${data.user.email}. Send them the invite link below (valid 7 days, works once).`,
      );
      void fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setBusy(false);
    }
  }

  async function handleNewInvite(user: ITvMonitorUser) {
    setError(null);
    setNotice(null);
    setInviteUrl(null);
    const res = await fetch(`/api/admin/tvmonitor/users/${user.id}/invite`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to create invite link');
      return;
    }
    setInviteUrl(data.inviteUrl);
    setNotice(
      data.emailSent
        ? `Fresh invite emailed to ${user.email} — link below as backup.`
        : `Fresh invite link for ${user.email} (valid 7 days, works once):`,
    );
  }

  async function handleRevoke(user: ITvMonitorUser) {
    if (!confirm(`Remove studio access for ${user.email}? They will be signed out immediately.`)) return;
    await fetch(`/api/admin/tvmonitor/users/${user.id}`, { method: 'DELETE' });
    void fetchUsers();
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeUsers = users.filter((u) => !u.revoked_at);

  return (
    <SectionCard
      title="Studio users"
      subtitle={`People who can sign in to the builder with their email${emailConfigured ? '' : ' — email delivery is not configured (RESEND_API_KEY), so hand them the invite link directly'}.`}
    >
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <Field label="Email">
            <TextInput
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="brian@hatfieldice.com"
            />
          </Field>
        </div>
        <div className="w-44">
          <Field label="Organization IDs" hint="Comma-separated for uber-orgs.">
            <TextInput
              required
              value={form.organization_ids}
              onChange={(e) => setForm((f) => ({ ...f, organization_ids: e.target.value }))}
              placeholder="725 or 725, 811"
            />
          </Field>
        </div>
        <button
          type="submit"
          disabled={busy || !form.email || !form.organization_ids}
          className="mb-5 flex items-center gap-1 rounded-lg bg-toca-navy px-4 py-2 text-sm font-semibold text-white hover:bg-toca-purple disabled:opacity-50"
        >
          <Plus size={14} /> Add user
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="mb-2 text-sm text-blue-900">{notice}</p>
          {inviteUrl && (
            <div className="flex gap-2">
              <TextInput value={inviteUrl} readOnly className="bg-white font-mono text-xs" />
              <button
                onClick={copyInvite}
                type="button"
                className="flex shrink-0 items-center gap-1 rounded-lg border border-blue-300 px-3 text-sm text-blue-800 hover:bg-blue-100"
              >
                <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      )}

      {activeUsers.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {activeUsers.map((user) => (
            <li key={user.id} className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <UserRound size={15} className="shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-800">{user.email}</div>
                  <div className="text-xs text-gray-500">
                    org{user.organization_ids.length === 1 ? '' : 's'} {user.organization_ids.map((id) => `#${id}`).join(', ')}
                    {user.last_login_at
                      ? ` · last sign-in ${new Date(user.last_login_at).toLocaleDateString()}`
                      : ' · never signed in'}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => handleNewInvite(user)}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:border-toca-navy hover:text-toca-navy"
                  title="Mint a fresh single-use invite link"
                >
                  <Link2 size={12} /> New invite
                </button>
                <button
                  onClick={() => handleRevoke(user)}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:border-red-300 hover:text-red-600"
                >
                  <Trash2 size={12} /> Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No studio users yet.</p>
      )}
    </SectionCard>
  );
}
