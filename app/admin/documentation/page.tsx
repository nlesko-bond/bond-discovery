'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ExternalLink, FilePlus2, Loader2, Pencil, Trash2 } from 'lucide-react';

const ICON_SIZE_SM = 13;
const ICON_SIZE_LG = 16;

type DocumentationPage = {
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function DocumentationAdminPage() {
  const [pages, setPages] = useState<DocumentationPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPages();
  }, []);

  async function fetchPages() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/documentation');
      const data = (await response.json()) as { pages?: DocumentationPage[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load documentation pages');
      }
      setPages(data.pages || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load documentation pages');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(page: DocumentationPage) {
    if (!confirm(`Delete documentation page "${page.title}"?`)) {
      return;
    }

    setDeletingId(page.id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/documentation/${page.id}`, { method: 'DELETE' });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete documentation page');
      }
      await fetchPages();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete documentation page');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documentation</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            Create and manage public documentation pages served under{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">/documentation</code>.
          </p>
        </div>
        <Link
          href="/admin/documentation/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <FilePlus2 size={ICON_SIZE_LG} />
          New page
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Pages</h2>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-gray-500">
            <Loader2 className="animate-spin" size={ICON_SIZE_LG} />
            Loading documentation pages
          </div>
        ) : pages.length === 0 ? (
          <div className="px-5 py-10 text-sm text-gray-500">No documentation pages have been created yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Title</th>
                  <th className="px-5 py-3 font-semibold">Path</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Updated</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pages.map((page) => (
                  <tr key={page.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-900">{page.title}</div>
                      {page.updatedByEmail ? (
                        <div className="mt-1 text-xs text-gray-500">Updated by {page.updatedByEmail}</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-blue-700">{page.publicPath}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          page.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {page.isActive ? 'Active' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{formatDate(page.updatedAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/documentation/${page.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Pencil size={ICON_SIZE_SM} />
                          Edit
                        </Link>
                        <a
                          href={page.publicPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <ExternalLink size={ICON_SIZE_SM} />
                          Open
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDelete(page)}
                          disabled={deletingId === page.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 size={ICON_SIZE_SM} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
