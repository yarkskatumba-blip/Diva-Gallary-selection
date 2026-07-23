import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Admin, Client, Package, Gallery, Notification, StudioSettings, GalleryStatus, Photo, UploadItem } from '../types';
import {
  sendStudioNotification,
  buildGalleryCreatedEmail,
  buildSelectionSubmittedEmail
} from '../services/emailService';
import { db, withRetry, storage } from '../services/firebase';
import { uploadPhotoSmart } from '../services/cloudinary';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
  compressImage,
  getImageDimensions,
  getVideoDuration,
  generateVideoThumbnail,
  dataURLToBlob
} from '../utils/image';

// Module-level maps for tracking non-serializable upload objects
const fileObjectsMap = new Map<string, File>();
const runningTasks = new Map<string, any>();

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'https://diva-selection.web.app';
    }
    return window.location.origin;
  }
  return 'https://diva-selection.web.app';
};

export interface FileUploadStatus {
  id: string;
  name: string;
  progress: number;
  status: 'compressing' | 'uploading' | 'processing' | 'completed' | 'failed';
}

interface AppState {
  // Authentication
  admin: Admin;
  loginAdmin: (email: string) => void;
  logoutAdmin: () => void;

  // Clients
  clients: Client[];
  addClient: (client: Client) => void;
  updateClient: (client: Client) => void;
  deleteClient: (id: string) => void;

  // Packages
  packages: Package[];
  addPackage: (pkg: Package) => void;
  updatePackage: (pkg: Package) => void;
  deletePackage: (id: string) => void;

  // Galleries
  galleries: Gallery[];
  addGallery: (gallery: Gallery) => void;
  updateGallery: (gallery: Gallery) => void;
  deleteGallery: (id: string) => void;
  updateGalleryStatus: (id: string, status: GalleryStatus) => void;
  togglePhotoSelection: (galleryId: string, photoId: string) => void;
  submitGallerySelection: (galleryId: string) => void;
  reopenGallery: (galleryId: string) => void;
  closeGallery: (galleryId: string) => void;

  // Notifications
  notifications: Notification[];
  addNotification: (message: string, type: 'info' | 'success' | 'warning') => void;
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;

  // Settings
  settings: StudioSettings;
  updateSettings: (settings: StudioSettings) => void;

  // Cloud Sync properties
  syncing: boolean;
  syncError: string | null;
  galleriesFetchedAt: number; // epoch ms — used for 60s cache
  setSyncing: (val: boolean) => void;
  setSyncError: (val: string | null) => void;

  // Parallel Uploads Queue State
  uploadQueue: UploadItem[];
  activeUploads: Record<string, FileUploadStatus>;

  // Upload actions
  addFilesToUploadQueue: (galleryId: string, files: FileList | File[]) => Promise<void>;
  processUploadQueue: () => void;
  startItemUpload: (itemId: string) => Promise<void>;
  pauseUpload: (itemId: string) => void;
  resumeUpload: (itemId: string) => void;
  cancelUpload: (itemId: string) => void;
  retryUpload: (itemId: string) => void;
  removeCompletedUploads: () => void;
  clearActiveUploads: () => void;
  cleanupInterruptedUploads: () => void;

  // Background uploads tracking (retained for backward compatibility)
  startBackgroundUpload: (galleryId: string, photo: Photo, file: File) => Promise<string>;
  saveGalleryMetadata: (gallery: Gallery) => Promise<void>;
  updateGalleryMetadata: (galleryId: string, fields: Partial<Gallery>) => Promise<void>;
  uploadAndAddGallery: (gallery: Gallery, filesMap: Map<string, File>) => Promise<void>;
  fetchGalleryById: (id: string) => Promise<Gallery | null>;
  syncGallerySelection: (galleryId: string, updatedPhotos: Photo[]) => Promise<void>;
  fetchAllGalleriesFromFirestore: () => Promise<void>;
  fetchSettingsFromFirestore: () => Promise<StudioSettings | null>;
  updateSettingsInFirestore: (settings: StudioSettings) => Promise<void>;
  updateGalleryStatusInFirestore: (galleryId: string, status: GalleryStatus) => Promise<void>;
  deleteGalleryFromFirestore: (galleryId: string) => Promise<void>;
}

// Authorised studio credentials
export const STUDIO_CREDENTIALS = [
  { email: 'divashotsstudios@gmail.com', password: null },       // Gmail (no password required)
  { email: 'admin@divashotsstudios.com', password: 'Code3212' }  // Manual login
];

