import { getSupabaseAdmin } from '@/lib/supabase';

const DOCUMENTATION_PREFIX = 'documentation';
const MAX_DOCUMENTATION_PATH_LENGTH = 200;
const MAX_DOCUMENTATION_PATH_SEGMENTS = 8;
const DOCUMENTATION_PATH_SEGMENT_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type DocumentationPageRow = {
  id: string;
  title: string;
  path: string;
  source_html: string;
  is_active: boolean;
  created_by_email: string | null;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentationPage = {
  id: string;
  title: string;
  path: string;
  publicPath: string;
  sourceHtml: string;
  isActive: boolean;
  createdByEmail: string | null;
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentationPageInput = {
  title: string;
  path: string;
  sourceHtml: string;
  isActive?: boolean;
  authorEmail: string;
};

export type DocumentationPageUpdates = Partial<
  Pick<DocumentationPageInput, 'title' | 'path' | 'sourceHtml' | 'isActive'>
>;

type NormalizedDocumentationPath = {
  path: string;
  publicPath: string;
};

type DocumentationPageUpdateRow = {
  title?: string;
  path?: string;
  source_html?: string;
  is_active?: boolean;
  updated_by_email: string;
};

export function normalizeDocumentationPath(rawPath: string): NormalizedDocumentationPath {
  const trimmedPath = rawPath.trim().replace(/^\/+|\/+$/g, '');
  if (!trimmedPath) {
    throw new Error('Documentation path is required');
  }

  const lowerPath = trimmedPath.toLowerCase().replace(/\/+/g, '/');
  const pathWithoutPrefix = lowerPath.startsWith(`${DOCUMENTATION_PREFIX}/`)
    ? lowerPath.slice(DOCUMENTATION_PREFIX.length + 1)
    : lowerPath;

  if (!pathWithoutPrefix || lowerPath === DOCUMENTATION_PREFIX) {
    throw new Error('Documentation path needs at least one segment after /documentation');
  }

  if (pathWithoutPrefix.length > MAX_DOCUMENTATION_PATH_LENGTH) {
    throw new Error('Documentation path is too long');
  }

  const segments = pathWithoutPrefix.split('/');
  if (segments.length > MAX_DOCUMENTATION_PATH_SEGMENTS) {
    throw new Error('Documentation path has too many segments');
  }

  if (!segments.every((segment) => DOCUMENTATION_PATH_SEGMENT_REGEX.test(segment))) {
    throw new Error('Documentation path segments can use lowercase letters, numbers, and hyphens');
  }

  return {
    path: pathWithoutPrefix,
    publicPath: `/${DOCUMENTATION_PREFIX}/${pathWithoutPrefix}`,
  };
}

function rowToDocumentationPage(row: DocumentationPageRow): DocumentationPage {
  const normalizedPath = normalizeDocumentationPath(row.path);

  return {
    id: row.id,
    title: row.title,
    path: normalizedPath.path,
    publicPath: normalizedPath.publicPath,
    sourceHtml: row.source_html,
    isActive: row.is_active,
    createdByEmail: row.created_by_email,
    updatedByEmail: row.updated_by_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllDocumentationPages(): Promise<DocumentationPage[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('documentation_pages').select('*').order('path');

  if (error) {
    console.error('[DocumentationPages] list error:', error);
    return [];
  }

  return ((data ?? []) as DocumentationPageRow[]).map(rowToDocumentationPage);
}

export async function getActiveDocumentationPageByPath(rawPath: string): Promise<DocumentationPage | null> {
  const db = getSupabaseAdmin();
  const { path } = normalizeDocumentationPath(rawPath);
  const { data, error } = await db
    .from('documentation_pages')
    .select('*')
    .eq('path', path)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return rowToDocumentationPage(data as DocumentationPageRow);
}

export async function getDocumentationPageById(id: string): Promise<DocumentationPage | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('documentation_pages').select('*').eq('id', id).maybeSingle();

  if (error || !data) {
    return null;
  }

  return rowToDocumentationPage(data as DocumentationPageRow);
}

export async function createDocumentationPage(input: DocumentationPageInput): Promise<DocumentationPage> {
  const db = getSupabaseAdmin();
  const { path } = normalizeDocumentationPath(input.path);

  const { data, error } = await db
    .from('documentation_pages')
    .insert({
      title: input.title,
      path,
      source_html: input.sourceHtml,
      is_active: input.isActive ?? true,
      created_by_email: input.authorEmail,
      updated_by_email: input.authorEmail,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[DocumentationPages] create error:', error);
    throw new Error(error?.message ?? 'Failed to create documentation page');
  }

  return rowToDocumentationPage(data as DocumentationPageRow);
}

export async function updateDocumentationPage(
  id: string,
  updates: DocumentationPageUpdates,
  authorEmail: string,
): Promise<DocumentationPage> {
  const db = getSupabaseAdmin();
  const updateRow: DocumentationPageUpdateRow = {
    updated_by_email: authorEmail,
  };

  if (updates.title !== undefined) updateRow.title = updates.title;
  if (updates.path !== undefined) updateRow.path = normalizeDocumentationPath(updates.path).path;
  if (updates.sourceHtml !== undefined) updateRow.source_html = updates.sourceHtml;
  if (updates.isActive !== undefined) updateRow.is_active = updates.isActive;

  if (Object.keys(updateRow).length === 1) {
    throw new Error('No documentation page updates were provided');
  }

  const { data, error } = await db
    .from('documentation_pages')
    .update(updateRow)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    console.error('[DocumentationPages] update error:', error);
    throw new Error(error?.message ?? 'Failed to update documentation page');
  }

  return rowToDocumentationPage(data as DocumentationPageRow);
}

export async function deleteDocumentationPage(id: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { error } = await db.from('documentation_pages').delete().eq('id', id);

  if (error) {
    console.error('[DocumentationPages] delete error:', error);
    return false;
  }

  return true;
}
