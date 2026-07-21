'use client';

import MonitorList from '@/components/tvmonitor/studio/MonitorList';
import StudioUsersPanel from '@/components/tvmonitor/studio/StudioUsersPanel';
import AccessGrantsPanel from '@/components/tvmonitor/studio/AccessGrantsPanel';

export default function AdminTvMonitorPage() {
  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">TV Monitors</h1>
        <p className="mt-1 text-sm text-gray-600">
          Full-screen schedule displays for facility TVs, built from templates or custom blocks. Pages live at{' '}
          <code className="rounded bg-gray-100 px-1">/tvmonitor/&#123;name&#125;</code>.
        </p>
      </div>
      <MonitorList apiBase="/api/admin/tvmonitor" editorBasePath="/admin/tvmonitor" allowedOrgIds={null} />
      <StudioUsersPanel />
      <AccessGrantsPanel />
    </div>
  );
}
