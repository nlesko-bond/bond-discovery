import { NextRequest, NextResponse } from 'next/server';
import { getActiveDocumentationPageByPath } from '@/lib/documentation-pages';

const HTTP_NOT_FOUND_STATUS = 404;

const DOCUMENTATION_HTML_CSP = [
  'sandbox allow-scripts allow-popups allow-forms allow-downloads',
  "default-src 'self' https: data: blob:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' https: data: blob:",
  "font-src 'self' https: data:",
  "connect-src 'self' https:",
  "frame-ancestors 'self'",
].join('; ');

type DocumentationRouteContext = {
  params: Promise<{ path: string[] }>;
};

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, context: DocumentationRouteContext) {
  const { path } = await context.params;
  const documentationPath = path.join('/');
  const page = await getDocumentationPageOrNull(documentationPath);

  if (!page) {
    return new NextResponse('Not found', {
      status: HTTP_NOT_FOUND_STATUS,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  return new NextResponse(page.sourceHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Content-Security-Policy': DOCUMENTATION_HTML_CSP,
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function getDocumentationPageOrNull(documentationPath: string) {
  try {
    return await getActiveDocumentationPageByPath(documentationPath);
  } catch {
    return null;
  }
}
