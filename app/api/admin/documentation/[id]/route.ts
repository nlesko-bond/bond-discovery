import { NextRequest, NextResponse } from 'next/server';
import {
  deleteDocumentationPage,
  updateDocumentationPage,
  type DocumentationPageUpdates,
} from '@/lib/documentation-pages';
import { requireAdminApiAccess } from '@/lib/admin-api-access';

const HTTP_BAD_REQUEST_STATUS = 400;
const HTTP_SERVER_ERROR_STATUS = 500;

type DocumentationUpdateContext = {
  params: Promise<{ id: string }>;
};

export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseUpdateBody(value: unknown): DocumentationPageUpdates | null {
  if (!isRecord(value)) {
    return null;
  }

  const updates: DocumentationPageUpdates = {};
  const sourceHtml = value.sourceHtml ?? value.source_html;
  const isActive = value.isActive ?? value.is_active;

  if (value.title !== undefined && typeof value.title !== 'string') {
    return null;
  }
  if (value.path !== undefined && typeof value.path !== 'string') {
    return null;
  }
  if (sourceHtml !== undefined && typeof sourceHtml !== 'string') {
    return null;
  }
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    return null;
  }

  if (typeof value.title === 'string') updates.title = value.title;
  if (typeof value.path === 'string') updates.path = value.path;
  if (typeof sourceHtml === 'string') updates.sourceHtml = sourceHtml;
  if (typeof isActive === 'boolean') updates.isActive = isActive;

  return updates;
}

export async function PATCH(request: NextRequest, context: DocumentationUpdateContext) {
  const access = await requireAdminApiAccess();
  if (!access.ok) {
    return access.response;
  }

  const { id } = await context.params;

  try {
    const updates = parseUpdateBody(await request.json());

    if (!updates) {
      return NextResponse.json({ error: 'Invalid documentation page updates' }, { status: HTTP_BAD_REQUEST_STATUS });
    }

    const page = await updateDocumentationPage(id, updates, access.email);
    return NextResponse.json({ page });
  } catch (error) {
    console.error('[Admin/Documentation] PATCH:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update documentation page' },
      { status: HTTP_SERVER_ERROR_STATUS },
    );
  }
}

export async function DELETE(_request: NextRequest, context: DocumentationUpdateContext) {
  const access = await requireAdminApiAccess();
  if (!access.ok) {
    return access.response;
  }

  const { id } = await context.params;

  try {
    const success = await deleteDocumentationPage(id);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete documentation page' }, { status: HTTP_SERVER_ERROR_STATUS });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin/Documentation] DELETE:', error);
    return NextResponse.json({ error: 'Failed to delete documentation page' }, { status: HTTP_SERVER_ERROR_STATUS });
  }
}
