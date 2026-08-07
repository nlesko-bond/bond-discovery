'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { TextInput } from '@/components/tvmonitor/studio/fields';
import {
  formatBytesLimit,
  MAX_TV_IMAGE_BYTES,
  MAX_TV_VIDEO_BYTES,
  uploadImageToCloudinary,
  uploadVideoToCloudinary,
} from '@/lib/cloudinaryUpload';

const ACCEPT = {
  image: 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml',
  media: 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime',
} as const;

const IMAGE_MIME_PREFIX = 'image/';
const CLOUDINARY_TV_FOLDER = 'facility-schedule/tvmonitor';

/**
 * URL field with image and video uploads to Bond Cloudinary.
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
      const isImage = file.type.startsWith(IMAGE_MIME_PREFIX);
      if (isImage) {
        if (file.size > MAX_TV_IMAGE_BYTES) {
          throw new Error(`Image too large — max ${formatBytesLimit(MAX_TV_IMAGE_BYTES)}.`);
        }
        const url = await uploadImageToCloudinary(file, CLOUDINARY_TV_FOLDER);
        onChange(url, 'image');
        return;
      }

      if (file.size > MAX_TV_VIDEO_BYTES) {
        throw new Error(`Video too large — max ${formatBytesLimit(MAX_TV_VIDEO_BYTES)}.`);
      }

      const url = await uploadVideoToCloudinary(file, CLOUDINARY_TV_FOLDER);
      onChange(url, 'video');
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
