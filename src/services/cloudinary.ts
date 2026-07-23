/**
 * Cloudinary Storage & Upload Service
 * Cloud Name: dg0kseu3
 * Upload Preset: Gallery_Uploads (Unsigned)
 */

export const CLOUDINARY_CLOUD_NAME = 'dg0kseu3';
export const CLOUDINARY_UPLOAD_PRESET = 'Gallery_Uploads';
export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// Allowed image formats
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]);

export interface CloudinaryUploadResponse {
  public_id: string;
  secure_url: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
  created_at: string;
}

export interface CloudinaryProgressInfo {
  percent: number;
  loaded: number;
  total: number;
  speedBytesPerSec: number;
  timeRemainingSec: number;
  status: 'compressing' | 'uploading' | 'processing' | 'completed' | 'failed';
}

/**
 * Validates file type before starting upload.
 * Throws an explicit error if unsupported.
 */
export function validateImageFile(file: File): void {
  const mime = file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const validExts = ['jpg', 'jpeg', 'png', 'webp'];

  if (!ALLOWED_MIME_TYPES.has(mime) && !validExts.includes(ext)) {
    throw new Error(`Unsupported file type "${file.name}". Only JPG, JPEG, PNG, and WEBP images are supported.`);
  }
}

/**
 * Generates secure HTTPS Cloudinary URLs with dynamic optimizations (f_auto, q_auto).
 */
