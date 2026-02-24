import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Admin-only route - use admin client for all operations
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('partner_groups')
      .select(`
        *,
        pages:discovery_pages(id, name, slug, organization_ids, facility_ids, is_active)
      `)
      .eq('id', params.id)
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ partner: data });
  } catch (error) {
    console.error('Error fetching partner:', error);
    return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.json();
    
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.api_key !== undefined) updateData.api_key = body.api_key;
    if (body.gtm_id !== undefined) updateData.gtm_id = body.gtm_id;
    if (body.branding !== undefined) updateData.branding = body.branding;
    if (body.default_features !== undefined) updateData.default_features = body.default_features;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    
    // Write operation - use admin client
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('partner_groups')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();
    
    if (error) throw error;

    let updatedPages = 0;
    if (body.applyBrandingToPages === true && body.branding) {
      const { data: updated, error: pageUpdateError } = await supabaseAdmin
        .from('discovery_pages')
        .update({ branding: body.branding })
        .eq('partner_group_id', params.id)
        .select('id');

      if (pageUpdateError) {
        throw pageUpdateError;
      }

      updatedPages = updated?.length || 0;
    }
    
    return NextResponse.json({ partner: data, updatedPages });
  } catch (error: any) {
    console.error('Error updating partner:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update partner' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Write operations - use admin client
    const supabaseAdmin = getSupabaseAdmin();
    
    // First delete all pages belonging to this partner
    await supabaseAdmin
      .from('discovery_pages')
      .delete()
      .eq('partner_group_id', params.id);
    
    // Then delete the partner
    const { error } = await supabaseAdmin
      .from('partner_groups')
      .delete()
      .eq('id', params.id);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting partner:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete partner' },
      { status: 500 }
    );
  }
}
