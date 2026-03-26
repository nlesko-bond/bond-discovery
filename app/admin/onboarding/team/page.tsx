import { getSupabaseAdmin } from '@/lib/supabase';
import { addStaff, updateStaffNotify, updateStaffSlackMemberId } from './actions';
import { DeleteStaffForm } from './DeleteStaffForm';

type SearchParams = Promise<{ error?: string }>;

export default async function OnboardingTeamPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const admin = getSupabaseAdmin();
  const sp = await searchParams;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  const { data: staff } = await admin.from('staff').select('*').order('name');

  const orgCounts: Record<string, number> = {};
  for (const s of staff ?? []) {
    const { count } = await admin
      .from('orgs')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_rep', s.id);
    orgCounts[s.id] = count ?? 0;
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Onboarding team</h1>
        <p className="mt-1 text-sm text-gray-600">
          Staff metadata for onboarding. Adding someone here does <strong>not</strong> create a Google login — they
          must use the same email as their @bondsports.co account.
        </p>
      </div>

      {errorMsg ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {errorMsg}
        </div>
      ) : null}

      <section className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Slack member ID</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Active orgs</th>
              <th className="px-4 py-3 font-medium">Step notifications (Slack)</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {(staff ?? []).map((s) => {
              const slackId =
                typeof (s as { slack_member_id?: string | null }).slack_member_id === 'string'
                  ? (s as { slack_member_id?: string | null }).slack_member_id ?? ''
                  : '';
              return (
              <tr key={s.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                <td className="px-4 py-3 text-gray-600">{s.email}</td>
                <td className="px-4 py-3 align-top">
                  <form
                    action={updateStaffSlackMemberId.bind(null, s.id)}
                    className="flex flex-col gap-1 sm:flex-row sm:items-center"
                  >
                    <input
                      name="slack_member_id"
                      defaultValue={slackId}
                      placeholder="U01…"
                      autoComplete="off"
                      className="w-full min-w-[7rem] max-w-[11rem] rounded border border-gray-300 px-2 py-1 font-mono text-xs"
                      title="Slack user ID for @mentions (enable Developer Mode in Slack, then copy member ID from profile)"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Save
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3 capitalize text-gray-600">{s.role.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-gray-600">{orgCounts[s.id] ?? 0}</td>
                <td className="px-4 py-3">
                  <form action={updateStaffNotify.bind(null, s.id, !s.notify_email)}>
                    <button
                      type="submit"
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.notify_email ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {s.notify_email ? 'On' : 'Off'}
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3">
                  <DeleteStaffForm id={s.id} />
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Add staff member</h2>
        <form action={addStaff} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-gray-900" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              name="name"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-900" htmlFor="email">
              Email
            </label>
            <input id="email" name="email" type="email" required className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-900" htmlFor="role">
              Role
            </label>
            <select id="role" name="role" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
              <option value="cs_rep">CS rep</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-gray-900" htmlFor="slack_member_id">
              Slack member ID (optional)
            </label>
            <input
              id="slack_member_id"
              name="slack_member_id"
              placeholder="U01… — for @mentions in alerts"
              autoComplete="off"
              className="mt-1 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Slack → profile → … → Copy member ID (turn on Developer Mode in Slack settings first).
            </p>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
              Add
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
