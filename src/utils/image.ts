/**
 * Compresses an image file on the client side using Canvas.
 * Uses modern createImageBitmap if available, with a fallback to FileReader + Image.
 * Includes an 8s safety timeout to accommodate large DSLR files.
 */
export function compressImage(
  file: File,
  maxWidth = 2400,
  maxHeight = 2400,
  quality = 0.90
): Promise<Blob | File> {
  return new Promise((resolve) => {
    // Safety timeout: 20s for large DSLR images under heavy load
    const timeoutId = setTimeout(() => {
      console.warn('[Image Compression] Timed out, falling back to original file.');
      resolve(file);
    }, 20000);

    const runCompression = async () => {
      try {
        if (!file.type.startsWith('image/')) {
          clearTimeout(timeoutId);
          resolve(file);
          return;
        }

        // Skip compression for small images to save CPU cycles
        if (file.size < 500 * 1024) {
          clearTimeout(timeoutId);
          resolve(file);
          return;
        }

        let img: ImageBitmap | HTMLImageElement;
        let width = 0;
        let height = 0;

        if (typeof window.createImageBitmap === 'function') {
          try {
            const headerBitmap = await window.createImageBitmap(file);
            let targetW = headerBitmap.width;
            let targetH = headerBitmap.height;
            headerBitmap.close();

            if (targetW > targetH) {
              if (targetW > maxWidth) {
                targetH = Math.round((targetH * maxWidth) / targetW);
                targetW = maxWidth;
              }
            } else {
              if (targetH > maxHeight) {
                targetW = Math.round((targetW * maxHeight) / targetH);
                targetH = maxHeight;
              }
            }

            img = await window.createImageBitmap(file, {
              resizeWidth: targetW,
              resizeHeight: targetH,
              resizeQuality: 'high'
            });
            width = img.width;
            height = img.height;
          } catch {
            img = await window.createImageBitmap(file);
            width = img.width;
            height = img.height;
          }
        } else {
          // Fallback using FileReader + Image
          img = await new Promise<HTMLImageElement>((res, rej) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
              const tempImg = new Image();
              tempImg.src = e.target?.result as string;
              tempImg.onload = () => res(tempImg);
              tempImg.onerror = rej;
            };
            reader.onerror = rej;
          });
          width = (img as HTMLImageElement).width;
          height = (img as HTMLImageElement).height;
        }

        // Apply aspect ratio scale limits
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          clearTimeout(timeoutId);
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Clean up ImageBitmap memory
        if (img instanceof ImageBitmap) {
          img.close();
        }

        canvas.toBlob(
          (blob) => {
            clearTimeout(timeoutId);
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn('[Image Compression] failed, using original:', err);
        resolve(file);
      }
    };

    runCompression();
  });
}

/**
 * Generates a compact thumbnail of an image at a given max width.
 * Returns a JPEG Blob at 75% quality — suitable for fast gallery grid display.
 * Falls back to the original file if anything fails.
 */
export function generateThumbnail(
  file: File,
  maxWidth = 400
): Promise<Blob | File> {
  return new Promise((resolve) => {
    // Safety timeout: 20s for large files
    const timeoutId = setTimeout(() => {
      console.warn('[Thumbnail] Timed out, using original.');
      resolve(file);
    }, 20000);

    const run = async () => {
      try {
        if (!file.type.startsWith('image/')) {
          clearTimeout(timeoutId);
          resolve(file);
          return;
        }

        let img: ImageBitmap | HTMLImageElement;
        let origW = 0;
        let origH = 0;

        if (typeof window.createImageBitmap === 'function') {
          img = await window.createImageBitmap(file);
          origW = img.width;
          origH = img.height;
        } else {
          img = await new Promise<HTMLImageElement>((res, rej) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
              const i = new Image();
              i.src = e.target?.result as string;
              i.onload = () => res(i);
              i.onerror = rej;
            };
            reader.onerror = rej;
          });
          origW = (img as HTMLImageElement).width;
          origH = (img as HTMLImageElement).height;
        }

        let thumbW = origW;
        let thumbH = origH;
        if (thumbW > maxWidth) {
          thumbH = Math.round((thumbH * maxWidth) / thumbW);
          thumbW = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = thumbW;
        canvas.height = thumbH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          clearTimeout(timeoutId);
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, thumbW, thumbH);

        if (img instanceof ImageBitmap) img.close();

        canvas.toBlob(
          (blob) => {
            clearTimeout(timeoutId);
            resolve(blob ?? file);
          },
          'image/jpeg',
          0.75
        );
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn('[Thumbnail] Generation failed:', err);
        resolve(file);
      }
    };

    run();
  });
}

