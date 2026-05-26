import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetActiveDocumentationPageByPath = vi.fn();

vi.mock('@/lib/documentation-pages', () => ({
  getActiveDocumentationPageByPath: (path: string) => mockGetActiveDocumentationPageByPath(path),
}));

import { GET } from '@/app/documentation/[...path]/route';

const trustedHtml = '<!DOCTYPE html><html><body><script>window.docsLoaded = true;</script>API docs</body></html>';

describe('public documentation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serves active trusted HTML with a sandboxed content security policy', async () => {
    mockGetActiveDocumentationPageByPath.mockResolvedValue({
      sourceHtml: trustedHtml,
    });

    const response = await GET(new NextRequest('http://localhost:3000/documentation/apis'), {
      params: Promise.resolve({ path: ['apis'] }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(trustedHtml);
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('Content-Security-Policy')).toContain('sandbox allow-scripts');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate');
    expect(mockGetActiveDocumentationPageByPath).toHaveBeenCalledWith('apis');
  });

  it('returns not found when the documentation path is inactive or missing', async () => {
    mockGetActiveDocumentationPageByPath.mockResolvedValue(null);

    const response = await GET(new NextRequest('http://localhost:3000/documentation/missing'), {
      params: Promise.resolve({ path: ['missing'] }),
    });

    expect(response.status).toBe(404);
  });

  it('returns not found when the documentation path is invalid', async () => {
    mockGetActiveDocumentationPageByPath.mockRejectedValue(new Error('Invalid path'));

    const response = await GET(new NextRequest('http://localhost:3000/documentation/%3Cscript%3E'), {
      params: Promise.resolve({ path: ['<script>'] }),
    });

    expect(response.status).toBe(404);
  });
});
