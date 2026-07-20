'use client';

import { Suspense } from 'react';
import StudioShell from '@/components/tvmonitor/studio/StudioShell';
import MonitorList from '@/components/tvmonitor/studio/MonitorList';

export default function TvMonitorStudioPage() {
  return (
    <Suspense>
      <StudioShell>
        {(organizationIds) => (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Your TV monitors</h1>
              <p className="mt-1 text-sm text-gray-600">
                Build full-screen schedule displays for your facility TVs. Open a monitor&apos;s page URL in the TV&apos;s
                browser and go fullscreen.
              </p>
            </div>
            <MonitorList
              apiBase="/api/tvmonitor/studio/pages"
              editorBasePath="/tvmonitor/studio"
              allowedOrgIds={organizationIds}
            />
          </div>
        )}
      </StudioShell>
    </Suspense>
  );
}
