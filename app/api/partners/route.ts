import { NextRequest, NextResponse } from 'next/server';
import { supabase, getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // Fetch partners with their pages (read operation - use anon client)
    const { data: partners, error } = await supabase
      .from('partner_groups')
      .select(`
        *,
        pages:discovery_pages(id, name, slug)
      `)
      .order('name');
    
    if (error) throw error;
    
    return NextResponse.json({ partners: partners || [] });
  } catch (error) {
    console.error('Error fetching partners:', error);
    return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.name || !body.slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }
    
    // Write operation - use admin client
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('partner_groups')
      .insert({
        name: body.name,
        slug: body.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        api_key: body.api_key || null,
        branding: body.branding || {
          companyName: body.name,
          primaryColor: '#1E2761',
          secondaryColor: '#6366F1',
          accentColor: '#8B5CF6',
        },
        default_features: body.default_features || {
          showPricing: true,
          showAvailability: true,
          showMembershipBadges: true,
          showAgeGender: true,
          enableFilters: ['search', 'facility', 'programType', 'sport', 'age', 'dateRange', 'program'],
          defaultView: 'programs',
          allowViewToggle: true,
        },
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ partner: data });
  } catch (error: any) {
    console.error('Error creating partner:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create partner' },
      { status: 500 }
    );
  }
}
