'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, Globe, Loader2, PencilLine } from 'lucide-react';
import {
  buildTextEditableDocumentationPreviewHtml,
  DOCUMENTATION_PREVIEW_SYNC_REQUEST_TYPE,
  isDocumentationPreviewHtmlMessage,
} from '@/lib/documentation-preview-edit';

const DEFAULT_DOCUMENTATION_HTML = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n<title>Documentation</title>\n</head>\n<body>\n<h1>Documentation</h1>\n</body>\n</html>';
const EXAMPLE_DOCUMENTATION_PATH = 'documentation/your-category/your-page';
const HTML_TEXTAREA_ROWS = 34;
const PREVIEW_HEIGHT_CLASS = 'h-[78vh] min-h-[720px]';
const ICON_SIZE_XS = 12;
const ICON_SIZE_MD = 14;
const ICON_SIZE_LG = 16;
const ICON_SIZE_XL = 18;
const PREVIEW_SYNC_TIMEOUT_MS = 500;

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

type DocumentationEditorProps = {
  pageId?: string;
};

const emptyFormState: DocumentationFormState = {
  id: null,
  title: '',
  path: '',
  sourceHtml: DEFAULT_DOCUMENTATION_HTML,
  isActive: true,
};

function createPreviewNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

function getPublicPathFromInput(path: string): string {
  const trimmedPath = path.trim().replace(/^\/+|\/+$/g, '');
  if (!trimmedPath) {
    return `/${EXAMPLE_DOCUMENTATION_PATH}`;
  }
  const withoutPrefix = trimmedPath.toLowerCase().startsWith('documentation/')
    ? trimmedPath.slice('documentation/'.length)
    : trimmedPath;

  return `/documentation/${withoutPrefix}`;
}

