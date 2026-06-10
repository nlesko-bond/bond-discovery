'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { IPageEditorSectionProps } from '../page-config-types';

export function PageEditorAnalyticsSection({ config, setConfig }: IPageEditorSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Analytics</h2>
        <p className="mt-1 text-sm text-gray-600">
          Google Tag Manager loads inside the discovery iframe. Events push to the partner&apos;s
          dataLayer for GA4.
        </p>
      </div>

      <div>
        <label className="label">Google Tag Manager ID (optional)</label>
        <input
          type="text"
          className="input font-mono"
          placeholder="GTM-XXXXXX"
          value={config.gtmId || ''}
          onChange={(event) =>
            setConfig({ ...config, gtmId: event.target.value || undefined })
          }
        />
        <p className="mt-1 text-xs text-gray-500">
          Page-specific GTM container ID. Leave empty to inherit from partner group.
        </p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-medium">Setup guide</p>
        <p className="mt-1">
          Use GTM Preview on your live discovery or portal URL after saving. Bond also tracks page
          views internally at{' '}
          <Link href="/admin/analytics" className="font-medium underline">
            Admin Analytics
          </Link>
          .
        </p>
        <Link
          href="/admin/help/gtm-setup"
          className="mt-3 inline-flex items-center gap-1.5 font-medium text-blue-700 hover:text-blue-900"
        >
          Open GTM setup guide
          <ExternalLink size={14} />
        </Link>
      </div>
    </div>
  );
}
