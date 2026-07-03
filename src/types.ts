export interface Admin {
  email: string;
  isAuthenticated: boolean;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface Package {
  id: string;
  name: string;
  includedPhotos: number;
  extraPhotoPrice: number; // Price per extra photo, e.g. in UGX
}

export interface Photo {
  id: string;
  url: string;
  name: string;
  size?: string;
  selectedByClient: boolean;
  colorPalette?: 'Warm' | 'Cool' | 'Vibrant' | 'Neutral' | 'Monochrome';
  backdrop?: 'Nature' | 'Studio' | 'Urban' | 'Sunset' | 'Bokeh';
  faceCount?: number;
  // Extended file upload metadata fields
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  storagePath?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  galleryId?: string;
  thumbnailUrl?: string;
  tags?: string[];
}

export interface UploadItem {
  id: string;
  galleryId: string;
  name: string;
  originalName: string;
  size: number; // in bytes
  progress: number; // 0 to 100
  status: 'waiting' | 'uploading' | 'paused' | 'processing' | 'completed' | 'failed';
  uploadedBytes: number;
  speed: number; // bytes/sec
  timeRemaining: number; // seconds
  error: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  thumbnailUrl: string; // Object URL for preview
  retryCount: number;
  storagePath?: string;
  downloadUrl?: string;
}

export type GalleryStatus =
  | 'Draft'
  | 'Link Generated'
  | 'Client Selecting'
  | 'Submitted'
  | 'Reopened'
  | 'Closed';

export interface Gallery {
  id: string;
  client: Client;
  collectionTitle?: string;
  coverPhotoUrl?: string;
  includedPhotos: number;
  extraPhotoPrice: number; // in UGX
  welcomeMessage?: string;
  photos: Photo[];
  status: GalleryStatus;
  selectedCount: number;
  submittedAt: string | null;
  extraPhotosCount: number;
  extraAmountDue: number;
}

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  createdAt: string;
  read: boolean;
}

export interface StudioSettings {
  studioName: string;
  slogan: string;
  currency: string;
  defaultExtraPrice: number;
  // EmailJS config for real email notifications to divashotsstudios@gmail.com
  emailjsServiceId?: string;
  emailjsTemplateId?: string;
  emailjsPublicKey?: string;
  compressBeforeUpload?: boolean;
}
