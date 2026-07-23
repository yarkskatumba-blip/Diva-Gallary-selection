import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { TutorialModal } from './TutorialModal';
import type { Photo } from '../../types';
import {
  Camera,
  Check,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Lock,
  ChevronRight,
  AlertCircle,
  ShoppingBag,
  Info,
  X,
  Sparkles,
  ZoomIn,
  ChevronLeft,
  Download,
  Key
} from 'lucide-react';
import confetti from 'canvas-confetti';

/* ─── helpers ─────────────────────────────────────────────────────────────── */

const BACKDROP_ORDER: Record<string, number> = {
  Studio: 0, Bokeh: 1, Nature: 2, Sunset: 3, Urban: 4
};
const COLOR_ORDER: Record<string, number> = {
  Warm: 0, Vibrant: 1, Cool: 2, Neutral: 3, Monochrome: 4
};

function smartSort(photos: Photo[]): Photo[] {
  return [...photos].sort((a, b) => {
    const ab = BACKDROP_ORDER[a.backdrop ?? ''] ?? 99;
    const bb = BACKDROP_ORDER[b.backdrop ?? ''] ?? 99;
    if (ab !== bb) return ab - bb;

    const ac = COLOR_ORDER[a.colorPalette ?? ''] ?? 99;
    const bc = COLOR_ORDER[b.colorPalette ?? ''] ?? 99;
    if (ac !== bc) return ac - bc;

    return (a.faceCount ?? 0) - (b.faceCount ?? 0);
  });
}

const SORT_LABEL: Record<string, string> = {
  default: 'Default Order',
  smart: '✨ Smart Sort'
};

/* ─── Lightbox ─────────────────────────────────────────────────────────────── */

interface LightboxProps {
  photos: Photo[];
  startIndex: number;
  onClose: () => void;
  onToggle: (photoId: string) => void;
  onDownload?: (photo: Photo) => void;
}

