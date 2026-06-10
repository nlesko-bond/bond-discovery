import { NextRequest, NextResponse } from 'next/server';
import { getAllPageConfigs, createPageConfig, defaultConfig } from '@/lib/config';
import { requireAdmin } from '@/lib/admin-auth';
import { warmScopeGroupWithTimeout } from '@/lib/discovery-warm';

// Disable caching for this route - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const pages = await getAllPageConfigs();
    return NextResponse.json({ pages }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error fetching pages:', error);
    return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.slug || !body.organizationIds?.length) {
      return NextResponse.json(
        { error: 'Name, slug, and organizationIds are required' },
        { status: 400 }
      );
    }
    
    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(body.slug)) {
      return NextResponse.json(
        { error: 'Slug must contain only lowercase letters, numbers, and hyphens' },
        { status: 400 }
      );
    }
    
    // Create the page config
    const newConfig = await createPageConfig({
      name: body.name,
      slug: body.slug,
      organizationIds: body.organizationIds,
      facilityIds: body.facilityIds || [],
      apiKey: body.apiKey,
      partnerGroupId: body.partner_group_id,
      branding: {
        ...defaultConfig.branding,
        ...body.branding,
      },
      features: {
        ...defaultConfig.features,
        ...body.features,
      },
      allowedParams: defaultConfig.allowedParams,
      defaultParams: body.defaultParams || {},
      cacheTtl: body.cacheTtl || 300,
      isActive: body.isActive !== false,
    });
    
    // Warm the discovery response cache for the new slug so first visitors
    // don't hit the slow cold-path pipeline (cron only runs every 15 min).
    // Awaited with a timeout rather than fire-and-forget: on Vercel a
    // detached promise can be killed at lambda teardown. On timeout the
    // warm is abandoned and the next cron run covers the slug.
    await warmScopeGroupWithTimeout([newConfig]);

    return NextResponse.json({ page: newConfig });
  } catch (error: any) {
    console.error('Error creating page:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create page' },
      { status: 500 }
    );
  }
}
