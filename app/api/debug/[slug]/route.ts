import { NextResponse } from 'next/server';
import { getConfigBySlug } from '@/lib/config';
import { getSupabaseAdmin } from '@/lib/supabase';

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
    // Get raw data from database to see what's actually there
    const supabaseAdmin = getSupabaseAdmin();
    const { data: rawData, error: rawError } = await supabaseAdmin
      .from('discovery_pages')
      .select(`
        *,
        partner_group:partner_groups(id, api_key, gtm_id)
      `)
      .eq('slug', params.slug)
      .single();
    
    const config = await getConfigBySlug(params.slug);
    
    if (!config) {
      return NextResponse.json({ 
        error: 'Config not found',
        slug: params.slug,
        rawError: rawError?.message
      }, { status: 404 });
    }
    
    // Return debug info (mask the actual API key for security)
    return NextResponse.json({
      slug: config.slug,
      name: config.name,
      
      // Raw database values
      raw: {
        partner_group_id: rawData?.partner_group_id || 'NOT SET IN DB',
        api_key: rawData?.api_key ? `${rawData.api_key.substring(0, 8)}...` : 'NONE ON PAGE',
        partner_group: rawData?.partner_group ? {
          id: rawData.partner_group.id,
          hasApiKey: !!rawData.partner_group.api_key,
          apiKeyPreview: rawData.partner_group.api_key ? `${rawData.partner_group.api_key.substring(0, 8)}...` : 'NONE ON GROUP',
        } : 'NO PARTNER GROUP JOINED',
      },
      
      // Resolved values
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