export function DocumentationEditor({ pageId }: DocumentationEditorProps) {
  const router = useRouter();
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [previewNonce] = useState(createPreviewNonce);
  const [form, setForm] = useState<DocumentationFormState>(emptyFormState);
  const [loading, setLoading] = useState(Boolean(pageId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPageId, setSavedPageId] = useState<string | null>(null);
  const [previewTextEditingEnabled, setPreviewTextEditingEnabled] = useState(false);
  const [editablePreviewHtml, setEditablePreviewHtml] = useState(() =>
    buildTextEditableDocumentationPreviewHtml(emptyFormState.sourceHtml, previewNonce),
  );

  const publicPathPreview = useMemo(() => getPublicPathFromInput(form.path), [form.path]);
  const previewHtml = previewTextEditingEnabled ? editablePreviewHtml : form.sourceHtml;

  useEffect(() => {
    if (!pageId) {
      setLoading(false);
      return;
    }

    async function fetchPage() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/documentation/${pageId}`);
        const data = (await response.json()) as { page?: DocumentationPage; error?: string };
        if (!response.ok || !data.page) {
          throw new Error(data.error || 'Failed to load documentation page');
        }
        const page = data.page;
        setForm({
          id: page.id,
          title: page.title,
          path: page.publicPath,
          sourceHtml: page.sourceHtml,
          isActive: page.isActive,
        });
        setEditablePreviewHtml(buildTextEditableDocumentationPreviewHtml(page.sourceHtml, previewNonce));
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load documentation page');
      } finally {
        setLoading(false);
      }
    }

    fetchPage();
  }, [pageId]);

  useEffect(() => {
    function handlePreviewMessage(event: MessageEvent<unknown>) {
      if (
        !previewTextEditingEnabled ||
        event.source !== previewFrameRef.current?.contentWindow ||
        !isDocumentationPreviewHtmlMessage(event.data, previewNonce)
      ) {
        return;
      }

      const message = event.data;
      setForm((currentForm) => ({
        ...currentForm,
        sourceHtml: message.sourceHtml,
      }));
      setSavedPageId(null);
    }

    window.addEventListener('message', handlePreviewMessage);
    return () => window.removeEventListener('message', handlePreviewMessage);
  }, [previewNonce, previewTextEditingEnabled]);

  function updateSourceHtml(sourceHtml: string) {
    setForm({ ...form, sourceHtml });
    setSavedPageId(null);
    if (previewTextEditingEnabled) {
      setEditablePreviewHtml(buildTextEditableDocumentationPreviewHtml(sourceHtml, previewNonce));
    }
  }

  function togglePreviewTextEditing(enabled: boolean) {
    setPreviewTextEditingEnabled(enabled);
    if (enabled) {
      setEditablePreviewHtml(buildTextEditableDocumentationPreviewHtml(form.sourceHtml, previewNonce));
    }
  }

  function requestLatestPreviewHtml(): Promise<string | null> {
    const previewWindow = previewFrameRef.current?.contentWindow;
    if (!previewTextEditingEnabled || !previewWindow) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      const timeoutId = window.setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        resolve(null);
      }, PREVIEW_SYNC_TIMEOUT_MS);

      function handleMessage(event: MessageEvent<unknown>) {
        if (
          event.source !== previewWindow ||
          !isDocumentationPreviewHtmlMessage(event.data, previewNonce)
        ) {
          return;
        }

        window.clearTimeout(timeoutId);
        window.removeEventListener('message', handleMessage);
        resolve(event.data.sourceHtml);
      }

      window.addEventListener('message', handleMessage);
      previewWindow.postMessage({
        type: DOCUMENTATION_PREVIEW_SYNC_REQUEST_TYPE,
        nonce: previewNonce,
      }, '*');
    });
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
      const latestPreviewHtml = await requestLatestPreviewHtml();
      const sourceHtmlToSave = latestPreviewHtml ?? form.sourceHtml;

      const response = await fetch(form.id ? `/api/admin/documentation/${form.id}` : '/api/admin/documentation', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          path: form.path,
          sourceHtml: sourceHtmlToSave,
          isActive: form.isActive,
        }),
      });

      const data = (await response.json()) as { page?: DocumentationPage; error?: string };
      if (!response.ok || !data.page) {
        throw new Error(data.error || 'Failed to save documentation page');
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
      setEditablePreviewHtml(buildTextEditableDocumentationPreviewHtml(savedPage.sourceHtml, previewNonce));

      if (!form.id) {
        router.replace(`/admin/documentation/${savedPage.id}`);
      }

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

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500 shadow-sm">
          <Loader2 className="animate-spin" size={ICON_SIZE_XL} />
          Loading documentation editor
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/admin/documentation"
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={ICON_SIZE_LG} />
            Back to documentation pages
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            {form.id ? 'Edit documentation page' : 'Create documentation page'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            Paste trusted full HTML, preview it, optionally edit visible text in the preview, then publish under{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">/documentation</code>.
          </p>
        </div>
        {savedPageId !== null && savedPageId === form.id ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            <Check size={ICON_SIZE_MD} />
            Saved
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <form onSubmit={handleSave} className="space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-gray-700">Title</span>
              <input
                value={form.title}
                onChange={(event) => {
                  setForm({ ...form, title: event.target.value });
                  setSavedPageId(null);
                }}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="API Documentation"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-gray-700">Public path</span>
              <input
                value={form.path}
                onChange={(event) => {
                  setForm({ ...form, path: event.target.value });
                  setSavedPageId(null);
                }}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder={EXAMPLE_DOCUMENTATION_PATH}
              />
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Globe size={ICON_SIZE_XS} />
                Will publish at <code className="rounded bg-gray-100 px-1">{publicPathPreview}</code>
              </span>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => {
                  setForm({ ...form, isActive: event.target.checked });
                  setSavedPageId(null);
                }}
                className="h-4 w-4 rounded border-gray-300"
              />
              Publish this page
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={previewTextEditingEnabled}
                onChange={(event) => togglePreviewTextEditing(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Edit visible text in preview
            </label>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(420px,0.8fr)_minmax(640px,1.2fr)]">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Source HTML</h2>
              {previewTextEditingEnabled ? (
                <span className="text-xs text-gray-500">Preview text edits sync here</span>
              ) : null}
            </div>
            <textarea
              value={form.sourceHtml}
              onChange={(event) => updateSourceHtml(event.target.value)}
              rows={HTML_TEXTAREA_ROWS}
              required
              spellCheck={false}
              className={`${PREVIEW_HEIGHT_CLASS} w-full resize-y rounded-b-xl border-0 p-4 font-mono text-xs leading-5 text-gray-900 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500`}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Preview</h2>
                {previewTextEditingEnabled ? (
                  <p className="mt-1 text-xs text-amber-700">
                    Text edit mode changes visible copy only. Save to publish those copy edits.
                  </p>
                ) : null}
              </div>
              {previewTextEditingEnabled ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                  <PencilLine size={ICON_SIZE_MD} />
                  Text editable
                </span>
              ) : null}
            </div>
            <iframe
              ref={previewFrameRef}
              title="Documentation preview"
              srcDoc={previewHtml}
              sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads"
              className={`${PREVIEW_HEIGHT_CLASS} w-full rounded-b-xl bg-white`}
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
  );
}
