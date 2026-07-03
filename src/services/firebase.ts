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

// Authenticate session anonymously to satisfy standard Firebase rules
signInAnonymously(auth).catch((err) => {
  console.warn('[Firebase Auth] Anonymous sign-in fallback: ', err.message || err);
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
  const userEmail = email.toLowerCase();
  const isAuthorized = AUTHORIZED_EMAILS.some(e => e.toLowerCase() === userEmail);
  if (!isAuthorized) {
    throw new Error(`Access Denied: Account "${userEmail}" is not authorized. Please sign in with divashotsstudios@gmail.com.`);
  }
  return userEmail;
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

export async function uploadPhotoToStorage(galleryId: string, photoId: string, file: File): Promise<string> {
  // Use a clean path under galleries/{galleryId}/{photoId}_{filename}
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
  const fileRef = ref(storage, `galleries/${galleryId}/${photoId}_${cleanFileName}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
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
    const fileRef = ref(storage, `galleries/${galleryId}/${photoId}_${cleanFileName}`);
    const uploadTask = uploadBytesResumable(fileRef, file);

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