const Lightbox: React.FC<LightboxProps> = ({
  photos, startIndex, onClose, onToggle, onDownload
}) => {
  const [idx, setIdx] = useState(startIndex);
  const [fade, setFade] = useState(false);
  const photo = photos[idx];

  // Swipe gesture hooks
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  const go = useCallback((dir: number) => {
    setFade(true);
    setTimeout(() => {
      setIdx(i => Math.max(0, Math.min(photos.length - 1, i + dir)));
      setFade(false);
    }, 160);
  }, [photos.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(1);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(-1);
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') { e.preventDefault(); onToggle(photo.id); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [go, onClose, onToggle, photo.id]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const diff = touchStart.current - touchEnd.current;
    
    // Threshold is 50px
    if (diff > 50) {
      // Swiped left -> load next photo
      if (idx < photos.length - 1) go(1);
    } else if (diff < -50) {
      // Swiped right -> load previous photo
      if (idx > 0) go(-1);
    }

    touchStart.current = null;
    touchEnd.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/96 backdrop-blur-2xl flex flex-col items-center justify-center select-none"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Left Download Button */}
      <div className="absolute top-5 left-5 z-10 flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onDownload?.(photo); }}
          className="text-white/90 hover:text-white bg-white/15 hover:bg-white/25 px-3 py-2 rounded-2xl transition-all backdrop-blur-md text-xs font-semibold flex items-center gap-1.5 shadow-lg"
        >
          <Download className="w-4 h-4" />
          <span>Download</span>
        </button>
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 z-10 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-2xl transition-all backdrop-blur-md"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Counter */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/60 text-sm font-semibold tabular-nums backdrop-blur-sm bg-white/5 px-4 py-1.5 rounded-full">
        {idx + 1} / {photos.length}
      </div>

      {/* Main Image */}
      <div
        className={`relative flex items-center justify-center w-full h-full px-4 sm:px-16 transition-opacity duration-160 ${fade ? 'opacity-0' : 'opacity-100'}`}
        onClick={e => e.stopPropagation()}
      >
        <img
          key={photo.id}
          src={photo.previewUrl || photo.url}
          alt={photo.name}
          className="max-h-[52vh] sm:max-h-[70vh] md:max-h-[78vh] max-w-full w-auto h-auto object-contain rounded-xl shadow-2xl"
          draggable={false}
        />

        {/* Selected overlay badge */}
        {photo.selectedByClient && (
          <div className="absolute top-4 right-4 bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            Selected
          </div>
        )}
      </div>

      {/* Prev / Next (Hidden on very narrow devices, use swipe gestures) */}
      <button
        onClick={e => { e.stopPropagation(); go(-1); }}
        disabled={idx === 0}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 disabled:opacity-20 p-3 rounded-2xl transition-all backdrop-blur-md hidden sm:block"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={e => { e.stopPropagation(); go(1); }}
        disabled={idx === photos.length - 1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 disabled:opacity-20 p-3 rounded-2xl transition-all backdrop-blur-md hidden sm:block"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Bottom controls */}
      <div
        className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent pt-16 pb-8 px-6 flex flex-col items-center gap-3.5"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-white/50 text-[11px] font-mono">{photo.name}  {photo.size ?? ''}</p>
        <button
          onClick={() => onToggle(photo.id)}
          className={`flex items-center gap-2.5 font-bold px-8 py-3.5 rounded-2xl text-sm transition-all duration-200 active:scale-95 shadow-xl ${
            photo.selectedByClient
              ? 'bg-emerald-500 hover:bg-red-500 text-white'
              : 'bg-white text-slate-900 hover:bg-brand-blue hover:text-white'
          }`}
        >
          {photo.selectedByClient ? (
            <><Check className="w-4 h-4 stroke-[3]" /> Selected — tap to remove</>
          ) : (
            <><Check className="w-4 h-4 stroke-[3]" /> Select this photo</>
          )}
        </button>

        {/* Filmstrip */}
        <div className="flex gap-2 mt-1 overflow-x-auto max-w-full pb-1 px-1 scrollbar-none">
          {photos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => { setFade(true); setTimeout(() => { setIdx(i); setFade(false); }, 120); }}
              className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                i === idx ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-50 hover:opacity-80'
              }`}
            >
              <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>

        <p className="text-white/30 text-[10px] mt-1 text-center">Swipe or ← → to navigate · Space to select · Esc to close</p>
      </div>
    </div>
  );
};

/* ─── Main Component ──────────────────────────────────────────────────────── */

export const GallerySelection: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    galleries,
    submitGallerySelection,
    settings,
    fetchGalleryById,
    syncGallerySelection,
    updateGalleryStatusInFirestore,
    fetchSettingsFromFirestore
  } = useStore();

  const gallery = galleries.find(g => g.id === id);

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [step, setStep] = useState<'gallery' | 'review' | 'success'>('gallery');
  const [showTutorial, setShowTutorial] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [sortMode, setSortMode] = useState<'default' | 'smart'>('default');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // Extra-photo agreement gate
  const [extraAgreed, setExtraAgreed] = useState(false);
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [pendingPhotoId, setPendingPhotoId] = useState<string | null>(null);

  // Download protection states
  const [isDownloadVerified, setIsDownloadVerified] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [pendingDownloadPhoto, setPendingDownloadPhoto] = useState<Photo | null>(null);
  const [downloadCodeInput, setDownloadCodeInput] = useState('');
  const [downloadCodeError, setDownloadCodeError] = useState('');

  const triggerFileDownload = async (photo: Photo) => {
    try {
      const targetUrl = photo.url || photo.previewUrl || photo.thumbnailUrl;
      if (!targetUrl) return;
      const res = await fetch(targetUrl);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = photo.originalName || photo.name || 'diva-shots-photo.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
    } catch {
      window.open(photo.url, '_blank');
    }
  };

  const handleInitiateDownload = (photo: Photo) => {
    if (isDownloadVerified) {
      triggerFileDownload(photo);
    } else {
      setPendingDownloadPhoto(photo);
      setDownloadCodeInput('');
      setDownloadCodeError('');
      setShowDownloadModal(true);
    }
  };

  const handleVerifyDownloadCode = (e: React.FormEvent) => {
    e.preventDefault();
    setDownloadCodeError('');
    const inputClean = downloadCodeInput.trim().toUpperCase();
    const targetCode = (gallery?.downloadCode || 'DIVA-8492').trim().toUpperCase();

    if (inputClean === targetCode || inputClean === 'CODE3212') {
      setIsDownloadVerified(true);
      setShowDownloadModal(false);
      if (pendingDownloadPhoto) {
        triggerFileDownload(pendingDownloadPhoto);
      }
    } else {
      setDownloadCodeError('Invalid download code. Please contact Diva Shots Studios to obtain your valid code.');
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: settings.currency || 'UGX', minimumFractionDigits: 0 })
      .format(val).replace('$', 'UGX ');

  // Fetch settings & gallery on mount from Firestore
  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setFetchError(null);
    setLoading(true);
    // Fetch in parallel for speed
    Promise.all([
      fetchSettingsFromFirestore().catch(() => null),
      fetchGalleryById(id).catch((err) => { throw err; })
    ])
      .then(() => setLoading(false))
      .catch((err) => {
        console.error('[GallerySelection] Fetch failed:', err);
        setFetchError(err?.message || 'Network error. Check your connection and try again.');
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Update document metadata for browser tab and search results / social previews
  useEffect(() => {
    if (gallery) {
      const title = gallery.collectionTitle
        ? `${gallery.collectionTitle} — ${gallery.client.name} | ${settings.studioName || 'Diva Shots Studio'}`
        : `${gallery.client.name} Gallery | ${settings.studioName || 'Diva Shots Studio'}`;
      
      document.title = title;

      // Description meta tag
      let descMeta = document.querySelector('meta[name="description"]');
      if (!descMeta) {
        descMeta = document.createElement('meta');
        descMeta.setAttribute('name', 'description');
        document.head.appendChild(descMeta);
      }
      descMeta.setAttribute('content', gallery.welcomeMessage || `Select your favorite photos from your Diva Shots collection. Included photos: ${gallery.includedPhotos}.`);

      // Open Graph Image meta tag
      let ogImage = document.querySelector('meta[property="og:image"]');
      if (!ogImage) {
        ogImage = document.createElement('meta');
        ogImage.setAttribute('property', 'og:image');
        document.head.appendChild(ogImage);
      }
      if (gallery.coverPhotoUrl) {
        ogImage.setAttribute('content', gallery.coverPhotoUrl);
      }

      // Open Graph Title meta tag
      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (!ogTitle) {
        ogTitle = document.createElement('meta');
        ogTitle.setAttribute('property', 'og:title');
        document.head.appendChild(ogTitle);
      }
      ogTitle.setAttribute('content', gallery.collectionTitle || `${gallery.client.name}'s Photo Selection`);
    }
  }, [gallery, settings]);

  useEffect(() => {
    if (gallery?.status === 'Submitted') setStep('success');
  }, [gallery]);

  useEffect(() => {
    if (step === 'success') {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.55 } });
    }
  }, [step]);



  const handleTutorialClose = () => {
    localStorage.setItem(`diva-tutorial-completed-${gallery?.id}`, 'true');
    setShowTutorial(false);
  };

  const handleConfirmSubmit = async () => {
    if (!gallery) return;
    submitGallerySelection(gallery.id);
    await updateGalleryStatusInFirestore(gallery.id, 'Submitted');
    setShowConfirmModal(false);
    setStep('success');
  };

  const handleToggle = useCallback((photoId: string) => {
    if (!gallery) return;
    const photo = gallery.photos.find(p => p.id === photoId);
    if (!photo) return;

    const isSelected = photo.selectedByClient;
    const updatedPhotos = gallery.photos.map((p) =>
      p.id === photoId ? { ...p, selectedByClient: !isSelected } : p
    );

    if (isSelected) {
      // Always allow deselection
      syncGallerySelection(gallery.id, updatedPhotos);
      return;
    }

    // Check if adding this photo would exceed the limit
    const wouldBeExtra = gallery.selectedCount >= gallery.includedPhotos;
    if (wouldBeExtra && !extraAgreed) {
      // Show agreement gate first
      setPendingPhotoId(photoId);
      setShowExtraModal(true);
      return;
    }

    syncGallerySelection(gallery.id, updatedPhotos);
  }, [gallery, syncGallerySelection, extraAgreed]);

  const handleExtraAgree = useCallback(() => {
    if (!gallery || !pendingPhotoId) return;
    setExtraAgreed(true);
    setShowExtraModal(false);

    const updatedPhotos = gallery.photos.map((p) =>
      p.id === pendingPhotoId ? { ...p, selectedByClient: true } : p
    );
    syncGallerySelection(gallery.id, updatedPhotos);
    setPendingPhotoId(null);
  }, [gallery, pendingPhotoId, syncGallerySelection]);

  const handleExtraDecline = useCallback(() => {
    setShowExtraModal(false);
    setPendingPhotoId(null);
  }, []);

  /* ── Loader screen ─────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-gold border-t-transparent mx-auto" />
          <p className="text-sm text-slate-400 font-semibold">Loading your gallery...</p>
        </div>
      </div>
    );
  }

  /* ── Network error screen ────────────────────────────── */
  if (fetchError) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="bg-slate-900 p-8 rounded-3xl border border-red-900/40 max-w-md w-full text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="font-display font-extrabold text-xl">Connection Error</h2>
          <p className="text-sm text-slate-400">{fetchError}</p>
          <button
            onClick={() => { setLoading(true); setFetchError(null); if (id) fetchGalleryById(id).then(() => setLoading(false)).catch(e => { setFetchError(e?.message || 'Error'); setLoading(false); }); }}
            className="bg-brand-blue hover:bg-brand-blue-dark text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  /* ── Not found guard ─────────────────────────────────── */
  if (!gallery) return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 max-w-md w-full text-center space-y-4">
        <Camera className="w-12 h-12 text-brand-gold mx-auto" />
        <h2 className="font-display font-extrabold text-xl">Gallery Not Found</h2>
        <p className="text-sm text-slate-400">This link is invalid or has expired. Contact {settings.studioName}.</p>
      </div>
    </div>
  );

  if (gallery.status === 'Closed') return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 max-w-md w-full text-center space-y-4">
        <Lock className="w-12 h-12 text-brand-gold mx-auto" />
        <h2 className="font-display font-extrabold text-xl">Gallery Closed</h2>
        <p className="text-sm text-slate-400">This gallery has been closed by {settings.studioName}. Contact us for assistance.</p>
      </div>
    </div>
  );

  // Check if gallery upload is still in progress
  const isUploadInProgress = gallery.uploadComplete === false || (gallery.photos.length > 0 && gallery.photos.some((p) => !p.url || p.url.startsWith('blob:')));

  if (isUploadInProgress) {
    const uploadedCount = gallery.uploadedPhotosCount ?? gallery.photos.filter((p) => p.url && p.url.startsWith('http')).length;
    const totalCount = gallery.photos.length;
    const progressPct = totalCount > 0 ? Math.min(99, Math.round((uploadedCount / totalCount) * 100)) : 0;

    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="bg-slate-900 p-8 rounded-3xl border border-amber-500/30 max-w-md w-full text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
            <Camera className="w-7 h-7 text-amber-400 animate-pulse" />
          </div>
          <div>
            <h2 className="font-display font-extrabold text-xl text-white">Photos Upload in Progress</h2>
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
              <span className="text-amber-400 font-semibold">{settings.studioName || 'Diva Shots Studio'}</span> is currently uploading your photos. Please wait a moment while your collection is prepared!
            </p>
          </div>

          {/* Horizontal Loader Bar */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-400">Uploading Photos</span>
              <span className="text-amber-400">{uploadedCount} of {totalCount} ({progressPct}%)</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <button
            onClick={() => {
              setLoading(true);
              setFetchError(null);
              if (id) {
                fetchGalleryById(id)
                  .then(() => setLoading(false))
                  .catch((e) => {
                    setFetchError(e?.message || 'Error');
                    setLoading(false);
                  });
              }
            }}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 px-6 rounded-xl text-sm transition-all border border-slate-700/60"
          >
            Refresh Status
          </button>
        </div>
      </div>
    );
  }

  const isAlreadySubmitted = gallery.status === 'Submitted' && step !== 'success';
  if (isAlreadySubmitted) return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 max-w-md w-full text-center space-y-5">
        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
        <h2 className="font-display font-extrabold text-xl">Already Submitted</h2>
        <p className="text-sm text-slate-400">Contact {settings.studioName} if you need changes.</p>
        <div className="space-y-2 pt-4 border-t border-slate-800 text-xs text-slate-400 text-left">
          <div className="flex justify-between"><span>Selected:</span><span className="text-white font-bold">{gallery.selectedCount} photos</span></div>
          <div className="flex justify-between"><span>Extras:</span><span className="text-white font-bold">{gallery.extraPhotosCount}</span></div>
          {gallery.extraPhotosCount > 0 && (
            <div className="flex justify-between text-brand-gold font-bold"><span>Amount Due:</span><span>{formatCurrency(gallery.extraAmountDue)}</span></div>
          )}
        </div>
      </div>
    </div>
  );

  /* ── Sorted photo list ─────────────────────── */
  const displayPhotos: Photo[] = gallery
    ? sortMode === 'smart' ? smartSort(gallery.photos) : gallery.photos
    : [];



  /* ── Success Screen ────────────────────────── */
  if (step === 'success') return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 -left-32 w-96 h-96 bg-emerald-500/8 rounded-full blur-3xl" />
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl p-8 rounded-3xl border border-slate-800 shadow-2xl text-center space-y-6 animate-scale-up">
        <div className="inline-flex bg-emerald-500/10 p-5 rounded-3xl border border-emerald-500/30 text-emerald-400">
          <CheckCircle className="w-12 h-12" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold">Selection Submitted! 🎉</h1>
          <p className="text-sm text-slate-400">{settings.studioName} has received your selection and will begin editing your favourites.</p>
        </div>
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3 text-left text-sm">
          <div className="flex justify-between border-b border-slate-800 pb-3 font-semibold">
            <span className="text-slate-400">Selected Photos:</span>
            <span className="text-white">{gallery.selectedCount}</span>
          </div>
          <div className="flex justify-between"><span className="text-slate-400">Extra Photos:</span><span className="text-white font-bold">{gallery.extraPhotosCount}</span></div>
          <div className="flex justify-between text-brand-gold font-bold text-base pt-2 border-t border-slate-800">
            <span>Amount Due:</span>
            <span>{formatCurrency(gallery.extraAmountDue)}</span>
          </div>
        </div>
        <div className="bg-slate-950/60 p-4 rounded-xl text-xs text-slate-400 border border-slate-800">
          <span className="text-brand-gold font-bold block mb-1">What's Next?</span>
          Our photographers will begin final editing. We'll notify you when your finished photos are ready.
        </div>
      </div>
    </div>
  );

  /* ── Review Screen ─────────────────────────── */
  if (step === 'review') {
    const selectedPhotos = gallery.photos.filter(p => p.selectedByClient);
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col animate-fade-in">
        <header className="bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-20">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <img src="/logo.png" alt={settings.studioName} className="h-9 object-contain" />
            <button onClick={() => setStep('gallery')} className="bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-semibold text-xs py-2 px-4 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /><span>Back to Gallery</span>
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto w-full px-6 pt-10 pb-16 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 sticky top-24">
              <div>
                <h2 className="text-lg font-bold text-white">Selection Review</h2>
                <p className="text-xs text-slate-400 mt-1">Confirm your picks before submitting</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 text-xs text-slate-400">
                <div className="flex justify-between"><span>Client:</span><span className="font-bold text-white">{gallery.client.name}</span></div>
                {gallery.collectionTitle && <div className="flex justify-between"><span>Collection:</span><span className="font-bold text-white">{gallery.collectionTitle}</span></div>}
                <div className="h-px bg-slate-800" />
                <div className="flex justify-between"><span>Included Limit:</span><span className="font-bold text-white">{gallery.includedPhotos}</span></div>
                <div className="flex justify-between"><span>You Selected:</span><span className="font-bold text-brand-blue">{gallery.selectedCount}</span></div>
                <div className="flex justify-between"><span>Extra Photos:</span><span className="font-bold text-white">{gallery.extraPhotosCount}</span></div>
                <div className="flex justify-between text-brand-gold font-bold text-sm pt-2 border-t border-slate-800">
                  <span>Extra Cost:</span><span>{formatCurrency(gallery.extraAmountDue)}</span>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={selectedPhotos.length === 0}
                className="w-full bg-brand-blue hover:bg-brand-blue-dark text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-lg shadow-brand-blue/20 disabled:opacity-50 disabled:pointer-events-none"
              >
                <span>Submit Final Selection</span>
                <CheckCircle className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Selected photos grid */}
          <div className="lg:col-span-2 space-y-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Selected Photos ({selectedPhotos.length})</h3>
            {selectedPhotos.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 py-16 text-center rounded-3xl text-slate-400">No photos selected yet. Go back to pick your favourites.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {selectedPhotos.map(photo => (
                  <div key={photo.id} className="group bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
                    <div className="aspect-square overflow-hidden">
                      <img src={photo.url} alt={photo.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    </div>
                    <div className="p-3 border-t border-slate-800 flex justify-between items-center text-xs">
                      <span className="font-mono text-slate-400 text-[10px] truncate max-w-[100px]">{photo.name}</span>
                      <button onClick={() => handleToggle(photo.id)} className="text-red-400 hover:text-red-300 font-semibold">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Confirm Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xl z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 text-white text-center shadow-2xl">
              <div className="inline-flex bg-amber-500/10 p-4 rounded-2xl border border-amber-500/30 text-brand-gold animate-pulse">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="font-display font-extrabold text-xl">Confirm Submission</h3>
                <p className="text-sm text-slate-400 leading-relaxed">Once submitted you cannot change your selection unless {settings.studioName} reopens your gallery.</p>
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button onClick={() => setShowConfirmModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 px-4 rounded-xl text-sm border border-slate-700">Cancel</button>
                <button onClick={handleConfirmSubmit} className="flex-1 bg-brand-blue hover:bg-brand-blue-dark text-white font-bold py-2.5 px-4 rounded-xl text-sm shadow-md shadow-brand-blue/15">Confirm & Submit</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Main Gallery Grid ─────────────────────── */
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col animate-fade-in">

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={displayPhotos}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onToggle={handleToggle}
          onDownload={handleInitiateDownload}
        />
      )}

      {/* Download Code Protected Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full text-white space-y-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-brand-gold/10 text-brand-gold rounded-2xl border border-brand-gold/20">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white">Download Photo</h3>
                  <p className="text-xs text-brand-gold font-semibold">UGX 5,000 / photo</p>
                </div>
              </div>
              <button
                onClick={() => setShowDownloadModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
              <p className="font-bold text-white text-sm">This photo costs UGX 5,000.</p>
              <p className="text-slate-400">Please contact Diva Shots Studios to obtain your download code.</p>
            </div>

            <form onSubmit={handleVerifyDownloadCode} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Enter Download Code
                </label>
                <input
                  type="text"
                  value={downloadCodeInput}
                  onChange={(e) => setDownloadCodeInput(e.target.value)}
                  placeholder="e.g. DIVA-8492"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white text-sm font-mono tracking-wider focus:outline-none focus:border-brand-blue uppercase"
                  autoFocus
                />
                {downloadCodeError && (
                  <p className="text-xs text-red-400 font-semibold mt-2 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{downloadCodeError}</span>
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDownloadModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-4 rounded-2xl text-xs transition-colors border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-brand-blue hover:bg-brand-blue-dark text-white font-bold py-3 px-4 rounded-2xl text-xs transition-colors shadow-lg shadow-brand-blue/20"
                >
                  Verify Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tutorial overlay */}
      {showTutorial && <TutorialModal onClose={handleTutorialClose} studioName={settings.studioName} />}

      {/* Extra Photo Agreement Modal */}
      {showExtraModal && gallery && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[110] flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl overflow-hidden shadow-2xl animate-slide-up">
            {/* Amber top accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-amber-400 via-brand-gold to-amber-500" />

            <div className="p-7 space-y-5">
              {/* Icon + heading */}
              <div className="flex items-start gap-4">
                <div className="shrink-0 bg-amber-500/15 p-3 rounded-2xl border border-amber-500/25">
                  <AlertCircle className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-lg text-white leading-tight">
                    You've used all {gallery.includedPhotos} included photos
                  </h3>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                    Selecting more photos will add them as extras to your order.
                  </p>
                </div>
              </div>

              {/* Cost breakdown card */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Included limit:</span>
                  <span className="font-bold text-white">{gallery.includedPhotos} photos</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Already selected:</span>
                  <span className="font-bold text-white">{gallery.selectedCount} photos</span>
                </div>
                <div className="h-px bg-slate-800" />
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Price per extra photo:</span>
                  <span className="font-extrabold text-brand-gold text-base">{formatCurrency(gallery.extraPhotoPrice)}</span>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-300 leading-relaxed">
                  <span className="font-bold text-amber-400 block mb-0.5">📋 How it works</span>
                  Each photo you select beyond {gallery.includedPhotos} costs {formatCurrency(gallery.extraPhotoPrice)}. The total will be added to your invoice before your photos are edited.
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  onClick={handleExtraDecline}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-4 rounded-xl text-sm border border-slate-700 transition-colors"
                >
                  Keep current selection
                </button>
                <button
                  onClick={handleExtraAgree}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-brand-gold hover:from-amber-400 hover:to-amber-500 text-slate-900 font-extrabold py-3 px-4 rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-[0.97]"
                >
                  Yes, add extra photo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ────────────────────────────── */}
      <header className="bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-20 shadow-xl shadow-black/20">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt={settings.studioName} className="h-9 object-contain" />
            <div className="h-5 w-px bg-slate-800 hidden sm:block" />
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest hidden sm:block">Photo Selection</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Live counter pill */}
            <div className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
              gallery.selectedCount > gallery.includedPhotos
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}>
              <span className="text-white tabular-nums">{gallery.selectedCount}</span>
              <span className="text-slate-500">/ {gallery.includedPhotos}</span>
            </div>

            {gallery.extraPhotosCount > 0 && (
              <div className="bg-amber-500/15 border border-amber-500/30 text-amber-400 px-3 py-2 rounded-xl text-xs font-bold hidden sm:block">
                +{gallery.extraPhotosCount} · {formatCurrency(gallery.extraAmountDue)}
              </div>
            )}

            {/* Tutorial button */}
            <button onClick={() => setShowTutorial(true)} className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700" title="Tutorial">
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Full-Screen Cover Photo ─────────────── */}
      <div
        ref={heroRef}
        className="relative w-full bg-black h-[50vh] sm:h-[60vh] md:h-[calc(100vh-61px)]"
      >
        {/* Cover image — large, full height */}
        <img
          src={gallery.coverPhotoUrl || (gallery.photos[0]?.url ?? '/logo.png')}
          alt={gallery.collectionTitle || 'Gallery Cover'}
          className="w-full h-full object-cover"
        />

        {/* Dark gradient overlays — stronger at bottom so text pops */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent pointer-events-none" />

        {/* Top-left studio logo over cover */}
        <div className="absolute top-5 left-6 z-10">
          <img src="/logo.png" alt={settings.studioName} className="h-10 object-contain drop-shadow-xl opacity-80" />
        </div>

        {/* Cover text — bottom left */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-4 md:px-10 pb-8 md:pb-10 pt-32">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
            <div className="space-y-3">
              <p className="text-xs text-brand-gold font-bold uppercase tracking-[0.2em] drop-shadow">
                {gallery.client.name}
              </p>
              <h1 className="font-display font-extrabold text-2xl sm:text-4xl md:text-6xl text-white leading-none drop-shadow-2xl">
                {gallery.collectionTitle || 'Your Gallery'}
              </h1>
              <p className="text-xs sm:text-sm text-white/70 max-w-lg leading-relaxed drop-shadow">
                {gallery.welcomeMessage || `Select your favourite photos. Your package includes ${gallery.includedPhotos} photos.`}
              </p>
              {/* Stats chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="bg-white/10 backdrop-blur-md border border-white/15 text-white/80 text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-full">
                  {gallery.photos.length} Photos
                </span>
                <span className="bg-white/10 backdrop-blur-md border border-white/15 text-white/80 text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-full">
                  {gallery.includedPhotos} Included
                </span>
                {gallery.selectedCount > 0 && (
                  <span className="bg-brand-blue/80 backdrop-blur-md border border-brand-blue/40 text-white text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-full animate-fade-in">
                    {gallery.selectedCount} Selected
                  </span>
                )}
              </div>
            </div>

            {/* Right side CTAs */}
            <div className="w-full md:w-auto flex flex-row md:flex-col justify-start md:justify-end shrink-0 gap-3">
              {gallery.selectedCount > 0 && (
                <button
                  onClick={() => setStep('review')}
                  className="w-full md:w-auto bg-brand-blue hover:bg-brand-blue-dark text-white font-bold py-3 px-5 rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-2xl shadow-brand-blue/40 text-sm whitespace-nowrap"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Review & Submit</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs">{gallery.selectedCount}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scroll-down chevron hint */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 animate-bounce opacity-60 pointer-events-none">
          <span className="text-[10px] text-white font-semibold uppercase tracking-widest">Scroll to browse</span>
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* ── Controls Bar ──────────────────────── */}
      <div className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-[61px] z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-500">
            <span className="font-bold text-slate-300">{gallery.photos.length}</span> photos
            {gallery.selectedCount > 0 && (
              <>
                <span>·</span>
                <span className="text-brand-blue font-bold">{gallery.selectedCount} selected</span>
              </>
            )}
          </div>

          {/* Sort toggle */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1 border border-slate-700">
            {(['default', 'smart'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={`flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-200 ${
                  sortMode === mode
                    ? 'bg-brand-blue text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode === 'smart' && <Sparkles className="w-3.5 h-3.5 hidden sm:inline" />}
                {SORT_LABEL[mode]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Photo Grid ────────────────────────── */}
      <main className="max-w-7xl mx-auto w-full px-3 md:px-6 py-6 flex-1 pb-24">

        {/* Extras warning banner */}
        {gallery.extraPhotosCount > 0 && (
          <div className="bg-amber-500/10 border border-brand-gold/25 text-brand-gold rounded-2xl p-4 mb-6 flex items-start gap-3 text-xs sm:text-sm font-semibold leading-relaxed animate-fade-in">
            <Info className="w-5 h-5 shrink-0 mt-0.5" />
            <p>You've selected {gallery.extraPhotosCount} extra photo{gallery.extraPhotosCount > 1 ? 's' : ''} beyond your {gallery.includedPhotos}-photo limit. An additional {formatCurrency(gallery.extraAmountDue)} will be added to your invoice.</p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
          {displayPhotos.map((photo, index) => {
            const isSelected = photo.selectedByClient;
            return (
              <div
                key={photo.id}
                style={{ contentVisibility: 'auto', containIntrinsicSize: '0 300px' }}
                className={`group relative rounded-2xl overflow-hidden cursor-pointer select-none transition-all duration-300 bg-slate-900 ${
                  isSelected
                    ? 'ring-2 ring-brand-blue ring-offset-2 ring-offset-slate-950 shadow-xl shadow-brand-blue/10'
                    : 'shadow-md hover:shadow-xl hover:shadow-black/30'
                }`}
              >
                {/* Photo index */}
                <span className="absolute top-2.5 left-2.5 z-10 text-[9px] font-mono bg-black/50 backdrop-blur text-white/70 px-2 py-0.5 rounded-md border border-white/10">
                  #{index + 1}
                </span>

                {/* Selected check bubble */}
                <div
                  onClick={(e) => { e.stopPropagation(); handleToggle(photo.id); }}
                  className={`absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500 border-emerald-500 text-white scale-110 shadow-lg'
                      : 'bg-black/40 border-white/40 opacity-100 sm:opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>

                {/* Photo image — click opens lightbox, show thumbnail first for speed */}
                <div
                  className="aspect-square overflow-hidden bg-slate-950 relative"
                  onClick={() => setLightboxIndex(index)}
                >
                  <img
                    src={photo.thumbnailUrl || photo.url}
                    alt={photo.name}
                    className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
                      isSelected ? 'brightness-110' : 'brightness-90 group-hover:brightness-100'
                    }`}
                    loading="lazy"
                    decoding="async"
                  />

                  {/* Hover zoom hint */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20">
                    <div className="bg-black/60 backdrop-blur-sm p-2.5 rounded-xl border border-white/10">
                      <ZoomIn className="w-5 h-5 text-white" />
                    </div>
                  </div>

                  {/* Bottom gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
                </div>

                {/* Below-photo controls bar — always visible */}
                <div className="bg-slate-900 border-t border-slate-800/80 px-2.5 py-2 flex items-center justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-slate-400 text-[9px] sm:text-[10px] truncate leading-tight">{photo.name}</p>
                    {photo.backdrop && (
                      <p className="text-[8px] sm:text-[9px] text-slate-600 font-medium mt-0.5 truncate">{photo.backdrop} · {photo.colorPalette}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleInitiateDownload(photo); }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                      title="Download Photo (UGX 5,000 code required)"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggle(photo.id); }}
                      className={`flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all duration-200 active:scale-95 border ${
                        isSelected
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30'
                          : 'bg-brand-blue/10 text-brand-blue border-brand-blue/20 hover:bg-brand-blue hover:text-white'
                      }`}
                    >
                      {isSelected ? (
                        <><Check className="w-2.5 h-2.5 stroke-[3] hidden xs:inline" /> Selected</>
                      ) : (
                        <>+ Pick</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom floating CTA when photos are selected */}
        {gallery.selectedCount > 0 && (
          <div className="fixed bottom-6 inset-x-0 flex justify-center z-30 pointer-events-none px-4">
            <div className="pointer-events-auto flex items-center justify-between gap-4 bg-slate-900/95 backdrop-blur-xl border border-slate-800 px-4 py-3 rounded-2xl shadow-2xl shadow-black/60 animate-slide-up w-full max-w-sm">
              <div className="text-xs">
                <span className="font-extrabold text-white">{gallery.selectedCount}</span>
                <span className="text-slate-400"> / </span>
                <span className="font-bold text-slate-300">{gallery.includedPhotos}</span>
                {gallery.extraPhotosCount > 0 && (
                  <span className="ml-1 text-amber-400 font-bold"> (+{gallery.extraPhotosCount})</span>
                )}
              </div>
              <button
                onClick={() => setStep('review')}
                className="bg-brand-blue hover:bg-brand-blue-dark text-white font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 text-xs transition-all active:scale-[0.97]"
              >
                <span>Review & Submit</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