/**
 * Gets the dimensions of an image file in pixels.
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve({ width: 0, height: 0 });
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(objectUrl);
    };
  });
}

/**
 * Gets the duration of a video file in seconds.
 */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('video/')) {
      resolve(0);
      return;
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.onloadedmetadata = () => {
      resolve(video.duration);
      URL.revokeObjectURL(objectUrl);
    };
    video.onerror = () => {
      resolve(0);
      URL.revokeObjectURL(objectUrl);
    };
  });
}

/**
 * Generates a thumbnail frame from a video file as a jpeg data URL.
 */
export function generateVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('video/')) {
      resolve('');
      return;
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;
    video.onloadeddata = () => {
      // Seek to 1 second or half the duration (whichever is smaller)
      video.currentTime = Math.min(1, video.duration / 2);
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataURL = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataURL);
        } else {
          resolve('');
        }
        URL.revokeObjectURL(objectUrl);
      } catch {
        resolve('');
        URL.revokeObjectURL(objectUrl);
      }
    };
    video.onerror = () => {
      resolve('');
      URL.revokeObjectURL(objectUrl);
    };
  });
}

/**
 * Converts a data URL string to a Blob object.
 */
export function dataURLToBlob(dataURL: string): Blob {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Generates a 1200px preview image Blob (88% quality) for fast client viewing.
 */
export function generatePreviewImage(file: File, maxWidth = 1200): Promise<Blob | File> {
  return compressImage(file, maxWidth, maxWidth, 0.88);
}

/**
 * Generates a micro 20px blur placeholder data URL for progressive image loading.
 */
export function generateBlurPlaceholder(file: File): Promise<string> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 20;
        canvas.height = Math.max(1, Math.round((20 * img.height) / img.width));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.4));
        } else {
          resolve('');
        }
      };
      img.onerror = () => resolve('');
    };
    reader.onerror = () => resolve('');
  });
}

/**
 * Automatically optimizes an image file before upload:
 * 1. Resizes so the longest side is a maximum of 4000 pixels (maintaining aspect ratio).
 * 2. Compresses JPEG to 85–90% quality.
 * 3. If file size > 9 MB, gradually reduces quality until size is under 9 MB.
 */
export async function optimizeImageForUpload(
  file: File,
  maxDimension = 4000,
  maxSizeBytes = 9 * 1024 * 1024,
  onProgress?: (status: string) => void
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  if (onProgress) onProgress('Compressing & Optimizing image...');

  const { width, height } = await getImageDimensions(file);
  const longestSide = Math.max(width, height);

  // If file is already small (< 500KB) and within maxDimension, return original
  if (file.size < 500 * 1024 && (longestSide <= maxDimension || longestSide === 0)) {
    return file;
  }

  let quality = 0.88;
  let compressedBlob = await compressImage(file, maxDimension, maxDimension, quality);

  // Step 2: If still > 9 MB, gradually reduce quality
  while (compressedBlob.size > maxSizeBytes && quality > 0.40) {
    quality -= 0.08;
    console.info(`[Image Optimization] File size (${(compressedBlob.size / 1024 / 1024).toFixed(2)}MB) > 9MB, re-compressing at quality ${(quality * 100).toFixed(0)}%...`);
    compressedBlob = await compressImage(file, maxDimension, maxDimension, quality);
  }

  const optimizedFile = new File([compressedBlob], file.name, {
    type: 'image/jpeg',
    lastModified: file.lastModified || Date.now()
  });

  console.info(`[Image Optimization Complete] "${file.name}": ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(optimizedFile.size / 1024 / 1024).toFixed(2)}MB`);
  return optimizedFile;
}


