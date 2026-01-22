import { NextRequest, NextResponse } from 'next/server';
import { getAllPageConfigs, createPageConfig, defaultConfig } from '@/lib/config';

export async function GET() {
  try {
    const pages = await getAllPageConfigs();
    return NextResponse.json({ pages });
  } catch (error) {
    console.error('Error fetching pages:', error);
    return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Note: Auth temporarily disabled for easier setup
    // TODO: Re-enable when Google OAuth is configured
    
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
    
    return NextResponse.json({ page: newConfig });
  } catch (error: any) {
    console.error('Error creating page:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create page' },
      { status: 500 }
    );
  }
}
