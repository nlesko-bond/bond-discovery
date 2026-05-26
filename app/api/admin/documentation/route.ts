import { NextRequest, NextResponse } from 'next/server';
import {
  createDocumentationPage,
  getAllDocumentationPages,
} from '@/lib/documentation-pages';
import { requireAdminApiAccess } from '@/lib/admin-api-access';

const HTTP_BAD_REQUEST_STATUS = 400;
const HTTP_CREATED_STATUS = 201;
const HTTP_SERVER_ERROR_STATUS = 500;

type DocumentationCreateBody = {
  title: string;
  path: string;
  sourceHtml: string;
  isActive?: boolean;
};

export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCreateBody(value: unknown): DocumentationCreateBody | null {
  if (!isRecord(value)) {
    return null;
  }

  const title = value.title;
  const path = value.path;
  const sourceHtml = value.sourceHtml ?? value.source_html;
  const isActive = value.isActive ?? value.is_active;

  if (typeof title !== 'string' || typeof path !== 'string' || typeof sourceHtml !== 'string') {
    return null;
  }

  return {
    title,
    path,
    sourceHtml,
    isActive: typeof isActive === 'boolean' ? isActive : undefined,
  };
}

export async function GET() {
  const access = await requireAdminApiAccess();
  if (!access.ok) {
    return access.response;
  }

  try {
    const pages = await getAllDocumentationPages();
    return NextResponse.json(
      { pages },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    );
  } catch (error) {
    console.error('[Admin/Documentation] GET:', error);
    return NextResponse.json({ error: 'Failed to fetch documentation pages' }, { status: HTTP_SERVER_ERROR_STATUS });
  }
}

export async function POST(request: NextRequest) {
  const access = await requireAdminApiAccess();
  if (!access.ok) {
    return access.response;
  }

  try {
    const body = parseCreateBody(await request.json());

    if (!body) {
      return NextResponse.json(
        { error: 'title, path, and sourceHtml are required' },
        { status: HTTP_BAD_REQUEST_STATUS },
      );
    }

    const page = await createDocumentationPage({
      ...body,
      authorEmail: access.email,
    });

    return NextResponse.json({ page }, { status: HTTP_CREATED_STATUS });
  } catch (error) {
    console.error('[Admin/Documentation] POST:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create documentation page' },
      { status: HTTP_SERVER_ERROR_STATUS },
    );
  }
}
