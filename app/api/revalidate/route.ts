import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { cacheDeletePattern, cacheClear } from '@/lib/cache';

export const dynamic = 'force-dynamic';

/**
 * Revalidate cache for a specific page or all pages
 * 
 * Usage:
 * - Revalidate specific page: GET /api/revalidate?slug=toca-allen-adult-pickup-soccer
 * - Revalidate all pages: GET /api/revalidate?all=true
 * - Secret token (optional): GET /api/revalidate?slug=xxx&secret=YOUR_SECRET
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const all = searchParams.get('all');
  const secret = searchParams.get('secret');
  
  // Optional: Check secret token for security
  // if (secret !== process.env.REVALIDATE_SECRET) {
  //   return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  // }
  
  try {
    if (all === 'true') {
      // Clear all cache
      await cacheClear();
      revalidatePath('/', 'layout');
      return NextResponse.json({ 
        success: true, 
        message: 'All cache cleared and paths revalidated' 
      });
    }
    
    if (slug) {
      // Clear cache for specific slug patterns
      await cacheDeletePattern(`*${slug}*`);
      
      // Revalidate the specific page paths
      revalidatePath(`/${slug}`);
      revalidatePath(`/embed/${slug}`);
      
      return NextResponse.json({ 
        success: true, 
        message: `Cache cleared and path revalidated for: ${slug}` 
      });
    }
    
    return NextResponse.json({ 
      error: 'Please provide slug or all=true parameter' 
    }, { status: 400 });
    
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json({ 
      error: 'Failed to revalidate' 
    }, { status: 500 });
  }
}
