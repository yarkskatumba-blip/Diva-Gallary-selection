import React, { useState, useRef } from 'react';
import { useStore } from '../../store/useStore';
import type { Gallery, Photo } from '../../types';
import {
  Plus,
  Link as LinkIcon,
  Copy,
  Check,
  RotateCcw,
  Lock,
  Trash2,
  X,
  Upload,
  CheckCircle,
  Eye
} from 'lucide-react';

export const Galleries: React.FC = () => {
  const {
    galleries,
    clients,
    settings,
    syncing,
    updateGalleryMetadata,
    addFilesToUploadQueue,
    uploadQueue,
    cancelUpload,
    clearActiveUploads,
    updateGalleryStatusInFirestore,
    deleteGalleryFromFirestore
  } = useStore();

  const [currentGalleryId, setCurrentGalleryId] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [collectionTitle, setCollectionTitle] = useState('');
  const [includedPhotos, setIncludedPhotos] = useState(20);
  const [extraPhotoPrice, setExtraPhotoPrice] = useState(10000);
  const [welcomeMessage, setWelcomeMessage] = useState('');

  // Derived state: uploads queue for current gallery
  const queueForGallery = uploadQueue.filter((item) => item.galleryId === currentGalleryId);

  const uploadedPhotos = queueForGallery.map((item) => ({
    id: item.id,
    url: item.downloadUrl || item.thumbnailUrl, // downloadUrl if complete, otherwise objectUrl thumbnail
    name: item.name,
    size: `${(item.size / (1024 * 1024)).toFixed(1)} MB`,
    selectedByClient: false,
    originalName: item.originalName,
    mimeType: item.mimeType,
    sizeBytes: item.size,
    width: item.width,
    height: item.height,
    duration: item.duration,
    storagePath: item.storagePath,
    thumbnailUrl: item.thumbnailUrl
  }));
  
  // Drag-and-Drop states
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  // Selection Explorer States
  const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'selected' | 'unselected'>('all');
  const [sortMode, setSortMode] = useState<'default' | 'selectedFirst' | 'unselectedFirst'>('default');

  const activeGallery = galleries.find((g) => g.id === selectedGalleryId);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency || 'UGX',
      minimumFractionDigits: 0
    }).format(val).replace('$', 'UGX ');
  };

  const getSecureLink = (gallery: Gallery) => {
    const slug = (gallery.collectionTitle || gallery.client.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return `${window.location.origin}/gallery/${gallery.id}/${slug}`;
  };

  const copyToClipboard = (text: string, id: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-HTTPS or incompatible mobile browsers
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!successful) {
          throw new Error('Fallback copy failed');
        }
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy link: ', err);
      window.prompt("Could not copy automatically. Copy this link manually:", text);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const processFiles = (files: FileList) => {
    addFilesToUploadQueue(currentGalleryId, files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const openAddModal = () => {
    const newId = `gal-${Date.now()}`;
    setCurrentGalleryId(newId);
    setClientName('');
    setCollectionTitle('');
    setIncludedPhotos(20);
    setExtraPhotoPrice(10000);
    setWelcomeMessage('');
    setFormError('');
    clearActiveUploads();
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!clientName.trim()) {
      setFormError('Please enter a client name.');
      return;
    }
    if (includedPhotos === undefined || extraPhotoPrice === undefined) {
      setFormError('Included photo count and extra photo price are required.');
      return;
    }
    if (uploadedPhotos.length === 0) {
      setFormError('Please upload photographs for this gallery.');
      return;
    }

    // Check if any photo is still uploading in background
    const isUploadingAny = queueForGallery.some(
      (item) => item.status === 'uploading' || item.status === 'waiting' || item.status === 'processing'
    );
    if (isUploadingAny) {
      setFormError('Please wait for all background uploads to complete before saving.');
      return;
    }

    const existingClient = clients.find(
      (c) => c.name.toLowerCase() === clientName.trim().toLowerCase()
    );

    const client = existingClient || {
      id: `cli-${Date.now()}`,
      name: clientName.trim(),
      email: `${clientName.trim().toLowerCase().replace(/\s+/g, '.')}@example.com`,
      phone: ''
    };

    // Only update metadata (client name, title, settings).
    // The photos array was already built in Firestore by upload completion handlers.
    // Using updateGalleryMetadata (merge) prevents overwriting those photos.
    const completedPhotos = queueForGallery.filter(item => item.status === 'completed');
    const coverPhotoUrl = completedPhotos.length > 0
      ? (completedPhotos[0].downloadUrl || completedPhotos[0].thumbnailUrl || '')
      : '';

    const metadataFields: Partial<import('../../types').Gallery> = {
      id: currentGalleryId,
      client,
      collectionTitle: collectionTitle || undefined,
      coverPhotoUrl,
      includedPhotos,
      extraPhotoPrice,
      welcomeMessage: welcomeMessage || undefined,
      status: 'Draft' as const,
      selectedCount: 0,
      submittedAt: null,
      extraPhotosCount: 0,
      extraAmountDue: 0
    };

    updateGalleryMetadata(currentGalleryId, metadataFields)
      .then(() => {
        setIsModalOpen(false);
        clearActiveUploads();
      })
      .catch((err) => {
        // Fallback: if Firestore write failed, ensure local state has the gallery
        setFormError(`Gallery saved locally only (Firebase error: ${err.message || err})`);
        setIsModalOpen(false);
        clearActiveUploads();
      });
  };

  const handleGenerateLink = (id: string) => {
    updateGalleryStatusInFirestore(id, 'Link Generated');
  };

  const handleStartSelecting = (id: string) => {
    updateGalleryStatusInFirestore(id, 'Client Selecting');
  };

  const getProcessedPhotos = (photos: Photo[]) => {
    let processed = [...photos];

    // Filter
    if (filterMode === 'selected') {
      processed = processed.filter((p) => p.selectedByClient);
    } else if (filterMode === 'unselected') {
      processed = processed.filter((p) => !p.selectedByClient);
    }

    // Sort
    if (sortMode === 'selectedFirst') {
      processed.sort((a, b) => {
        if (a.selectedByClient && !b.selectedByClient) return -1;
        if (!a.selectedByClient && b.selectedByClient) return 1;
        return 0;
      });
    } else if (sortMode === 'unselectedFirst') {
      processed.sort((a, b) => {
        if (!a.selectedByClient && b.selectedByClient) return -1;
        if (a.selectedByClient && !b.selectedByClient) return 1;
        return 0;
      });
    }

    return processed;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display font-extrabold text-2xl tracking-tight text-slate-800 m-0 leading-none">
            Galleries Directory
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Manage photo collections as visual Albums, track submissions, and explore client selections.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-brand-blue hover:bg-brand-blue-dark text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 text-sm active:scale-[0.98] shadow-md shadow-brand-blue/10 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Client Gallery</span>
        </button>
      </div>

      {/* Albums Grid */}
      {galleries.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 py-16 text-center shadow-sm text-slate-450 font-medium">
          No client selection galleries created yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {galleries.map((g) => {
            const coverUrl = g.coverPhotoUrl || (g.photos[0] ? g.photos[0].url : '/logo.png');
            
            return (
              <div
                key={g.id}
                onClick={() => {
                  setSelectedGalleryId(g.id);
                  setFilterMode('all');
                  setSortMode('default');
                }}
                className="group bg-white rounded-3xl border border-slate-150/80 hover:border-brand-blue/30 overflow-hidden hover:shadow-xl hover:shadow-slate-100 transition-all duration-300 cursor-pointer flex flex-col relative"
              >
                {/* Cover Image Area */}
                <div className="aspect-[4/3] bg-slate-900 relative overflow-hidden">
                  <img
                    src={coverUrl}
                    alt={g.collectionTitle || 'Album'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 pointer-events-none" />
                  
                  {/* Status Badge */}
                  <span
                    className={`absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider shadow-sm uppercase ${
                      g.status === 'Submitted'
                        ? 'bg-emerald-500 text-white'
                        : g.status === 'Client Selecting'
                        ? 'bg-brand-blue text-white'
                        : g.status === 'Reopened'
                        ? 'bg-purple-600 text-white'
                        : g.status === 'Link Generated'
                        ? 'bg-amber-500 text-white'
                        : g.status === 'Closed'
                        ? 'bg-slate-500 text-white'
                        : 'bg-slate-400 text-white'
                    }`}
                  >
                    {g.status}
                  </span>

                  {/* Progress Indicator */}
                  <div className="absolute bottom-3 left-3 bg-black/55 backdrop-blur-md px-2.5 py-1 rounded-xl text-white text-[11px] font-semibold">
                    {g.selectedCount} / {g.photos.length} selected
                  </div>
                </div>

                {/* Album Details Info */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-display font-extrabold text-slate-800 text-base leading-tight group-hover:text-brand-blue transition-colors truncate">
                      {g.collectionTitle || 'Untitled Collection'}
                    </h4>
                    <p className="text-sm text-slate-500 font-semibold mt-1">
                      {g.client.name}
                    </p>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-slate-55 text-xs text-slate-400 flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span>Limit:</span>
                      <span className="font-semibold text-slate-600">{g.includedPhotos} photos</span>
                    </div>
                    {g.extraPhotosCount > 0 ? (
                      <div className="flex justify-between text-amber-600 font-bold">
                        <span>Extra:</span>
                        <span>+{g.extraPhotosCount} ({formatCurrency(g.extraAmountDue)})</span>
                      </div>
                    ) : (
                      <div className="flex justify-between">
                        <span>Extra:</span>
                        <span>None</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Album Details / Selection Explorer Modal */}
      {activeGallery && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-6 overflow-hidden">
          <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-display font-extrabold text-lg text-slate-800 m-0">
                    {activeGallery.collectionTitle || 'Untitled Collection'}
                  </h3>
                  <span
                    className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      activeGallery.status === 'Submitted'
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeGallery.status === 'Client Selecting'
                        ? 'bg-blue-100 text-brand-blue'
                        : activeGallery.status === 'Reopened'
                        ? 'bg-purple-100 text-purple-800'
                        : activeGallery.status === 'Link Generated'
                        ? 'bg-amber-100 text-amber-800'
                        : activeGallery.status === 'Closed'
                        ? 'bg-slate-150 text-slate-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {activeGallery.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Client Selection Explorer for <span className="font-bold text-slate-700">{activeGallery.client.name}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedGalleryId(null)}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body split into Sidebar and Main Explorer */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              
              {/* Sidebar */}
              <div className="w-full lg:w-80 border-r border-slate-100 p-6 space-y-6 overflow-y-auto bg-slate-50/30 shrink-0">
                
                {/* Selection Stats */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Selection Summary
                  </h4>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 text-xs text-slate-500 font-medium">
                    <div className="flex justify-between">
                      <span>Total Photos:</span>
                      <span className="font-bold text-slate-800">{activeGallery.photos.length} photos</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Included Limit:</span>
                      <span className="font-bold text-slate-800">{activeGallery.includedPhotos}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Selected Count:</span>
                      <span className="font-extrabold text-brand-blue">{activeGallery.selectedCount}</span>
                    </div>
                    <div className="h-px bg-slate-100" />
                    <div className="flex justify-between">
                      <span>Extra Photos:</span>
                      <span className="font-bold text-slate-800">
                        {activeGallery.extraPhotosCount > 0 ? `+${activeGallery.extraPhotosCount}` : '0'}
                      </span>
                    </div>
                    <div className="flex justify-between text-brand-gold font-bold text-sm pt-1 border-t border-slate-50">
                      <span>Amount Due:</span>
                      <span>{formatCurrency(activeGallery.extraAmountDue)}</span>
                    </div>
                  </div>
                </div>

                {/* Explorer Controls */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Actions
                  </h4>
                  
                  {/* Copy Link */}
                  {activeGallery.status === 'Draft' ? (
                    <button
                      onClick={() => handleGenerateLink(activeGallery.id)}
                      className="w-full bg-brand-blue hover:bg-brand-blue-dark text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <LinkIcon className="w-4 h-4" />
                      <span>Generate Selection Link</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => copyToClipboard(getSecureLink(activeGallery), activeGallery.id)}
                      className="w-full bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2.5 px-4 rounded-xl border border-slate-200 text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {copiedId === activeGallery.id ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      <span>{copiedId === activeGallery.id ? 'Copied Client Link!' : 'Copy Client Link'}</span>
                    </button>
                  )}

                  {/* Open Preview */}
                  {activeGallery.status !== 'Draft' && (
                    <a
                      href={`/gallery/${activeGallery.id}/${(activeGallery.collectionTitle || activeGallery.client.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2.5 px-4 rounded-xl border border-slate-200 text-xs flex items-center justify-center gap-1.5 transition-colors text-center"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Open Live Preview</span>
                    </a>
                  )}

                  {/* Reopen selections */}
                  {activeGallery.status === 'Submitted' && (
                    <button
                      onClick={() => updateGalleryStatusInFirestore(activeGallery.id, 'Reopened')}
                      className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold py-2.5 px-4 rounded-xl border border-purple-200 text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Reopen Selections</span>
                    </button>
                  )}

                  {/* Close Gallery */}
                  {activeGallery.status !== 'Closed' && activeGallery.status !== 'Draft' && (
                    <button
                      onClick={() => updateGalleryStatusInFirestore(activeGallery.id, 'Closed')}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-xl border border-slate-200 text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Close / Lock Gallery</span>
                    </button>
                  )}

                  {/* Start Selecting Status manually */}
                  {activeGallery.status === 'Link Generated' && (
                    <button
                      onClick={() => handleStartSelecting(activeGallery.id)}
                      className="w-full bg-blue-50 hover:bg-blue-100 text-brand-blue font-semibold py-2.5 px-4 rounded-xl border border-blue-200 text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Start Selecting Status</span>
                    </button>
                  )}

                  {/* Delete Gallery */}
                  <button
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete the gallery for "${activeGallery.client.name}"?`)) {
                        deleteGalleryFromFirestore(activeGallery.id);
                        setSelectedGalleryId(null);
                      }
                    }}
                    className="w-full bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-750 font-semibold py-2.5 px-4 rounded-xl border border-red-200 text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Album</span>
                  </button>
                </div>
              </div>

              {/* Photos Explorer Panel */}
              <div className="flex-1 p-6 flex flex-col overflow-hidden">
                
                {/* Filter and Sort Controls Bar */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  
                  {/* Filters */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-bold uppercase tracking-wider mr-1">Filter:</span>
                    <button
                      onClick={() => setFilterMode('all')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all duration-200 ${
                        filterMode === 'all'
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      Show All
                    </button>
                    <button
                      onClick={() => setFilterMode('selected')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all duration-200 ${
                        filterMode === 'selected'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      Selected Only ({activeGallery.photos.filter(p => p.selectedByClient).length})
                    </button>
                    <button
                      onClick={() => setFilterMode('unselected')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all duration-200 ${
                        filterMode === 'unselected'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      Unselected Only ({activeGallery.photos.filter(p => !p.selectedByClient).length})
                    </button>
                  </div>

                  {/* Sorting */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-slate-400 font-bold uppercase tracking-wider mr-1 whitespace-nowrap">Sort:</span>
                    <select
                      value={sortMode}
                      onChange={(e) => setSortMode(e.target.value as any)}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold focus:outline-none transition-colors w-full sm:w-auto"
                    >
                      <option value="default">Default (File Sequence)</option>
                      <option value="selectedFirst">Selected First</option>
                      <option value="unselectedFirst">Unselected First</option>
                    </select>
                  </div>
                </div>

                {/* Photos Grid */}
                <div className="flex-1 overflow-y-auto">
                  {getProcessedPhotos(activeGallery.photos).length === 0 ? (
                    <div className="text-center py-16 text-slate-400 font-semibold">
                      No proofs match the selected filters.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {getProcessedPhotos(activeGallery.photos).map((photo) => (
                        <div
                          key={photo.id}
                          className={`group bg-slate-50 border rounded-2xl overflow-hidden relative select-none transition-all duration-200 ${
                            photo.selectedByClient ? 'border-emerald-500/45 shadow-sm ring-1 ring-emerald-500/20' : 'border-slate-150'
                          }`}
                        >
                          <div className="aspect-square bg-slate-900 overflow-hidden relative">
                            <img
                              src={photo.url}
                              alt={photo.name}
                              className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                              loading="lazy"
                            />
                            
                            {/* Selected Check overlay */}
                            {photo.selectedByClient && (
                              <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1 shadow-md border border-white/20">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            )}
                          </div>

                          <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="font-mono text-slate-500 truncate max-w-[120px]" title={photo.name}>
                              {photo.name}
                            </span>
                            <span className="text-slate-400 font-medium">{photo.size}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* Add Gallery Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-scale-up">
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100">
              <h3 className="font-display font-bold text-lg text-slate-800">
                Create Selection Gallery
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {formError && (
                <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-xl border border-red-100">
                  {formError}
                </div>
              )}

              {/* Client Name Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Client Name
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Mercy Nabosa"
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-blue rounded-xl text-sm placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>

              {/* Collection Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Collection Title
                </label>
                <input
                  type="text"
                  value={collectionTitle}
                  onChange={(e) => setCollectionTitle(e.target.value)}
                  placeholder="e.g. Graduation Shoot, Wedding Gallery"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-blue rounded-xl text-sm placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>



              {/* Included and Overage pricing inputs in 2 columns */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Included Photos Limit
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={includedPhotos}
                    onChange={(e) => setIncludedPhotos(parseInt(e.target.value) || 0)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-blue rounded-xl text-sm focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Extra Photo Price (UGX)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={extraPhotoPrice}
                    onChange={(e) => setExtraPhotoPrice(parseInt(e.target.value) || 0)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-blue rounded-xl text-sm focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Welcome Message */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Welcome Message (optional)
                </label>
                <textarea
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  placeholder="e.g. Please select your favorite photos from your gallery."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-blue rounded-xl text-sm placeholder-slate-400 focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Simulated Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Upload Photos
                </label>

                {/* Hidden File Input */}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />

                {uploadedPhotos.length > 0 ? (
                  <div className="space-y-3">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">
                            {uploadedPhotos.length} photos ready
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            Device file gallery loaded successfully
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={triggerFileInput}
                          className="text-xs text-brand-blue hover:text-brand-blue-dark font-semibold bg-white border border-slate-200 py-1.5 px-3 rounded-lg transition-colors"
                        >
                          Add More
                        </button>
                        <button
                          type="button"
                          onClick={clearActiveUploads}
                          className="text-xs text-slate-400 hover:text-red-500 font-semibold bg-white border border-slate-200 hover:border-red-100 py-1.5 px-3 rounded-lg transition-colors"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    {/* Previews Strip */}
                    <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none max-w-full">
                      {uploadedPhotos.map((photo) => {
                        const uploadStatus = queueForGallery.find((item) => item.id === photo.id);
                        return (
                          <div key={photo.id} className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-slate-950">
                            <img src={photo.url} alt="" className="w-full h-full object-cover" />
                            {uploadStatus && (uploadStatus.status === 'uploading' || uploadStatus.status === 'waiting' || uploadStatus.status === 'processing') && (
                              <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center text-[9px] font-bold text-white leading-tight">
                                {uploadStatus.status === 'waiting' ? (
                                  <span>Wait</span>
                                ) : uploadStatus.status === 'processing' ? (
                                  <span className="animate-pulse">Proc</span>
                                ) : (
                                  <span>{uploadStatus.progress}%</span>
                                )}
                              </div>
                            )}
                            {uploadStatus && uploadStatus.status === 'completed' && (
                              <div className="absolute top-0.5 left-0.5 bg-emerald-500 text-white rounded-full p-0.5 shadow z-10">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                            )}
                            {uploadStatus && uploadStatus.status === 'failed' && (
                              <div className="absolute inset-0 bg-red-650/80 flex items-center justify-center text-[9px] font-bold text-white">
                                Fail
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => cancelUpload(photo.id)}
                              className="absolute -top-1 -right-1 bg-black/75 hover:bg-red-500 text-white rounded-full p-0.5 z-10 shadow"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={triggerFileInput}
                    className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all duration-200 ${
                      isDragActive
                        ? 'border-brand-blue bg-blue-50/20'
                        : 'border-slate-300 hover:border-brand-blue hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 text-slate-450 mx-auto" />
                      <div className="text-sm font-bold text-slate-700">
                        {isDragActive ? 'Drop your photos here!' : 'Drag files here or click to upload'}
                      </div>
                      <p className="text-xs text-slate-400 font-medium">
                        Supports JPEG, PNG, WEBP from your local device
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={syncing || queueForGallery.some(item => item.status === 'uploading' || item.status === 'waiting' || item.status === 'processing')}
                  className="flex-1 bg-brand-blue hover:bg-brand-blue-dark disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors shadow-md shadow-brand-blue/10 flex items-center justify-center gap-2"
                >
                  {syncing ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    'Save Gallery'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