export function getCloudinaryOriginalUrl(publicId: string): string {
  if (!publicId) return '';
  if (publicId.startsWith('http')) return publicId;
  const cleanId = publicId.replace(/^\//, '');
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto/${cleanId}`;
}

export function getCloudinaryThumbnailUrl(publicId: string, width = 300): string {
  if (!publicId) return '';
  if (publicId.startsWith('http')) return publicId;
  const cleanId = publicId.replace(/^\//, '');
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/c_scale,w_${width},f_auto,q_auto/${cleanId}`;
}

export function getCloudinaryPreviewUrl(publicId: string, width = 1200): string {
  if (!publicId) return '';
  if (publicId.startsWith('http')) return publicId;
  const cleanId = publicId.replace(/^\//, '');
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/c_scale,w_${width},f_auto,q_auto/${cleanId}`;
}

/**
 * Uploads an image file directly to Cloudinary using unsigned upload preset `Gallery_Uploads`.
 * Includes real-time progress callbacks (percent, upload speed MB/s, remaining time sec).
 */
export function uploadToCloudinaryWithProgress(
  galleryId: string,
  photoId: string,
  file: File,
  onProgress?: (info: CloudinaryProgressInfo) => void
): Promise<CloudinaryUploadResponse> {
  return new Promise((resolve, reject) => {
    try {
      validateImageFile(file);
    } catch (valErr) {
      reject(valErr);
      return;
    }

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', `galleries/${galleryId}/uploads`);
    formData.append('public_id', `${photoId}_${cleanFileName}`);

    console.info(`[Cloudinary Upload Request] Cloud Name: "${CLOUDINARY_CLOUD_NAME}" | Preset: "${CLOUDINARY_UPLOAD_PRESET}" | Endpoint: "${CLOUDINARY_UPLOAD_URL}"`);

    const xhr = new XMLHttpRequest();
    const startTime = Date.now();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
        const elapsedTimeSec = (Date.now() - startTime) / 1000;
        const speedBytesPerSec = elapsedTimeSec > 0 ? e.loaded / elapsedTimeSec : 0;
        const remainingBytes = e.total - e.loaded;
        const timeRemainingSec = speedBytesPerSec > 0 ? Math.ceil(remainingBytes / speedBytesPerSec) : 0;

        onProgress({
          percent,
          loaded: e.loaded,
          total: e.total,
          speedBytesPerSec,
          timeRemainingSec,
          status: percent >= 99 ? 'processing' : 'uploading'
        });
      }
    });

    xhr.addEventListener('load', () => {
      console.info(`[Cloudinary Response ${xhr.status}]`, xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res: CloudinaryUploadResponse = JSON.parse(xhr.responseText);
          if (onProgress) {
            onProgress({
              percent: 100,
              loaded: file.size,
              total: file.size,
              speedBytesPerSec: 0,
              timeRemainingSec: 0,
              status: 'completed'
            });
          }
          resolve(res);
        } catch (parseErr) {
          reject(new Error(`Failed to parse Cloudinary response: ${xhr.responseText}`));
        }
      } else {
        let errorMsg = `Cloudinary Upload Error (${xhr.status})`;
        try {
          const json = JSON.parse(xhr.responseText);
          if (json.error?.message) {
            errorMsg = `Cloudinary (${xhr.status}): ${json.error.message}`;
          }
        } catch {}
        reject(new Error(errorMsg));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error occurred during Cloudinary upload. Check internet connection.'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Cloudinary upload was aborted.'));
    });

    xhr.open('POST', CLOUDINARY_UPLOAD_URL, true);
    xhr.send(formData);
  });
}

import { uploadPhotoWithProgress, uploadThumbnailToStorage, uploadPreviewToStorage } from './firebase';
import { optimizeImageForUpload } from '../utils/image';

export async function uploadToCloudinaryWithRetry(
  galleryId: string,
  _photoId: string,
  file: File,
  onProgress?: (info: CloudinaryProgressInfo) => void,
  maxRetries = 2
): Promise<CloudinaryUploadResponse> {
  const presetCandidates = [CLOUDINARY_UPLOAD_PRESET, 'gallery_uploads', 'diva_uploads', 'ml_default', 'unsigned'];
  let lastError: any;

  for (const preset of presetCandidates) {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await new Promise<CloudinaryUploadResponse>((resolve, reject) => {
          try {
            validateImageFile(file);
          } catch (valErr) {
            reject(valErr);
            return;
          }

          const formData = new FormData();
          formData.append('file', file);
          formData.append('upload_preset', preset);
          formData.append('folder', `galleries/${galleryId}/uploads`);

          const xhr = new XMLHttpRequest();
          const startTime = Date.now();

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
              const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
              const elapsedTimeSec = (Date.now() - startTime) / 1000;
              const speedBytesPerSec = elapsedTimeSec > 0 ? e.loaded / elapsedTimeSec : 0;
              const remainingBytes = e.total - e.loaded;
              const timeRemainingSec = speedBytesPerSec > 0 ? Math.ceil(remainingBytes / speedBytesPerSec) : 0;

              onProgress({
                percent,
                loaded: e.loaded,
                total: e.total,
                speedBytesPerSec,
                timeRemainingSec,
                status: percent >= 99 ? 'processing' : 'uploading'
              });
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const res: CloudinaryUploadResponse = JSON.parse(xhr.responseText);
                if (onProgress) {
                  onProgress({
                    percent: 100,
                    loaded: file.size,
                    total: file.size,
                    speedBytesPerSec: 0,
                    timeRemainingSec: 0,
                    status: 'completed'
                  });
                }
                resolve(res);
              } catch (parseErr) {
                reject(new Error(`Failed to parse Cloudinary response: ${xhr.responseText}`));
              }
            } else {
              let errorMsg = `Cloudinary Upload Error (${xhr.status})`;
              try {
                const json = JSON.parse(xhr.responseText);
                if (json.error?.message) {
                  errorMsg = `Cloudinary (${xhr.status}): ${json.error.message}`;
                }
              } catch {}
              reject(new Error(errorMsg));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('Network error occurred during Cloudinary upload.'));
          });

          xhr.open('POST', CLOUDINARY_UPLOAD_URL, true);
          xhr.send(formData);
        });
      } catch (err: any) {
        attempt++;
        lastError = err;
        if (err?.message?.includes('Upload preset') || err?.message?.includes('whitelisted')) {
          break;
        }
      }
    }
  }

  throw lastError || new Error(`Cloudinary upload failed for ${file.name}.`);
}

/**
 * Universal Smart Upload Engine:
 * 1. Automatically optimizes image on client (max 4000px, 85-90% quality, < 9MB).
 * 2. Tries Cloudinary unsigned upload.
 * 3. If Cloudinary preset is inactive, seamlessly falls back to Firebase Storage without failing.
 */
export async function uploadPhotoSmart(
  galleryId: string,
  photoId: string,
  file: File,
  onProgress?: (info: CloudinaryProgressInfo) => void
): Promise<{ url: string; thumbnailUrl: string; previewUrl: string; publicId?: string; width?: number; height?: number; bytes?: number }> {
  let uploadFile = file;

  // Skip slow client-side canvas compression — upload directly to Cloudinary.
  // Cloudinary applies f_auto,q_auto server-side, which is faster and higher quality.
  // Only enforce the 9MB hard limit (Cloudinary unsigned preset limit).
  if (file.size > 9 * 1024 * 1024 && file.type.startsWith('image/')) {
    if (onProgress) {
      onProgress({ percent: 5, loaded: 0, total: file.size, speedBytesPerSec: 0, timeRemainingSec: 0, status: 'compressing' });
    }
    try {
      uploadFile = await optimizeImageForUpload(file, 4000, 9 * 1024 * 1024, () => {});
    } catch {
      uploadFile = file;
    }
  }

  try {
    const cRes = await uploadToCloudinaryWithRetry(galleryId, photoId, uploadFile, onProgress, 1);
    const publicId = cRes.public_id;
    return {
      url: cRes.secure_url,
      thumbnailUrl: getCloudinaryThumbnailUrl(publicId, 300),
      previewUrl: getCloudinaryPreviewUrl(publicId, 1200),
      publicId: publicId,
      width: cRes.width,
      height: cRes.height,
      bytes: cRes.bytes
    };
  } catch (cErr: any) {
    console.warn('[Cloudinary Warning] Cloudinary preset inactive, using Cloud Storage engine:', cErr?.message || cErr);

    const publicUrl = await uploadPhotoWithProgress(galleryId, photoId, uploadFile, (pct) => {
      if (onProgress) {
        onProgress({
          percent: pct,
          loaded: Math.round((pct / 100) * uploadFile.size),
          total: uploadFile.size,
          speedBytesPerSec: 0,
          timeRemainingSec: 0,
          status: pct >= 99 ? 'processing' : 'uploading'
        });
      }
    });

    let thumbUrl = publicUrl;
    try {
      thumbUrl = await uploadThumbnailToStorage(galleryId, photoId, uploadFile);
    } catch {}

    let prevUrl = publicUrl;
    try {
      prevUrl = await uploadPreviewToStorage(galleryId, photoId, uploadFile);
    } catch {}

    if (onProgress) {
      onProgress({
        percent: 100,
        loaded: uploadFile.size,
        total: uploadFile.size,
        speedBytesPerSec: 0,
        timeRemainingSec: 0,
        status: 'completed'
      });
    }

    return {
      url: publicUrl,
      thumbnailUrl: thumbUrl || publicUrl,
      previewUrl: prevUrl || publicUrl,
      bytes: uploadFile.size
    };
  }
}
