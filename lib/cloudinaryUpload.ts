/**
 * Browser upload helpers for Bond's Cloudinary cloud (`rcenter`).
 * Uses the same unsigned image upload preset as adminv2.
 */

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;

export const MAX_SCHEDULE_LOGO_BYTES = 500 * BYTES_PER_KB;
export const MAX_TV_IMAGE_BYTES = Math.round(1.5 * BYTES_PER_MB);
export const MAX_TV_VIDEO_BYTES = 15 * BYTES_PER_MB;

const DEFAULT_CLOUDINARY_IMAGE_UPLOAD_URL =
  'https://api.cloudinary.com/v1_1/rcenter/image/upload?upload_preset=tm4almj6';

export function getCloudinaryImageUploadUrl(): string {
  return process.env.NEXT_PUBLIC_CLOUDINARY_IMAGE_UPLOAD_URL || DEFAULT_CLOUDINARY_IMAGE_UPLOAD_URL;
}

interface ICloudinaryUploadResponse {
  secure_url?: string;
  url?: string;
  error?: { message?: string };
}

/**
 * Uploads an image to Bond Cloudinary via the unsigned `tm4almj6` preset.
 */
export async function uploadImageToCloudinary(file: File, folder: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const response = await fetch(getCloudinaryImageUploadUrl(), {
    method: 'POST',
    body: formData,
  });
  const payload = (await response.json()) as ICloudinaryUploadResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Cloudinary upload failed');
  }
  const url = payload.secure_url || payload.url;
  if (!url) throw new Error('Cloudinary upload returned no URL');
  return url;
}

export function formatBytesLimit(maxBytes: number): string {
  if (maxBytes >= BYTES_PER_MB) {
    const mb = maxBytes / BYTES_PER_MB;
    return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
  }
  return `${Math.round(maxBytes / BYTES_PER_KB)} KB`;
}
