import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic';

// Lazy initialization to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  try {
    const { searchParams } = new URL(request.url);
    const pageSlug = searchParams.get('pageSlug');
    const partnerGroupId = searchParams.get('partnerGroupId');
    const days = parseInt(searchParams.get('days') || '30');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();
    
    // Build filters
    const viewsFilter: any = { created_at: { gte: startDateStr } };
    const eventsFilter: any = { created_at: { gte: startDateStr } };
    
    if (pageSlug) {
      viewsFilter.page_slug = pageSlug;
      eventsFilter.page_slug = pageSlug;
    }
    if (partnerGroupId) {
      viewsFilter.partner_group_id = partnerGroupId;
      eventsFilter.partner_group_id = partnerGroupId;
    }
    
    // Get total views
    let viewsQuery = supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDateStr);
    
    if (pageSlug) viewsQuery = viewsQuery.eq('page_slug', pageSlug);
    if (partnerGroupId) viewsQuery = viewsQuery.eq('partner_group_id', partnerGroupId);
    
    const { count: totalViews } = await viewsQuery;
    
    // Get unique visitors
    let uniqueQuery = supabase
      .from('page_views')
      .select('ip_hash')
      .gte('created_at', startDateStr);
    
    if (pageSlug) uniqueQuery = uniqueQuery.eq('page_slug', pageSlug);
    if (partnerGroupId) uniqueQuery = uniqueQuery.eq('partner_group_id', partnerGroupId);
    
    const { data: uniqueData } = await uniqueQuery;
    const uniqueVisitors = new Set(uniqueData?.map(d => d.ip_hash)).size;
    
    // Get register clicks
    let registerQuery = supabase
      .from('page_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'click_register')
      .gte('created_at', startDateStr);
    
    if (pageSlug) registerQuery = registerQuery.eq('page_slug', pageSlug);
    if (partnerGroupId) registerQuery = registerQuery.eq('partner_group_id', partnerGroupId);
    
    const { count: registerClicks } = await registerQuery;
    
    // Get daily breakdown for chart
    const { data: dailyViews } = await supabase
      .from('page_views')
      .select('created_at, page_slug')
      .gte('created_at', startDateStr)
      .order('created_at', { ascending: true });
    
    // Group by day
    const dailyStats: Record<string, { views: number; date: string }> = {};
    dailyViews?.forEach(view => {
      const date = view.created_at.split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { views: 0, date };
      }
      dailyStats[date].views++;
    });
    
    // Get top pages
    const { data: pageViews } = await supabase
      .from('page_views')
      .select('page_slug')
      .gte('created_at', startDateStr);
    
    const pageCounts: Record<string, number> = {};
    pageViews?.forEach(v => {
      pageCounts[v.page_slug] = (pageCounts[v.page_slug] || 0) + 1;
    });
    
    const topPages = Object.entries(pageCounts)
      .map(([slug, count]) => ({ slug, views: count }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
    
    // Get event breakdown
    const { data: events } = await supabase
      .from('page_events')
      .select('event_type')
      .gte('created_at', startDateStr);
    
    const eventCounts: Record<string, number> = {};
    events?.forEach(e => {
      eventCounts[e.event_type] = (eventCounts[e.event_type] || 0) + 1;
    });
    
    return NextResponse.json({
      summary: {
        totalViews: totalViews || 0,
        uniqueVisitors,
        registerClicks: registerClicks || 0,
        conversionRate: totalViews ? ((registerClicks || 0) / totalViews * 100).toFixed(2) : '0',
      },
      dailyStats: Object.values(dailyStats),
      topPages,
      eventBreakdown: eventCounts,
      period: { days, startDate: startDateStr },
    });
  } catch (error) {
    console.error('Analytics stats error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
