'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { TextInput } from '@/components/tvmonitor/studio/fields';

const ACCEPT = {
  image: 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml',
  media: 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime',
} as const;

/**
 * URL field with a direct-to-storage upload button. Files go straight from
 * the browser to Supabase Storage via a signed URL from /api/tvmonitor/media,
 * so uploads aren't capped by the serverless request-body limit.
 */
export default function MediaInput({
  value,
  onChange,
  accept = 'image',
  placeholder,
}: {
  value: string;
  /** kind is set only for uploads ('image' | 'video') — callers can auto-set asset type; undefined when the URL was typed. */
  onChange: (url: string, kind?: 'image' | 'video') => void;
  accept?: keyof typeof ACCEPT;
  placeholder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const signRes = await fetch('/api/tvmonitor/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type, sizeBytes: file.size }),
      });
      const sign = await signRes.json();
      if (!signRes.ok) throw new Error(sign.error || 'Upload failed');

      const putRes = await fetch(sign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error('Upload failed — please try again');

      onChange(sign.publicUrl, sign.kind === 'video' ? 'video' : 'image');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <TextInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'https://… or upload a file'}
        />
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT[accept]}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
