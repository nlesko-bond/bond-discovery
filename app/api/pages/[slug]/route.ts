import { NextRequest, NextResponse } from 'next/server';
import { getConfigBySlug, updatePageConfig, deletePageConfig } from '@/lib/config';

interface RouteParams {
  params: { slug: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const config = await getConfigBySlug(params.slug);
    
    if (!config) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    
    return NextResponse.json({ page: config });
  } catch (error) {
    console.error('Error fetching page:', error);
    return NextResponse.json({ error: 'Failed to fetch page' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Note: Auth temporarily disabled for easier setup
    const body = await request.json();
    
    // Debug: Log what we're receiving
    console.log('[PATCH] Received features:', JSON.stringify(body.features, null, 2));
    console.log('[PATCH] includedProgramIds in features:', body.features?.includedProgramIds);
    
    // Update the page
    const updatedConfig = await updatePageConfig(params.slug, body);
    
    return NextResponse.json({ page: updatedConfig });
  } catch (error: any) {
    console.error('Error updating page:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update page' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Note: Auth temporarily disabled for easier setup
    const deleted = await deletePageConfig(params.slug);
    
    if (!deleted) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting page:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete page' },
      { status: 500 }
    );
  }
}
