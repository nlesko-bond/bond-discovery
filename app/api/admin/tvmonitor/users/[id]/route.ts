import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { revokeTvMonitorUser, updateTvMonitorUserOrgs } from '@/lib/tvmonitor-users';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = (await request.json()) as { organization_ids?: number[] };
    if (!Array.isArray(body.organization_ids)) {
      return NextResponse.json({ error: 'organization_ids is required' }, { status: 400 });
    }
    const ok = await updateTvMonitorUserOrgs(params.id, body.organization_ids);
    if (!ok) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Update failed' },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const ok = await revokeTvMonitorUser(params.id);
  if (!ok) return NextResponse.json({ error: 'Revoke failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
