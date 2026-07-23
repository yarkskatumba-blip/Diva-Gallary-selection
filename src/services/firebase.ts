import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInAnonymously,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  projectId: "diva-selection",
  appId: "1:387793085294:web:24c4fb654e8152adcc177f",
  storageBucket: "diva-selection.appspot.com",
  apiKey: "AIzaSyA-fFDGUwHAL0GB5DzSd9Qf6psrHiFO6ds",
  authDomain: "diva-selection.firebaseapp.com",
  messagingSenderId: "387793085294",
  measurementId: "G-DJLH9BRS28"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);

// Authenticate session anonymously if no user is signed in
auth.onAuthStateChanged((user) => {
  if (!user) {
    signInAnonymously(auth).catch((err) => {
      console.warn('[Firebase Auth] Anonymous sign-in fallback: ', err.message || err);
    });
  }
});

// Force Google to present the official Gmail sign-in / account selection panel
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const AUTHORIZED_EMAILS = [
  'divashotsstudios@gmail.com',
  'admin@divashotsstudios.com'
];

/**
 * Validates whether an email address is permitted to access the studio.
 */
export function validateAuthorizedEmail(email: string): string {
  const clean = (email || '').trim().toLowerCase();
  const allowed = AUTHORIZED_EMAILS.map((e) => e.toLowerCase());
  if (!allowed.includes(clean)) {
    throw new Error('You are not authorized to access the Admin Portal.');
  }
  return clean;
}

/**
 * Trigger real Google Auth via Firebase Authentication.
 * Uses popup by default, falling back to full-page redirect if popups are blocked.
 */
export async function signInWithGoogle(): Promise<string> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return validateAuthorizedEmail(result.user.email || '');
  } catch (err: any) {
    if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/popup-closed-by-user') {
      // If popup is blocked by browser or mobile policy, trigger full redirect to official Google page
      await signInWithRedirect(auth, googleProvider);
      return '';
    }
    throw err;
  }
}

/**
 * Check for pending redirect result (for mobile browsers or redirect auth flow).
 */
export async function checkGoogleRedirectResult(): Promise<string | null> {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user && result.user.email) {
      return validateAuthorizedEmail(result.user.email);
    }
  } catch (err) {
    console.error('Redirect result error:', err);
    throw err;
  }
  return null;
}

/**
 * Trigger manual Email/Password Auth via Firebase Authentication.
 */
export async function signInManual(email: string, password: string): Promise<string> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return validateAuthorizedEmail(result.user.email || '');
}

/**
 * Retries an async function up to `maxAttempts` times with exponential backoff.
 * Delays: 1s, 2s, 4s between attempts.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 5
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

export async function uploadPhotoToStorage(galleryId: string, photoId: string, file: File): Promise<string> {
  try {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const fileRef = ref(storage, `galleries/${galleryId}/uploads/${photoId}_${cleanFileName}`);
    const metadata = {
      contentType: file.type || 'image/jpeg',
      cacheControl: 'public, max-age=31536000'
    };
    const result = await uploadBytes(fileRef, file, metadata);
    return await getDownloadURL(result.ref);
  } catch (err: any) {
    const code = err?.code || 'storage/unknown';
    const msg = err?.message || String(err);
    console.error(`[Firebase Storage Error - ${code}]:`, msg, err);
    throw new Error(`Storage upload failed (${code}): ${msg}`);
  }
}

/**
 * Uploads a thumbnail blob to `galleries/{galleryId}/uploads/thumbnails/{photoId}_thumb.jpg`.
 * Returns the public download URL.
 */
export async function uploadThumbnailToStorage(
  galleryId: string,
  photoId: string,
  blob: Blob | File
): Promise<string> {
  try {
    const thumbFile = blob instanceof File ? blob : new File([blob], `${photoId}_thumb.jpg`, { type: 'image/jpeg' });
    const thumbRef = ref(storage, `galleries/${galleryId}/uploads/thumbnails/${photoId}_thumb.jpg`);
    const metadata = {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000'
    };
    const result = await uploadBytes(thumbRef, thumbFile, metadata);
    return await getDownloadURL(result.ref);
  } catch (err: any) {
    const code = err?.code || 'storage/unknown';
    const msg = err?.message || String(err);
    console.warn(`[Firebase Storage Thumbnail Error - ${code}]:`, msg);
    throw new Error(`Thumbnail upload failed (${code}): ${msg}`);
  }
}

/**
 * Uploads a preview blob (1200px) to `galleries/{galleryId}/uploads/previews/{photoId}_preview.jpg`.
 * Returns the public download URL.
 */
export async function uploadPreviewToStorage(
  galleryId: string,
  photoId: string,
  blob: Blob | File
): Promise<string> {
  try {
    const previewFile = blob instanceof File ? blob : new File([blob], `${photoId}_preview.jpg`, { type: 'image/jpeg' });
    const previewRef = ref(storage, `galleries/${galleryId}/uploads/previews/${photoId}_preview.jpg`);
    const metadata = {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000'
    };
    const result = await uploadBytes(previewRef, previewFile, metadata);
    return await getDownloadURL(result.ref);
  } catch (err: any) {
    const code = err?.code || 'storage/unknown';
    const msg = err?.message || String(err);
    console.warn(`[Firebase Storage Preview Error - ${code}]:`, msg);
    throw new Error(`Preview upload failed (${code}): ${msg}`);
  }
}

/**
 * Upload a photo File with progress updates via uploadBytesResumable.
 */
export function uploadPhotoWithProgress(
  galleryId: string,
  photoId: string,
  file: File,
  onProgress: (progress: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const fileRef = ref(storage, `galleries/${galleryId}/uploads/${photoId}_${cleanFileName}`);
    const uploadTask = uploadBytesResumable(fileRef, file, {
      contentType: file.type || 'image/jpeg',
      cacheControl: 'public, max-age=31536000'
    });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const total = snapshot.totalBytes;
        const progress = total > 0 ? (snapshot.bytesTransferred / total) * 100 : 0;
        onProgress(Math.round(progress) || 0);
      },
      (error) => {
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

