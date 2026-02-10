import { NextResponse } from 'next/server';
import { getConfigBySlug } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to see config and API key resolution
 * Usage: GET /api/debug/toca-allen-adult-pickup-soccer
 */
export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const config = await getConfigBySlug(params.slug);
    
    if (!config) {
      return NextResponse.json({ 
        error: 'Config not found',
        slug: params.slug 
      }, { status: 404 });
    }
    
    // Return debug info (mask the actual API key for security)
    return NextResponse.json({
      slug: config.slug,
      name: config.name,
      partnerGroupId: config.partnerGroupId || 'NOT SET',
      hasApiKey: !!config.apiKey,
      apiKeyPreview: config.apiKey ? `${config.apiKey.substring(0, 8)}...` : 'NONE',
      organizationIds: config.organizationIds,
      facilityIds: config.facilityIds,
      isActive: config.isActive,
      features: {
        programFilterMode: config.features.programFilterMode || 'all',
        includedProgramIds: config.features.includedProgramIds || [],
        defaultView: config.features.defaultView,
        enabledTabs: config.features.enabledTabs || ['programs', 'schedule'],
      },
      excludedProgramIds: config.excludedProgramIds || [],
      includedProgramIds: config.includedProgramIds || [],
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ 
      error: 'Failed to get config',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