const initialSettings: StudioSettings = {
  studioName: 'Diva Shots Studio',
  slogan: 'Life On Art',
  currency: 'UGX',
  defaultExtraPrice: 10000,
  emailjsServiceId: '',
  emailjsTemplateId: '',
  emailjsPublicKey: ''
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Authentication
      admin: { email: 'admin@divashotsstudios.com', isAuthenticated: true },
      loginAdmin: (email) => set({ admin: { email, isAuthenticated: true } }),
      logoutAdmin: () => set({ admin: { email: '', isAuthenticated: false } }),

      // Clients
      clients: [],
      addClient: (client) => set((state) => ({ clients: [client, ...state.clients] })),
      updateClient: (updatedClient) =>
        set((state) => ({
          clients: state.clients.map((c) => (c.id === updatedClient.id ? updatedClient : c)),
          // Cascading update to galleries containing this client
          galleries: state.galleries.map((g) =>
            g.client.id === updatedClient.id ? { ...g, client: updatedClient } : g
          )
        })),
      deleteClient: (id) =>
        set((state) => ({
          clients: state.clients.filter((c) => c.id !== id),
          // Clean up galleries belonging to the deleted client
          galleries: state.galleries.filter((g) => g.client.id !== id)
        })),

      // Packages
      packages: [],
      addPackage: (pkg) => set((state) => ({ packages: [pkg, ...state.packages] })),
      updatePackage: (updatedPkg) =>
        set((state) => ({
          packages: state.packages.map((p) => (p.id === updatedPkg.id ? updatedPkg : p))
        })),
      deletePackage: (id) =>
        set((state) => ({
          packages: state.packages.filter((p) => p.id !== id)
        })),

      // Galleries
      galleries: [],
      addGallery: (gallery) => set((state) => {
        // Fire email notification (async, non-blocking)
        const galleryUrl = `${getBaseUrl()}/gallery/${gallery.id}`;
        const emailContent = buildGalleryCreatedEmail(
          gallery.client.name,
          gallery.collectionTitle || 'Untitled',
          galleryUrl
        );
        const cfg = state.settings;
        sendStudioNotification({
          ...emailContent,
          serviceId: cfg.emailjsServiceId || '',
          templateId: cfg.emailjsTemplateId || '',
          publicKey: cfg.emailjsPublicKey || ''
        });

        // Add in-app notification
        const notif: Notification = {
          id: `notif-${Date.now()}`,
          message: `New gallery created for ${gallery.client.name}${gallery.collectionTitle ? ` — "${gallery.collectionTitle}"` : ''}.`,
          type: 'info',
          createdAt: new Date().toISOString(),
          read: false
        };

        return {
          galleries: [gallery, ...state.galleries],
          notifications: [notif, ...state.notifications]
        };
      }),
      updateGallery: (updatedGallery) =>
        set((state) => ({
          galleries: state.galleries.map((g) => (g.id === updatedGallery.id ? updatedGallery : g))
        })),
      deleteGallery: (id) =>
        set((state) => ({
          galleries: state.galleries.filter((g) => g.id !== id)
        })),
      updateGalleryStatus: (id, status) =>
        set((state) => ({
          galleries: state.galleries.map((g) => (g.id === id ? { ...g, status } : g))
        })),

      togglePhotoSelection: (galleryId, photoId) =>
        set((state) => {
          return {
            galleries: state.galleries.map((g) => {
              if (g.id !== galleryId) return g;

              const updatedPhotos = g.photos.map((p) =>
                p.id === photoId ? { ...p, selectedByClient: !p.selectedByClient } : p
              );

              const selectedCount = updatedPhotos.filter((p) => p.selectedByClient).length;
              const extraPhotosCount = Math.max(0, selectedCount - g.includedPhotos);
              const extraAmountDue = extraPhotosCount * g.extraPhotoPrice;

              return {
                ...g,
                photos: updatedPhotos,
                selectedCount,
                extraPhotosCount,
                extraAmountDue
              };
            })
          };
        }),

      submitGallerySelection: (galleryId) =>
        set((state) => {
          let updatedGallery: Gallery | null = null;
          
          const updatedGalleries = state.galleries.map((g) => {
            if (g.id !== galleryId) return g;
            
            updatedGallery = {
              ...g,
              status: 'Submitted',
              submittedAt: new Date().toISOString()
            };
            return updatedGallery;
          });

          const newNotifications = [...state.notifications];
          if (updatedGallery) {
            const g = updatedGallery as Gallery;
            const { client, selectedCount, extraPhotosCount, extraAmountDue, collectionTitle } = g;
            
            const msg = `${client.name} submitted their selection — ${selectedCount} photos${extraPhotosCount > 0 ? `, ${extraPhotosCount} extras (${state.settings.currency} ${extraAmountDue.toLocaleString()})` : ''}.`;
            newNotifications.unshift({
              id: `notif-${Date.now()}`,
              message: msg,
              type: extraPhotosCount > 0 ? 'warning' : 'success',
              createdAt: new Date().toISOString(),
              read: false
            });

            // Fire email (async, non-blocking)
            const emailContent = buildSelectionSubmittedEmail(
              client.name,
              collectionTitle || 'Untitled',
              selectedCount,
              extraPhotosCount,
              extraAmountDue,
              state.settings.currency
            );
            sendStudioNotification({
              ...emailContent,
              serviceId: state.settings.emailjsServiceId || '',
              templateId: state.settings.emailjsTemplateId || '',
              publicKey: state.settings.emailjsPublicKey || ''
            });
          }

          return {
            galleries: updatedGalleries,
            notifications: newNotifications
          };
        }),

      reopenGallery: (galleryId) =>
        set((state) => {
          let targetGallery: Gallery | null = null;
          const updatedGalleries = state.galleries.map((g) => {
            if (g.id !== galleryId) return g;
            targetGallery = { ...g, status: 'Reopened', submittedAt: null };
            return targetGallery;
          });

          const newNotifications = [...state.notifications];
          if (targetGallery) {
            newNotifications.unshift({
              id: `notif-${Date.now()}`,
              message: `${(targetGallery as Gallery).client.name}'s gallery was reopened.`,
              type: 'info',
              createdAt: new Date().toISOString(),
              read: false
            });
          }

          return {
            galleries: updatedGalleries,
            notifications: newNotifications
          };
        }),

      closeGallery: (galleryId) =>
        set((state) => ({
          galleries: state.galleries.map((g) =>
            g.id === galleryId ? { ...g, status: 'Closed' } : g
          )
        })),

      // Notifications
      notifications: [],
      addNotification: (message, type) =>
        set((state) => ({
          notifications: [
            {
              id: `notif-${Date.now()}`,
              message,
              type,
              createdAt: new Date().toISOString(),
              read: false
            },
            ...state.notifications
          ]
        })),
      markNotificationAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
        })),
      clearAllNotifications: () => set({ notifications: [] }),

      // Settings
      settings: initialSettings,
      updateSettings: (settings) => set({ settings }),

      // Cloud Sync state
      syncing: false,
      syncError: null,
      galleriesFetchedAt: 0,
      setSyncing: (val) => set({ syncing: val }),
      setSyncError: (val) => set({ syncError: val }),

      // Active uploads state
      uploadQueue: [],
      activeUploads: {},

      clearActiveUploads: () => set({ uploadQueue: [], activeUploads: {} }),

      cleanupInterruptedUploads: () => {
        set(state => {
          let modified = false;
          const nextQueue = state.uploadQueue.map(item => {
            if (item.status === 'uploading' || item.status === 'waiting' || item.status === 'processing') {
              modified = true;
              return {
                ...item,
                status: 'failed' as const,
                error: 'Upload interrupted by page reload'
              };
            }
            return item;
          });
          if (!modified) return {};
          return { uploadQueue: nextQueue };
        });
      },

      addFilesToUploadQueue: async (galleryId, files) => {
        const fileList = Array.from(files);
        const { addNotification, uploadQueue } = get();

        // ── Pre-create the gallery stub doc in Firestore (non-blocking) ─────────
        // Fire-and-forget: don't await this — files must enter the queue instantly.
        // Upload completion handlers will handle the case where the doc exists.
        const galleryDocRef = doc(db, 'galleries', galleryId);
        getDoc(galleryDocRef).then((gallerySnap) => {
          if (!gallerySnap.exists()) {
            return setDoc(galleryDocRef, {
              id: galleryId,
              client: { id: '', name: 'Pending', email: '', phone: '' },
              collectionTitle: '',
              coverPhotoUrl: '',
              includedPhotos: 20,
              extraPhotoPrice: 10000,
              welcomeMessage: '',
              photos: [],
              status: 'Draft',
              selectedCount: 0,
              submittedAt: null,
              extraPhotosCount: 0,
              extraAmountDue: 0
            });
          }
        }).catch((e) => {
          console.warn('[Gallery Stub] Could not pre-create gallery doc:', e);
        });
        // ─────────────────────────────────────────────────────────────────────

        for (const file of fileList) {
          // Check for duplicate uploads in the current queue
          const isDuplicate = uploadQueue.some(
            (item) => item.galleryId === galleryId && item.name === file.name && item.size === file.size
          );

          if (isDuplicate) {
            addNotification(`Skipped duplicate file: "${file.name}"`, 'warning');
            continue;
          }

          const itemId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Generate initial preview URL and extract details
          let localPreviewUrl = '';

          if (file.type.startsWith('image/')) {
            localPreviewUrl = URL.createObjectURL(file);
          } else {
            localPreviewUrl = '/logo.png';
          }

          const uploadItem: UploadItem = {
            id: itemId,
            galleryId,
            name: file.name,
            originalName: file.name,
            size: file.size,
            progress: 0,
            status: 'waiting',
            uploadedBytes: 0,
            speed: 0,
            timeRemaining: 0,
            error: null,
            mimeType: file.type || 'application/octet-stream',
            width: null,
            height: null,
            duration: null,
            thumbnailUrl: localPreviewUrl,
            retryCount: 0
          };

          // Store file handle in non-serializable map
          fileObjectsMap.set(itemId, file);

          set((state) => ({
            uploadQueue: [...state.uploadQueue, uploadItem],
            activeUploads: {
              ...state.activeUploads,
              [itemId]: {
                id: itemId,
                name: file.name,
                progress: 0,
                status: 'uploading'
              }
            }
          }));

          // Trigger asynchronous metadata extraction without blocking the main loop
          if (file.type.startsWith('image/')) {
            getImageDimensions(file).then((dims) => {
              set((state) => ({
                uploadQueue: state.uploadQueue.map((item) =>
                  item.id === itemId ? { ...item, width: dims.width, height: dims.height } : item
                )
              }));
            }).catch((e) => console.warn('Failed to extract image dimensions:', e));
          } else if (file.type.startsWith('video/')) {
            getVideoDuration(file).then((dur) => {
              set((state) => ({
                uploadQueue: state.uploadQueue.map((item) =>
                  item.id === itemId ? { ...item, duration: dur } : item
                )
              }));
            }).catch((e) => console.warn('Failed to extract video duration:', e));
          }
        }

        // Process queue
        get().processUploadQueue();
      },

      processUploadQueue: () => {
        const { uploadQueue } = get();
        const activeUploadCount = uploadQueue.filter(
          (item) => item.status === 'uploading' || item.status === 'processing'
        ).length;

        if (activeUploadCount >= 3) {
          return; // Concurrency limit of 3
        }

        const nextItem = uploadQueue.find((item) => item.status === 'waiting');
        if (!nextItem) return;

        // Mark next item as uploading
        set((state) => ({
          uploadQueue: state.uploadQueue.map((item) =>
            item.id === nextItem.id ? { ...item, status: 'uploading' as const, progress: 0 } : item
          )
        }));

        // Fire and forget upload trigger
        get().startItemUpload(nextItem.id);

        // Recursively trigger to fill concurrent slots
        get().processUploadQueue();
      },

      startItemUpload: async (itemId) => {
        const item = get().uploadQueue.find((i) => i.id === itemId);
        if (!item) return;

        const file = fileObjectsMap.get(itemId);
        if (!file) {
          set((state) => ({
            uploadQueue: state.uploadQueue.map((i) =>
              i.id === itemId
                ? { ...i, status: 'failed' as const, error: 'File data reference lost. Please retry.' }
                : i
            )
          }));
          get().processUploadQueue();
          return;
        }

        try {
          const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const fileRef = ref(storage, `galleries/${item.galleryId}/${itemId}_${cleanFileName}`);

          // If admin enabled compression, compress now (blocking but intentional — admin chose quality tradeoff)
          let uploadPayload: File | Blob = file;
          const { settings } = get();
          if (settings.compressBeforeUpload && file.type.startsWith('image/')) {
            try {
              const compressedBlob = await compressImage(file, 3000, 3000, 0.92);
              uploadPayload = new File([compressedBlob], file.name, { type: 'image/jpeg' });
            } catch (e) {
              console.warn('[Compression Failed, using original]:', e);
            }
          }

          const uploadTask = uploadBytesResumable(fileRef, uploadPayload);

          runningTasks.set(itemId, uploadTask);

          // Generate thumbnail in parallel (does NOT block the upload)
          let thumbnailBlob: Blob | null = null;
          const thumbnailPromise = (async () => {
            try {
              if (file.type.startsWith('image/')) {
                thumbnailBlob = await compressImage(file, 400, 400, 0.7);
              } else if (file.type.startsWith('video/')) {
                const videoThumbUrl = await generateVideoThumbnail(file);
                if (videoThumbUrl) thumbnailBlob = dataURLToBlob(videoThumbUrl);
              }
            } catch (e) {
              console.warn('[Thumbnail Generation Failed]:', e);
            }
          })();

          // Stall watchdog: if no bytes move within 30s, fail with clear message
          let lastWatchdogBytes = 0;
          let lastWatchdogTime = Date.now();
          const stallWatchdog = setInterval(() => {
            const currentItem = get().uploadQueue.find(i => i.id === itemId);
            if (!currentItem || currentItem.status !== 'uploading') {
              clearInterval(stallWatchdog);
              return;
            }
            const now = Date.now();
            const elapsed = now - lastWatchdogTime;
            if (elapsed > 30000 && currentItem.uploadedBytes === lastWatchdogBytes) {
              clearInterval(stallWatchdog);
              runningTasks.get(itemId)?.cancel();
              runningTasks.delete(itemId);
              set((state) => ({
                uploadQueue: state.uploadQueue.map((i) =>
                  i.id === itemId
                    ? { ...i, status: 'failed' as const, error: 'Upload stalled. Check Firebase Storage is enabled and you are signed in.' }
                    : i
                )
              }));
              get().processUploadQueue();
            }
            lastWatchdogBytes = currentItem.uploadedBytes;
            lastWatchdogTime = now;
          }, 10000); // check every 10s

          // Performance measurement variables
          let lastBytes = 0;
          let lastTime = Date.now();
          let smoothedSpeed = 0;

          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const total = snapshot.totalBytes;
              const progress = total > 0 ? (snapshot.bytesTransferred / total) * 100 : 0;
              const now = Date.now();
              const elapsed = now - lastTime;

              if (elapsed >= 500) {
                const bytesTransferredThisPeriod = snapshot.bytesTransferred - lastBytes;
                const speedBps = bytesTransferredThisPeriod / (elapsed / 1000);
                const alpha = 0.3;
                smoothedSpeed = smoothedSpeed === 0 ? speedBps : alpha * speedBps + (1 - alpha) * smoothedSpeed;

                lastBytes = snapshot.bytesTransferred;
                lastTime = now;
              }

              const remainingBytes = total - snapshot.bytesTransferred;
              const timeRemaining = smoothedSpeed > 0 ? Math.round(remainingBytes / smoothedSpeed) : 0;

              set((state) => {
                const nextQueue = state.uploadQueue.map((i) => {
                  if (i.id !== itemId) return i;
                  if (i.status === 'paused' || i.status === 'failed') return i;
                  return {
                    ...i,
                    progress: Math.round(progress) || 0,
                    uploadedBytes: snapshot.bytesTransferred,
                    speed: Math.round(smoothedSpeed) || 0,
                    timeRemaining: timeRemaining || 0,
                    status: 'uploading' as const
                  };
                });

                const nextActiveUploads = { ...state.activeUploads };
                const currentItem = nextQueue.find((i) => i.id === itemId);
                if (currentItem) {
                  nextActiveUploads[itemId] = {
                    id: itemId,
                    name: currentItem.name,
                    progress: currentItem.progress,
                    status: 'uploading'
                  };
                }

                return {
                  uploadQueue: nextQueue,
                  activeUploads: nextActiveUploads
                };
              });
            },
            async (error) => {
              clearInterval(stallWatchdog);
              runningTasks.delete(itemId);

              // Auto-retry policy: retry up to 3 times on typical network issues
              const currentItem = get().uploadQueue.find((i) => i.id === itemId);
              const retryLimit = 3;
              if (currentItem && currentItem.retryCount < retryLimit && error.code !== 'storage/canceled') {
                setTimeout(() => {
                  set((state) => ({
                    uploadQueue: state.uploadQueue.map((i) =>
                      i.id === itemId
                        ? {
                            ...i,
                            status: 'waiting' as const,
                            retryCount: i.retryCount + 1,
                            error: `Network drop. Retrying (${i.retryCount + 1}/${retryLimit})...`
                          }
                        : i
                    )
                  }));
                  get().processUploadQueue();
                }, 2000);
                return;
              }

              // Failed state
              set((state) => {
                const nextQueue = state.uploadQueue.map((i) =>
                  i.id === itemId ? { ...i, status: 'failed' as const, error: error.message || 'Upload failed' } : i
                );
                const nextActiveUploads = { ...state.activeUploads };
                const failedItem = nextQueue.find((i) => i.id === itemId);
                if (failedItem) {
                  nextActiveUploads[itemId] = {
                    id: itemId,
                    name: failedItem.name,
                    progress: failedItem.progress,
                    status: 'failed'
                  };
                }
                return {
                  uploadQueue: nextQueue,
                  activeUploads: nextActiveUploads
                };
              });

              get().processUploadQueue();
            },
            async () => {
              clearInterval(stallWatchdog);
              runningTasks.delete(itemId);
              set((state) => ({
                uploadQueue: state.uploadQueue.map((i) =>
                  i.id === itemId ? { ...i, status: 'processing' as const, progress: 100 } : i
                )
              }));

              try {
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                const storagePath = uploadTask.snapshot.ref.fullPath;

                // Wait for thumbnail to finish (it started in parallel)
                await thumbnailPromise;

                let thumbnailUrl = '';
                if (thumbnailBlob) {
                  const thumbRef = ref(storage, `galleries/${item.galleryId}/thumbnails/${itemId}.jpg`);
                  await uploadBytesResumable(thumbRef, thumbnailBlob);
                  thumbnailUrl = await getDownloadURL(thumbRef);
                }

                const nowStr = new Date().toISOString();
                const uploadedByEmail = get().admin.email || 'anonymous';

                const fileMetadata = {
                  id: itemId,
                  name: cleanFileName,
                  originalName: item.originalName,
                  storagePath,
                  downloadUrl,
                  thumbnailUrl: thumbnailUrl || downloadUrl,
                  mimeType: item.mimeType,
                  size: item.size,
                  width: item.width,
                  height: item.height,
                  duration: item.duration,
                  uploadedAt: nowStr,
                  uploadedBy: uploadedByEmail,
                  projectId: item.galleryId,
                  folder: item.galleryId,
                  tags: []
                };

                // Save to Firestore files/ metadata collection
                const fileDocRef = doc(db, 'files', itemId);
                await setDoc(fileDocRef, fileMetadata);

                // Add to gallery photos list
                const photoObj: Photo = {
                  id: itemId,
                  url: downloadUrl,
                  thumbnailUrl: thumbnailUrl || downloadUrl,
                  name: file.name,
                  size: `${(item.size / (1024 * 1024)).toFixed(1)} MB`,
                  selectedByClient: false,
                  colorPalette: item.mimeType.startsWith('image/') ? 'Neutral' : undefined,
                  backdrop: item.mimeType.startsWith('image/') ? 'Studio' : undefined,
                  faceCount: item.mimeType.startsWith('image/') ? 1 : undefined,
                  originalName: item.originalName,
                  mimeType: item.mimeType,
                  sizeBytes: item.size,
                  width: item.width,
                  height: item.height,
                  duration: item.duration,
                  storagePath,
                  uploadedAt: nowStr,
                  uploadedBy: uploadedByEmail,
                  galleryId: item.galleryId,
                  tags: []
                };

                const galleryDocRef = doc(db, 'galleries', item.galleryId);
                const gallerySnap = await getDoc(galleryDocRef);

                if (gallerySnap.exists()) {
                  const existingPhotos = (gallerySnap.data() as Gallery).photos || [];
                  if (!existingPhotos.some((p) => p.id === itemId)) {
                    const nextPhotosList = [...existingPhotos, photoObj];
                    const coverPhotoUrl = nextPhotosList[0]?.url || '';
                    
                    await updateDoc(galleryDocRef, {
                      photos: nextPhotosList,
                      coverPhotoUrl
                    });

                    set((state) => ({
                      galleries: state.galleries.map((g) =>
                        g.id === item.galleryId ? { ...g, photos: nextPhotosList, coverPhotoUrl } : g
                      )
                    }));
                  }
                }

                set((state) => {
                  const nextQueue = state.uploadQueue.map((i) =>
                    i.id === itemId
                      ? {
                          ...i,
                          status: 'completed' as const,
                          progress: 100,
                          downloadUrl,
                          storagePath
                        }
                      : i
                  );

                  const nextActiveUploads = { ...state.activeUploads };
                  nextActiveUploads[itemId] = {
                    id: itemId,
                    name: file.name,
                    progress: 100,
                    status: 'completed'
                  };

                  return {
                    uploadQueue: nextQueue,
                    activeUploads: nextActiveUploads
                  };
                });

                fileObjectsMap.delete(itemId);
                get().processUploadQueue();
              } catch (e: any) {
                console.error('Post-upload completion handling failed:', e);
                set((state) => ({
                  uploadQueue: state.uploadQueue.map((i) =>
                    i.id === itemId ? { ...i, status: 'failed' as const, error: e.message || 'Processing failed' } : i
                  )
                }));
                get().processUploadQueue();
              }
            }
          );
        } catch (err: any) {
          console.error('Resumable task start failure:', err);
          set((state) => ({
            uploadQueue: state.uploadQueue.map((i) =>
              i.id === itemId ? { ...i, status: 'failed' as const, error: err.message || 'Init task failed' } : i
            )
          }));
          get().processUploadQueue();
        }
      },

      pauseUpload: (itemId) => {
        const task = runningTasks.get(itemId);
        if (task) {
          try {
            task.pause();
          } catch (e) {
            console.warn('Firebase task pause failed:', e);
          }
        }

        set((state) => ({
          uploadQueue: state.uploadQueue.map((i) =>
            i.id === itemId ? { ...i, status: 'paused' as const, speed: 0 } : i
          )
        }));
      },

      resumeUpload: (itemId) => {
        set((state) => ({
          uploadQueue: state.uploadQueue.map((i) =>
            i.id === itemId ? { ...i, status: 'waiting' as const, progress: i.progress, error: null } : i
          )
        }));

        const task = runningTasks.get(itemId);
        if (task) {
          try {
            task.resume();
            set((state) => ({
              uploadQueue: state.uploadQueue.map((i) =>
                i.id === itemId ? { ...i, status: 'uploading' as const } : i
              )
            }));
            return;
          } catch (e) {
            console.warn('Task resume method failed. Recreating task in queue...', e);
          }
        }

        get().processUploadQueue();
      },

      cancelUpload: (itemId) => {
        const task = runningTasks.get(itemId);
        if (task) {
          try {
            task.cancel();
          } catch (e) {
            console.warn('Task cancel method failed:', e);
          }
          runningTasks.delete(itemId);
        }
        fileObjectsMap.delete(itemId);

        set((state) => {
          const nextQueue = state.uploadQueue.filter((i) => i.id !== itemId);
          const nextActiveUploads = { ...state.activeUploads };
          delete nextActiveUploads[itemId];
          return {
            uploadQueue: nextQueue,
            activeUploads: nextActiveUploads
          };
        });

        get().processUploadQueue();
      },

      retryUpload: (itemId) => {
        set((state) => ({
          uploadQueue: state.uploadQueue.map((i) =>
            i.id === itemId
              ? { ...i, status: 'waiting' as const, progress: 0, speed: 0, retryCount: 0, error: null }
              : i
          )
        }));
        get().processUploadQueue();
      },

      removeCompletedUploads: () => {
        set((state) => {
          const nextQueue = state.uploadQueue.filter((i) => i.status !== 'completed');
          const nextActiveUploads = { ...state.activeUploads };
          Object.keys(nextActiveUploads).forEach((id) => {
            if (nextActiveUploads[id].status === 'completed') {
              delete nextActiveUploads[id];
            }
          });
          return {
            uploadQueue: nextQueue,
            activeUploads: nextActiveUploads
          };
        });
      },

      // Retained legacy callback to satisfy basic imports
      startBackgroundUpload: async (galleryId, photo, file) => {
        // Automatically inject file object mapping and start queue
        fileObjectsMap.set(photo.id, file);
        const item: UploadItem = {
          id: photo.id,
          galleryId,
          name: file.name,
          originalName: file.name,
          size: file.size,
          progress: 0,
          status: 'waiting',
          uploadedBytes: 0,
          speed: 0,
          timeRemaining: 0,
          error: null,
          mimeType: file.type || 'image/jpeg',
          width: null,
          height: null,
          duration: null,
          thumbnailUrl: photo.url,
          retryCount: 0
        };

        set((state) => ({
          uploadQueue: [...state.uploadQueue, item]
        }));

        get().processUploadQueue();
        return photo.url;
      },


      updateGalleryMetadata: async (galleryId, fields) => {
        set({ syncing: true, syncError: null });
        try {
          const docRef = doc(db, 'galleries', galleryId);
          // Use merge so we never overwrite photos accumulated by upload completions
          await setDoc(docRef, fields, { merge: true });

          set((state) => ({
            galleries: state.galleries.map((g) =>
              g.id === galleryId ? { ...g, ...fields } : g
            ),
            syncing: false
          }));
        } catch (err: any) {
          console.error('[Firebase sync] Failed to update gallery metadata:', err);
          set({ syncing: false, syncError: err.message || err });
          throw err;
        }
      },

      saveGalleryMetadata: async (gallery) => {
        set({ syncing: true, syncError: null });
        try {
          const docRef = doc(db, 'galleries', gallery.id);
          await setDoc(docRef, gallery);

          set((state) => {
            const slug = (gallery.collectionTitle || gallery.client.name)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '');
            const galleryUrl = `${getBaseUrl()}/gallery/${gallery.id}/${slug}`;
            const emailContent = buildGalleryCreatedEmail(
              gallery.client.name,
              gallery.collectionTitle || 'Untitled',
              galleryUrl
            );
            sendStudioNotification({
              ...emailContent,
              serviceId: state.settings.emailjsServiceId || '',
              templateId: state.settings.emailjsTemplateId || '',
              publicKey: state.settings.emailjsPublicKey || ''
            });

            const notif: Notification = {
              id: `notif-${Date.now()}`,
              message: `New gallery created and synced for ${gallery.client.name}${gallery.collectionTitle ? ` — "${gallery.collectionTitle}"` : ''}.`,
              type: 'info',
              createdAt: new Date().toISOString(),
              read: false
            };

            return {
              galleries: [gallery, ...state.galleries],
              notifications: [notif, ...state.notifications],
              syncing: false
            };
          });
        } catch (err: any) {
          console.error('[Firebase sync] Failed to save gallery metadata:', err);
          set((state) => {
            const notif: Notification = {
              id: `notif-${Date.now()}`,
              message: `Saved locally only (Firebase error: ${err.message || err})`,
              type: 'warning',
              createdAt: new Date().toISOString(),
              read: false
            };
            return {
              galleries: [gallery, ...state.galleries],
              notifications: [notif, ...state.notifications],
              syncing: false,
              syncError: `Firebase sync failed: ${err.message || err}`
            };
          });
          throw err;
        }
      },

      // Cloud Sync actions
      uploadAndAddGallery: async (gallery, filesMap) => {
        // ─── Step 1: Acquire Screen Wake Lock to prevent device sleep during upload ─
        let wakeLock: WakeLockSentinel | null = null;
        try {
          if ('wakeLock' in navigator) {
            wakeLock = await (navigator as any).wakeLock.request('screen');
            console.info('[WakeLock] Screen wake lock acquired for upload.');
          }
        } catch (wlErr) {
          console.warn('[WakeLock] Could not acquire wake lock:', wlErr);
        }

        // ─── Step 2: Show gallery instantly in local UI using blob URLs ─────────
        // Blob URLs only live in this browser session — never write them to Firestore.
        const blobCoverUrl = gallery.photos[0]?.url || '';
        const localPreviewGallery: Gallery = {
          ...gallery,
          coverPhotoUrl: blobCoverUrl,
          photos: gallery.photos,
          uploadComplete: false,
          uploadedPhotosCount: 0
        };

        set((state) => {
          const exists = state.galleries.some((g) => g.id === gallery.id);
          return {
            galleries: exists
              ? state.galleries.map((g) => (g.id === gallery.id ? localPreviewGallery : g))
              : [localPreviewGallery, ...state.galleries],
            syncing: true,
            syncError: null
          };
        });

        try {
          // ─── Step 3: Write skeleton gallery to Firestore (fire-and-forget, don't block uploads) ─
          const skeletonGallery: Gallery = {
            ...gallery,
            coverPhotoUrl: gallery.photos.find((p) => p.url?.startsWith('http'))?.url || '',
            photos: gallery.photos.map((p) => ({
              ...p,
              url: p.url?.startsWith('http') ? p.url : '',
              thumbnailUrl: p.thumbnailUrl?.startsWith('http') ? p.thumbnailUrl : (p.url?.startsWith('http') ? p.url : ''),
              previewUrl: p.previewUrl?.startsWith('http') ? p.previewUrl : (p.url?.startsWith('http') ? p.url : '')
            })),
            uploadComplete: false,
            uploadedPhotosCount: 0
          };
          // Fire off Firestore write without awaiting — uploads start immediately
          withRetry(() => setDoc(doc(db, 'galleries', gallery.id), skeletonGallery)).catch((e) =>
            console.warn('[Firestore] Skeleton write failed:', e)
          );

          // ─── Step 4: Upload photos with high concurrency ─────────────────────
          // 10 parallel streams for fast batch uploads; Firestore batched every 5 completions
          const CONCURRENCY = 10;
          const FIRESTORE_BATCH_EVERY = 5; // write to Firestore after every N completed uploads
          const uploadedPhotos = gallery.photos.map((p) => ({ ...p }));
          let index = 0;
          let completedCount = 0;
          const totalUploadable = gallery.photos.length;
          let lastFirestoreSave = 0;

          const saveToFirestore = async (isFinal = false) => {
            if (!isFinal && completedCount - lastFirestoreSave < FIRESTORE_BATCH_EVERY) return;
            lastFirestoreSave = completedCount;
            const currentPhotos = uploadedPhotos.map((p) => ({
              ...p,
              url: p.url?.startsWith('http') ? p.url : '',
              thumbnailUrl: p.thumbnailUrl?.startsWith('http') ? p.thumbnailUrl : (p.url?.startsWith('http') ? p.url : ''),
              previewUrl: p.previewUrl?.startsWith('http') ? p.previewUrl : (p.url?.startsWith('http') ? p.url : '')
            }));
            try {
              await withRetry(() => updateDoc(doc(db, 'galleries', gallery.id), {
                photos: currentPhotos,
                coverPhotoUrl: currentPhotos.find((p) => p.url.startsWith('http'))?.url || '',
                uploadedPhotosCount: completedCount,
                uploadComplete: isFinal
              }));
            } catch (fsErr) {
              console.warn('[Firestore] Batch save failed:', fsErr);
            }
          };

          const worker = async () => {
            while (index < uploadedPhotos.length) {
              const i = index++;
              const photo = uploadedPhotos[i];

              // If photo was ALREADY uploaded (starts with http), keep it!
              if (photo.url && photo.url.startsWith('http')) {
                completedCount++;
                set((state) => ({
                  activeUploads: {
                    ...state.activeUploads,
                    [photo.id]: { id: photo.id, name: photo.name, progress: 100, status: 'completed' }
                  }
                }));
                continue;
              }

              const file = filesMap.get(photo.id);
              if (!file) { completedCount++; continue; }

              // Mark as uploading in activeUploads
              set((state) => ({
                activeUploads: {
                  ...state.activeUploads,
                  [photo.id]: { id: photo.id, name: file.name, progress: 0, status: 'uploading' }
                }
              }));

              try {
                const uRes = await uploadPhotoSmart(
                  gallery.id,
                  photo.id,
                  file,
                  (info) => {
                    set((state) => ({
                      activeUploads: {
                        ...state.activeUploads,
                        [photo.id]: { id: photo.id, name: file.name, progress: info.percent, status: info.status }
                      }
                    }));
                  }
                );

                uploadedPhotos[i] = {
                  ...photo,
                  url: uRes.url,
                  cloudinaryPublicId: uRes.publicId,
                  thumbnailUrl: uRes.thumbnailUrl || uRes.url,
                  previewUrl: uRes.previewUrl || uRes.url,
                  originalName: file.name,
                  mimeType: file.type || 'image/jpeg',
                  sizeBytes: uRes.bytes || file.size,
                  width: uRes.width || null,
                  height: uRes.height || null,
                  uploadedAt: new Date().toISOString(),
                  uploadedBy: get().admin.email || 'admin@divashotsstudios.com'
                };
                completedCount++;

                // Update local UI state immediately
                set((state) => ({
                  activeUploads: {
                    ...state.activeUploads,
                    [photo.id]: { id: photo.id, name: file.name, progress: 100, status: 'completed' }
                  },
                  galleries: state.galleries.map((g) =>
                    g.id === gallery.id
                      ? { ...g, uploadedPhotosCount: completedCount, uploadComplete: completedCount === totalUploadable }
                      : g
                  )
                }));

                // Batch Firestore save (non-blocking)
                saveToFirestore(false).catch(() => {});

              } catch (uploadErr) {
                console.error(`[Upload] Failed for ${file.name}:`, uploadErr);
                completedCount++;
                set((state) => ({
                  activeUploads: {
                    ...state.activeUploads,
                    [photo.id]: { id: photo.id, name: file.name, progress: 0, status: 'failed' }
                  }
                }));
              }
            }
          };

          await Promise.all(Array.from({ length: CONCURRENCY }, worker));

          // ─── Step 5: Build final gallery with real Cloudinary URLs ───────────
          const finalPhotos = uploadedPhotos.map((p) => ({
            ...p,
            url: p.url?.startsWith('http') ? p.url : '',
            thumbnailUrl: p.thumbnailUrl?.startsWith('http') ? p.thumbnailUrl : (p.url?.startsWith('http') ? p.url : ''),
            previewUrl: p.previewUrl?.startsWith('http') ? p.previewUrl : (p.url?.startsWith('http') ? p.url : '')
          }));

          const validUploadedPhotos = finalPhotos.filter((p) => p.url.length > 0);

          const finalGallery: Gallery = {
            ...gallery,
            photos: finalPhotos,
            coverPhotoUrl: validUploadedPhotos[0]?.url || '',
            uploadComplete: true,
            uploadedPhotosCount: validUploadedPhotos.length
          };

          // ─── Step 6: Final authoritative Firestore overwrite with all real URLs ──
          await withRetry(() => setDoc(doc(db, 'galleries', finalGallery.id), finalGallery));

          // ─── Step 7: Update local state with real URLs + send email ──────────
          set((state) => {
            const slug = (finalGallery.collectionTitle || finalGallery.client.name)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '');
            const galleryUrl = `${getBaseUrl()}/gallery/${finalGallery.id}/${slug}`;
            sendStudioNotification({
              ...buildGalleryCreatedEmail(
                finalGallery.client.name,
                finalGallery.collectionTitle || 'Untitled',
                galleryUrl
              ),
              serviceId: state.settings.emailjsServiceId || '',
              templateId: state.settings.emailjsTemplateId || '',
              publicKey: state.settings.emailjsPublicKey || ''
            });

            const notif: Notification = {
              id: `notif-${Date.now()}`,
              message: `Gallery uploaded for ${finalGallery.client.name}${finalGallery.collectionTitle ? ` — "${finalGallery.collectionTitle}"` : ''}.`,
              type: 'info',
              createdAt: new Date().toISOString(),
              read: false
            };

            return {
              galleries: state.galleries.map((g) => g.id === finalGallery.id ? finalGallery : g),
              notifications: [notif, ...state.notifications],
              syncing: false
            };
          });

        } catch (err: any) {
          console.error('[Firebase sync] Upload failed:', err);
          set((state) => {
            const notif: Notification = {
              id: `notif-${Date.now()}`,
              message: `Upload error: ${err.message || err}`,
              type: 'warning',
              createdAt: new Date().toISOString(),
              read: false
            };
            return {
              notifications: [notif, ...state.notifications],
              syncing: false,
              syncError: `Firebase sync failed: ${err.message || err}`
            };
          });
          throw err;
        } finally {
          // ─── Always release Wake Lock when upload finishes or fails ────────────
          if (wakeLock) {
            try {
              await wakeLock.release();
              console.info('[WakeLock] Screen wake lock released.');
            } catch (wlErr) {
              console.warn('[WakeLock] Release failed:', wlErr);
            }
          }
        }
      },

      fetchGalleryById: async (id) => {
        // Skip network fetch if gallery is already in local store with real URLs
        const existing = get().galleries.find((g) => g.id === id);
        if (existing && existing.photos.length > 0 && existing.photos[0].url.startsWith('http')) {
          return existing;
        }

        set({ syncing: true, syncError: null });
        try {
          const docRef = doc(db, 'galleries', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const g = docSnap.data() as Gallery;
            set((state) => {
              const exists = state.galleries.some((item) => item.id === g.id);
              const updated = exists
                ? state.galleries.map((item) => (item.id === g.id ? g : item))
                : [g, ...state.galleries];
              return { galleries: updated, syncing: false };
            });
            return g;
          }
          set({ syncing: false });
          return null;
        } catch (err: any) {
          console.error('[Firebase sync] Failed to fetch gallery:', err);
          set({ syncing: false, syncError: err.message || err });
          return get().galleries.find((g) => g.id === id) || null;
        }
      },

      syncGallerySelection: async (galleryId, updatedPhotos) => {
        set({ syncing: true, syncError: null });
        try {
          const gallery = get().galleries.find((g) => g.id === galleryId);
          if (!gallery) throw new Error('Gallery not found in local store');

          const selectedCount = updatedPhotos.filter((p) => p.selectedByClient).length;
          const extraPhotosCount = Math.max(0, selectedCount - gallery.includedPhotos);
          const extraAmountDue = extraPhotosCount * gallery.extraPhotoPrice;

          const updatedFields = {
            photos: updatedPhotos,
            selectedCount,
            extraPhotosCount,
            extraAmountDue
          };

          const docRef = doc(db, 'galleries', galleryId);
          await updateDoc(docRef, updatedFields);

          // Update local state
          set((state) => ({
            galleries: state.galleries.map((g) =>
              g.id === galleryId ? { ...g, ...updatedFields } : g
            ),
            syncing: false
          }));
        } catch (err: any) {
          console.error('[Firebase sync] Failed to sync selection:', err);
          set({ syncing: false, syncError: err.message || err });
          // Local fallback
          set((state) => ({
            galleries: state.galleries.map((g) => {
              if (g.id !== galleryId) return g;
              const selectedCount = updatedPhotos.filter((p) => p.selectedByClient).length;
              const extraPhotosCount = Math.max(0, selectedCount - g.includedPhotos);
              const extraAmountDue = extraPhotosCount * g.extraPhotoPrice;
              return {
                ...g,
                photos: updatedPhotos,
                selectedCount,
                extraPhotosCount,
                extraAmountDue
              };
            })
          }));
        }
      },

      fetchAllGalleriesFromFirestore: async () => {
        // 60-second client-side cache to prevent redundant Firestore reads on rapid re-renders
        const now = Date.now();
        if (now - get().galleriesFetchedAt < 60_000) return;

        set({ syncing: true, syncError: null });
        try {
          const querySnapshot = await getDocs(collection(db, 'galleries'));
          const list: Gallery[] = [];
          querySnapshot.forEach((doc) => {
            list.push(doc.data() as Gallery);
          });
          list.sort((a, b) => b.id.localeCompare(a.id));
          set({ galleries: list, syncing: false, galleriesFetchedAt: Date.now() });
        } catch (err: any) {
          console.error('[Firebase sync] Failed to fetch all:', err);
          set({ syncing: false, syncError: err.message || err });
        }
      },

      updateGalleryStatusInFirestore: async (galleryId, status) => {
        set({ syncing: true, syncError: null });
        try {
          const docRef = doc(db, 'galleries', galleryId);
          const updateData: any = { status };
          if (status === 'Submitted') {
            updateData.submittedAt = new Date().toISOString();
          } else if (status === 'Reopened') {
            updateData.submittedAt = null;
          }
          await updateDoc(docRef, updateData);

          // Local update
          set((state) => ({
            galleries: state.galleries.map((g) =>
              g.id === galleryId ? { ...g, ...updateData } : g
            ),
            syncing: false
          }));
        } catch (err: any) {
          console.error('[Firebase sync] Failed to update status:', err);
          set({ syncing: false, syncError: err.message || err });
          // Fallback local update
          set((state) => ({
            galleries: state.galleries.map((g) =>
              g.id === galleryId ? { ...g, status, submittedAt: status === 'Submitted' ? new Date().toISOString() : status === 'Reopened' ? null : g.submittedAt } : g
            )
          }));
        }
      },

      deleteGalleryFromFirestore: async (galleryId) => {
        // Optimistic: remove from UI immediately, then clean up Firestore in background
        set((state) => ({
          galleries: state.galleries.filter((g) => g.id !== galleryId),
          syncing: false,
          syncError: null
        }));
        try {
          const docRef = doc(db, 'galleries', galleryId);
          await deleteDoc(docRef);
        } catch (err: any) {
          console.error('[Firebase sync] Failed to delete document:', err);
          // Gallery already removed from UI — no need to revert, just log
        }
      },

      fetchSettingsFromFirestore: async () => {
        set({ syncing: true, syncError: null });
        try {
          const docRef = doc(db, 'settings', 'studio');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const s = docSnap.data() as StudioSettings;
            set({ settings: s, syncing: false });
            return s;
          }
          set({ syncing: false });
          return null;
        } catch (err: any) {
          console.error('[Firebase sync] Failed to fetch settings:', err);
          set({ syncing: false, syncError: err.message || err });
          return null;
        }
      },

      updateSettingsInFirestore: async (newSettings) => {
        set({ syncing: true, syncError: null });
        try {
          const docRef = doc(db, 'settings', 'studio');
          await setDoc(docRef, newSettings);
          set({ settings: newSettings, syncing: false });
        } catch (err: any) {
          console.error('[Firebase sync] Failed to save settings:', err);
          set({ settings: newSettings, syncing: false, syncError: err.message || err });
        }
      }
    }),
    {
      name: 'diva-shots-studio-storage'
    }
  )
);

// Automatic reconnect recovery handler
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const store = useStore.getState();
    let resumedAny = false;
    store.uploadQueue.forEach((item) => {
      if (
        item.status === 'failed' &&
        item.error &&
        (item.error.toLowerCase().includes('network') || item.error.toLowerCase().includes('storage/retry-limit-exceeded'))
      ) {
        store.resumeUpload(item.id);
        resumedAny = true;
      }
    });
    if (resumedAny) {
      store.addNotification('Internet connection restored. Resuming pending file uploads.', 'info');
    }
  });
}

