import { NextResponse } from 'next/server';
import { getAllPageConfigs } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to see all pages (including drafts)
 * Usage: GET /api/debug/pages
 */
export async function GET() {
  try {
    const pages = await getAllPageConfigs();
    
    return NextResponse.json({
      totalPages: pages.length,
      pages: pages.map(p => ({
        name: p.name,
        slug: p.slug,
        isActive: p.isActive,
        status: p.isActive === false ? 'DRAFT' : 'ACTIVE',
      })),
    });
  } catch (error) {
    console.error('Debug pages error:', error);
    return NextResponse.json({ 
      error: 'Failed to get pages',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
