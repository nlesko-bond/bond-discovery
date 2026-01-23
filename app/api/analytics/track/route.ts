import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Force dynamic rendering - this route uses request headers
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Hash IP for privacy
function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip + process.env.NEXTAUTH_SECRET).digest('hex').slice(0, 16);
}

// Get IP from request
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() || realIP || 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, pageSlug, eventType, eventData, viewMode, scheduleView } = body;
    
    if (!pageSlug) {
      return NextResponse.json({ error: 'pageSlug required' }, { status: 400 });
    }
    
    const ip = getClientIP(request);
    const ipHash = hashIP(ip);
    const userAgent = request.headers.get('user-agent') || '';
    const referrer = request.headers.get('referer') || '';
    
    // Get partner_group_id from the page
    const { data: page } = await supabase
      .from('discovery_pages')
      .select('partner_group_id')
      .eq('slug', pageSlug)
      .single();
    
    const partnerGroupId = page?.partner_group_id || null;
    
    if (type === 'pageview') {
      // Track page view
      const { error } = await supabase.from('page_views').insert({
        page_slug: pageSlug,
        partner_group_id: partnerGroupId,
        user_agent: userAgent.slice(0, 500),
        referrer: referrer.slice(0, 1000),
        ip_hash: ipHash,
        view_mode: viewMode,
        schedule_view: scheduleView,
      });
      
      if (error) {
        console.error('Error tracking page view:', error);
        return NextResponse.json({ error: 'Failed to track' }, { status: 500 });
      }
    } else if (type === 'event') {
      // Track event
      if (!eventType) {
        return NextResponse.json({ error: 'eventType required' }, { status: 400 });
      }
      
      const { error } = await supabase.from('page_events').insert({
        page_slug: pageSlug,
        partner_group_id: partnerGroupId,
        event_type: eventType,
        event_data: eventData || {},
        ip_hash: ipHash,
      });
      
      if (error) {
        console.error('Error tracking event:', error);
        return NextResponse.json({ error: 'Failed to track' }, { status: 500 });
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics track error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
