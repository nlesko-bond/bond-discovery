import Link from 'next/link';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';

export default function OnboardingSettingsPage() {
  const appBase =
    typeof process.env.NEXT_PUBLIC_APP_URL === 'string'
      ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
      : '';
  const webhookUrl = `${appBase || ''}/api/webhooks/step-completed`;
  const orgWebhookUrl = `${appBase || ''}/api/webhooks/org-updated`;
  const stallCronPath = `/api/cron/onboarding-stall-alerts`;
  const keyDatesCronPath = `/api/cron/push-key-dates`;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Onboarding settings</h1>
      <p className="text-sm text-gray-600">
        Per-rep Slack notifications are controlled on the{' '}
        <Link href={`${ONBOARDING_BASE}/team`} className="text-primary hover:underline">
          Team
        </Link>{' '}
        page. Set each rep&apos;s optional <strong>Slack member ID</strong> (U… ID) so alerts can{' '}
        <code className="font-mono text-xs">@mention</code> them. In Vercel, set{' '}
        <code className="rounded bg-gray-100 px-1 font-mono text-xs">SLACK_ONBOARDING_WEBHOOK_URL</code> to a Slack
        Incoming Webhook URL for the channel where alerts should appear.
      </p>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm">
        <p className="font-medium text-gray-900">Slack triggers today</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Bank account connected (step checked complete)</li>
          <li>Spaces uploaded (CSV uploaded from the onboarding checklist)</li>
          <li>Finished all pre-kickoff tasks (template configures which steps belong to Part 1)</li>
          <li>Onboarding stall alerts — 5-day and 7-day thresholds via daily cron (see below)</li>
          <li>Changes to expected launch date (orgs table update)</li>
        </ul>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm">
        <p className="font-medium text-gray-900">Webhooks (Supabase)</p>
        <p className="mt-2">
          <strong>step_progress UPDATE</strong> → POST{' '}
          <code className="break-all font-mono text-xs">{webhookUrl || '/api/webhooks/step-completed'}</code>. This
          handles bank-complete and Part 1-complete notifications.
        </p>
        <p className="mt-4">
          <strong>orgs UPDATE</strong> on <code className="font-mono text-xs">expected_launch_date</code> → POST{' '}
          <code className="break-all font-mono text-xs">{orgWebhookUrl || '/api/webhooks/org-updated'}</code>.
        </p>
        <p className="mt-3 text-xs text-gray-500">
          Configure payloads with <code className="font-mono">record</code> and{' '}
          <code className="font-mono">old_record</code>. The org endpoint fires only when{' '}
          <code className="font-mono">expected_launch_date</code> differs from the prior value.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm">
        <p className="font-medium text-gray-900">Customer Health key dates</p>
        <p className="mt-2">
          Discovery pushes a full key-dates snapshot to Customer Health when org dates change or checklist activity
          completes. Set{' '}
          <code className="rounded bg-gray-100 px-1 font-mono text-xs">KEY_DATES_WEBHOOK_SECRET</code> (shared with CS
          Health) and optionally{' '}
          <code className="rounded bg-gray-100 px-1 font-mono text-xs">KEY_DATES_WEBHOOK_URL</code> (defaults to{' '}
          <code className="font-mono text-xs">https://cs.bondsports.co/api/webhooks/key-dates</code>).
        </p>
        <p className="mt-3">
          Daily backstop: Vercel runs{' '}
          <code className="rounded bg-gray-100 px-1 font-mono text-xs">{keyDatesCronPath}</code> for every org with a
          Bond organization ID. Requires <code className="font-mono text-xs">CRON_SECRET</code> bearer auth.
        </p>
        <p className="mt-3 text-xs text-gray-500">
          Milestones synced: current planned launch, actual launch (manual in org settings), onboarding started (first
          checklist activity), onboarding completed (all required steps done).
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm">
        <p className="font-medium text-gray-900">Stall reminders (cron)</p>
        <p className="mt-2">
          Vercel runs <code className="rounded bg-gray-100 px-1 font-mono text-xs">{stallCronPath}</code> daily. It
          requires <code className="font-mono text-xs">CRON_SECRET</code> bearer auth and notifies when an{' '}
          <strong>active</strong> onboarding org has gone at least five or seven days without checklist progress or CSV
          upload.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm">
        <p className="font-medium text-gray-900">Rentable spaces CSV</p>
        <p className="mt-2">
          Uploaded files stream into the Supabase Storage bucket{' '}
          <code className="font-mono text-xs">onboarding-uploads</code> (<code className="font-mono text-xs">
            &#123;org_id&#125;/rentable-spaces-*.csv
          </code>
          ). Staff can retrieve a temporary signed URL from each org detail card in Discovery admin or download the CSV
          template from <span className="font-mono text-xs">/onboarding/templates/rentable-spaces.csv</span>.
        </p>
      </div>
    </div>
  );
}
