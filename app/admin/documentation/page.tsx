'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, FilePlus2, Globe, Loader2, Pencil, Trash2 } from 'lucide-react';

const DEFAULT_DOCUMENTATION_HTML = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n<title>Documentation</title>\n</head>\n<body>\n<h1>Documentation</h1>\n</body>\n</html>';
const HTML_TEXTAREA_ROWS = 28;
const ICON_SIZE_XS = 12;
const ICON_SIZE_SM = 13;
const ICON_SIZE_MD = 14;
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

type DocumentationFormState = {
  id: string | null;
  title: string;
  path: string;
  sourceHtml: string;
  isActive: boolean;
};

const emptyFormState: DocumentationFormState = {
  id: null,
  title: '',
  path: 'documentation/apis',
  sourceHtml: DEFAULT_DOCUMENTATION_HTML,
  isActive: true,
};

function getPublicPathFromInput(path: string): string {
  const trimmedPath = path.trim().replace(/^\/+|\/+$/g, '');
  const withoutPrefix = trimmedPath.toLowerCase().startsWith('documentation/')
    ? trimmedPath.slice('documentation/'.length)
    : trimmedPath;

  return `/documentation/${withoutPrefix}`;
}

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
  const [form, setForm] = useState<DocumentationFormState>(emptyFormState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedPageId, setSavedPageId] = useState<string | null>(null);

  const publicPathPreview = useMemo(() => getPublicPathFromInput(form.path), [form.path]);

  useEffect(() => {
    fetchPages();
  }, []);

  async function fetchPages() {
    setLoading(true);
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

  function startCreate() {
    setForm(emptyFormState);
    setSavedPageId(null);
    setError(null);
  }

  function startEdit(page: DocumentationPage) {
    setForm({
      id: page.id,
      title: page.title,
      path: page.publicPath,
      sourceHtml: page.sourceHtml,
      isActive: page.isActive,
    });
    setSavedPageId(null);
    setError(null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSavedPageId(null);

    const openedWindow = window.open('about:blank', '_blank');
    if (openedWindow) {
      openedWindow.opener = null;
    }

    try {
      const response = await fetch(form.id ? `/api/admin/documentation/${form.id}` : '/api/admin/documentation', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          path: form.path,
          sourceHtml: form.sourceHtml,
          isActive: form.isActive,
        }),
      });

      const data = (await response.json()) as { page?: DocumentationPage; error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save documentation page');
      }

      if (!data.page) {
        throw new Error('Saved documentation page was not returned');
      }

      const savedPage = data.page;
      setSavedPageId(savedPage.id);
      setForm({
        id: savedPage.id,
        title: savedPage.title,
        path: savedPage.publicPath,
        sourceHtml: savedPage.sourceHtml,
        isActive: savedPage.isActive,
      });
      await fetchPages();

      if (openedWindow) {
        openedWindow.location.href = savedPage.publicPath;
      } else {
        window.open(savedPage.publicPath, '_blank', 'noopener,noreferrer');
      }
    } catch (saveError) {
      if (openedWindow) {
        openedWindow.close();
      }
      setError(saveError instanceof Error ? saveError.message : 'Failed to save documentation page');
    } finally {
      setSaving(false);
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
      if (form.id === page.id) {
        startCreate();
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
            Create public documentation pages from trusted full HTML. Saved pages are served under{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">/documentation</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <FilePlus2 size={ICON_SIZE_LG} />
          New page
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Pages</h2>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-gray-500">
              <Loader2 className="animate-spin" size={ICON_SIZE_LG} />
              Loading documentation pages
            </div>
          ) : pages.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-500">No documentation pages have been created yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className={`space-y-3 p-4 ${form.id === page.id ? 'bg-blue-50/60' : 'bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{page.title}</p>
                      <p className="mt-1 truncate font-mono text-xs text-blue-700">{page.publicPath}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        page.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {page.isActive ? 'Active' : 'Draft'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Updated {formatDate(page.updatedAt)}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(page)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil size={ICON_SIZE_SM} />
                      Edit
                    </button>
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
                </div>
              ))}
            </div>
          )}
        </section>

        <form onSubmit={handleSave} className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {form.id ? 'Edit documentation page' : 'Create documentation page'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Save opens the public page in a new tab after the HTML is persisted.
                </p>
              </div>
              {savedPageId !== null && savedPageId === form.id ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                  <Check size={ICON_SIZE_MD} />
                  Saved
                </span>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-gray-700">Title</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="API Documentation"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-gray-700">Public path</span>
                <input
                  value={form.path}
                  onChange={(event) => setForm({ ...form, path: event.target.value })}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="documentation/apis"
                />
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Globe size={ICON_SIZE_XS} />
                  Will publish at <code className="rounded bg-gray-100 px-1">{publicPathPreview}</code>
                </span>
              </label>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              Publish this page
            </label>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-900">Source HTML</h2>
              </div>
              <textarea
                value={form.sourceHtml}
                onChange={(event) => setForm({ ...form, sourceHtml: event.target.value })}
                rows={HTML_TEXTAREA_ROWS}
                required
                spellCheck={false}
                className="h-[720px] w-full resize-y rounded-b-xl border-0 p-4 font-mono text-xs leading-5 text-gray-900 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-900">Preview</h2>
              </div>
              <iframe
                title="Documentation preview"
                srcDoc={form.sourceHtml}
                sandbox="allow-scripts allow-popups allow-forms allow-downloads"
                className="h-[720px] w-full rounded-b-xl bg-white"
              />
            </div>
          </section>

          <div className="sticky bottom-4 z-10 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={ICON_SIZE_LG} /> : <ExternalLink size={ICON_SIZE_LG} />}
              {saving ? 'Saving' : 'Save and open'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
