import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { revokeTvMonitorAccessGrant } from '@/lib/tvmonitor-access';

export const dynamic = 'force-dynamic';

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const ok = await revokeTvMonitorAccessGrant(params.id);
  if (!ok) return NextResponse.json({ error: 'Revoke failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
