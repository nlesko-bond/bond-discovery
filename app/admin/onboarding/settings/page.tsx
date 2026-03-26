import Link from 'next/link';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';

export default function OnboardingSettingsPage() {
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
      <div className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm">
        <p className="font-medium text-gray-900">Webhooks</p>
        <p className="mt-2">
          Configure a Supabase Database Webhook on <code className="font-mono text-xs">step_progress</code> UPDATE to
          POST to{' '}
          <code className="font-mono text-xs">
            {typeof process.env.NEXT_PUBLIC_APP_URL === 'string'
              ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/api/webhooks/step-completed`
              : '/api/webhooks/step-completed'}
          </code>
        </p>
      </div>
    </div>
  );
}
