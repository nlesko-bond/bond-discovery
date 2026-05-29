'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

const GL_CODES_TEMPLATE_HREF = '/onboarding/templates/accounting-codes.csv';

type Props = {
  slug: string;
  uploadedAt: string | null;
  originalFilename: string | null;
};

export function GlCodesCsvUploader({ slug, uploadedAt, originalFilename }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      setErrorMsg(null);
      setPending(true);
      try {
        const fd = new FormData();
        fd.append('file', file, file.name);
        const res = await fetch(`/api/onboard/${encodeURIComponent(slug)}/upload-gl-codes-csv`, {
          method: 'POST',
          body: fd,
        });
        let body: unknown;
        try {
          body = await res.json();
        } catch {
          body = {};
        }
        const err =
          typeof body === 'object' && body !== null && 'error' in body
            ? String((body as { error?: unknown }).error ?? '')
            : '';
        if (!res.ok) {
          setErrorMsg(err || `Upload failed (${res.status})`);
          return;
        }
        router.refresh();
      } finally {
        setPending(false);
      }
    },
    [router, slug],
  );

  return (
    <div className="mt-4 rounded-[8px] border border-dashed border-bond-border bg-bond-bg px-4 py-4">
      <p className="text-[15px] font-medium text-bond-text">Accounting codes (CSV)</p>
      <p className="mt-2 text-[15px] leading-relaxed text-bond-muted-dark sm:text-[16px]">
        Download our template and upload your completed spreadsheet. Accepted format: comma-separated CSV, up to 5 MB.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a
          href={GL_CODES_TEMPLATE_HREF}
          download="accounting-codes-template.csv"
          className="inline-flex rounded-[7px] border border-bond-border bg-white px-3 py-2 text-[14px] font-medium text-bond-brand hover:bg-[#f7f7f6]"
        >
          Download CSV template
        </a>
        <label className="inline-flex cursor-pointer rounded-[7px] bg-bond-brand px-3 py-2 text-[14px] font-medium text-white hover:opacity-90">
          <input
            type="file"
            name="gl_codes_csv"
            accept=".csv,text/csv,text/plain"
            disabled={pending}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void upload(f);
            }}
          />
          {pending ? 'Uploading…' : 'Upload CSV'}
        </label>
      </div>
      {errorMsg ? <p className="mt-3 text-[14px] text-red-700">{errorMsg}</p> : null}
      {uploadedAt ? (
        <p className="mt-3 text-[14px] text-bond-green-dark">
          Last upload:{' '}
          <time dateTime={uploadedAt}>
            {new Date(uploadedAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </time>
          {originalFilename ? ` (${originalFilename})` : null}.
        </p>
      ) : (
        <p className="mt-3 text-[14px] text-bond-muted-dark">No file uploaded yet.</p>
      )}
    </div>
  );
}
