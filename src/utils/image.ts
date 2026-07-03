/**
 * Compresses an image file on the client side using Canvas.
 * Uses modern createImageBitmap if available, with a fallback to FileReader + Image.
 * Includes a 600ms safety timeout to guarantee the promise always resolves.
 */
export function compressImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.8
): Promise<Blob | File> {
  return new Promise((resolve) => {
    // Safety timeout: if compression takes too long, return original file immediately
    const timeoutId = setTimeout(() => {
      console.warn('[Image Compression] Timed out, falling back to original file.');
      resolve(file);
    }, 600);

    const runCompression = async () => {
      try {
        if (!file.type.startsWith('image/')) {
          clearTimeout(timeoutId);
          resolve(file);
          return;
        }

        let img: ImageBitmap | HTMLImageElement;
        let width = 0;
        let height = 0;

        if (typeof window.createImageBitmap === 'function') {
          img = await window.createImageBitmap(file);
          width = img.width;
          height = img.height;
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

