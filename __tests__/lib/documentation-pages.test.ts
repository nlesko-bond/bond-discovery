import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockOrder = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => mockFrom(table),
  }),
}));

import {
  createDocumentationPage,
  deleteDocumentationPage,
  getActiveDocumentationPageByPath,
  getAllDocumentationPages,
  normalizeDocumentationPath,
  updateDocumentationPage,
} from '@/lib/documentation-pages';

const documentationRow = {
  id: 'doc-1',
  title: 'API Documentation',
  path: 'apis',
  source_html: '<!DOCTYPE html><html><body>API docs</body></html>',
  is_active: true,
  created_by_email: 'staff@bondsports.co',
  updated_by_email: 'staff@bondsports.co',
  created_at: '2026-05-25T12:00:00.000Z',
  updated_at: '2026-05-25T12:30:00.000Z',
};

function chainWithResult(result: unknown) {
  return {
    select: mockSelect.mockReturnThis(),
    insert: mockInsert.mockReturnThis(),
    update: mockUpdate.mockReturnThis(),
    delete: mockDelete.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    single: mockSingle.mockResolvedValue(result),
    maybeSingle: mockMaybeSingle.mockResolvedValue(result),
    order: mockOrder.mockResolvedValue(result),
  };
}

describe('documentation pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue(chainWithResult({ data: null, error: null }));
  });

  describe('normalizeDocumentationPath', () => {
    it('stores paths beneath the public documentation prefix', () => {
      expect(normalizeDocumentationPath('documentation/apis')).toEqual({
        path: 'apis',
        publicPath: '/documentation/apis',
      });
      expect(normalizeDocumentationPath('/documentation/apis/reference')).toEqual({
        path: 'apis/reference',
        publicPath: '/documentation/apis/reference',
      });
      expect(normalizeDocumentationPath('apis')).toEqual({
        path: 'apis',
        publicPath: '/documentation/apis',
      });
    });

    it('rejects paths that can escape the public documentation namespace', () => {
      expect(() => normalizeDocumentationPath('')).toThrow('Documentation path is required');
      expect(() => normalizeDocumentationPath('documentation')).toThrow('Documentation path needs at least one segment after /documentation');
      expect(() => normalizeDocumentationPath('../admin')).toThrow('Documentation path segments can use lowercase letters, numbers, and hyphens');
      expect(() => normalizeDocumentationPath('apis/<script>')).toThrow('Documentation path segments can use lowercase letters, numbers, and hyphens');
    });
  });

  it('maps database rows to admin-facing page objects', async () => {
    mockOrder.mockResolvedValue({ data: [documentationRow], error: null });
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnThis(),
      order: mockOrder,
    });

    const pages = await getAllDocumentationPages();

    expect(mockFrom).toHaveBeenCalledWith('documentation_pages');
    expect(mockOrder).toHaveBeenCalledWith('path');
    expect(pages).toEqual([
      {
        id: 'doc-1',
        title: 'API Documentation',
        path: 'apis',
        publicPath: '/documentation/apis',
        sourceHtml: '<!DOCTYPE html><html><body>API docs</body></html>',
        isActive: true,
        createdByEmail: 'staff@bondsports.co',
        updatedByEmail: 'staff@bondsports.co',
        createdAt: '2026-05-25T12:00:00.000Z',
        updatedAt: '2026-05-25T12:30:00.000Z',
      },
    ]);
  });

  it('fetches only active public documentation pages by normalized path', async () => {
    mockMaybeSingle.mockResolvedValue({ data: documentationRow, error: null });
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    });

    const page = await getActiveDocumentationPageByPath('documentation/apis');

    expect(mockEq).toHaveBeenCalledWith('path', 'apis');
    expect(mockEq).toHaveBeenCalledWith('is_active', true);
    expect(page?.publicPath).toBe('/documentation/apis');
  });

  it('creates documentation pages with normalized paths and author metadata', async () => {
    mockSingle.mockResolvedValue({ data: documentationRow, error: null });
    mockFrom.mockReturnValue(chainWithResult({ data: documentationRow, error: null }));

    const page = await createDocumentationPage({
      title: 'API Documentation',
      path: '/documentation/apis',
      sourceHtml: documentationRow.source_html,
      isActive: true,
      authorEmail: 'staff@bondsports.co',
    });

    expect(mockInsert).toHaveBeenCalledWith({
      title: 'API Documentation',
      path: 'apis',
      source_html: documentationRow.source_html,
      is_active: true,
      created_by_email: 'staff@bondsports.co',
      updated_by_email: 'staff@bondsports.co',
    });
    expect(page.path).toBe('apis');
  });

  it('updates documentation pages by id without allowing empty updates', async () => {
    mockSingle.mockResolvedValue({ data: documentationRow, error: null });
    mockFrom.mockReturnValue(chainWithResult({ data: documentationRow, error: null }));

    await expect(updateDocumentationPage('doc-1', {}, 'staff@bondsports.co')).rejects.toThrow(
      'No documentation page updates were provided',
    );

    const page = await updateDocumentationPage(
      'doc-1',
      {
        path: '/documentation/apis',
        isActive: false,
      },
      'staff@bondsports.co',
    );

    expect(mockUpdate).toHaveBeenCalledWith({
      path: 'apis',
      is_active: false,
      updated_by_email: 'staff@bondsports.co',
    });
    expect(mockEq).toHaveBeenCalledWith('id', 'doc-1');
    expect(page.path).toBe('apis');
  });

  it('deletes documentation pages by id', async () => {
    mockEq.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      delete: mockDelete.mockReturnThis(),
      eq: mockEq,
    });

    await expect(deleteDocumentationPage('doc-1')).resolves.toBe(true);

    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('id', 'doc-1');
  });
});
