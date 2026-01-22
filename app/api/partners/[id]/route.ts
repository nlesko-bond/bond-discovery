import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { data, error } = await supabase
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
    if (body.branding !== undefined) updateData.branding = body.branding;
    if (body.default_features !== undefined) updateData.default_features = body.default_features;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    
    const { data, error } = await supabase
      .from('partner_groups')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ partner: data });
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
    // First delete all pages belonging to this partner
    await supabase
      .from('discovery_pages')
      .delete()
      .eq('partner_group_id', params.id);
    
    // Then delete the partner
    const { error } = await supabase
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
