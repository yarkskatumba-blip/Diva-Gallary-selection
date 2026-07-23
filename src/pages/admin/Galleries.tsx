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
  Eye,
  Loader2,
  Key,
  RefreshCw,
  FileDown,
  FileText
} from 'lucide-react';
import { db, withRetry } from '../../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import {
  uploadPhotoSmart,
  validateImageFile
} from '../../services/cloudinary';
import { generateBlurPlaceholder } from '../../utils/image';

/* ─── Export Helpers ──────────────────────────────────────────────────────── */

function downloadSelectionAsExcel(gallery: Gallery) {
  const selected = gallery.photos.filter((p) => p.selectedByClient);
  const clientName = gallery.client.name;
  const title = gallery.collectionTitle || 'Gallery';
  const date = gallery.submittedAt ? new Date(gallery.submittedAt).toLocaleDateString() : new Date().toLocaleDateString();

  const rows: string[] = [
    ['Diva Shots Studios — Selected Photos Report'].join(','),
    [''].join(','),
    [`Client: ${clientName}`, `Collection: ${title}`, `Date: ${date}`].join(','),
    [`Total Selected: ${selected.length}`, `Included Limit: ${gallery.includedPhotos}`, `Extra Photos: ${gallery.extraPhotosCount}`].join(','),
    [''].join(','),
    ['#', 'File Name', 'Original Name', 'Status'].join(','),
    ...selected.map((p, i) =>
      [i + 1, `"${p.name || ''}"`, `"${p.originalName || p.name || ''}"`, 'Selected'].join(',')
    )
  ];

  const csvContent = rows.join('\n');
  const bom = '\uFEFF'; // UTF-8 BOM for Excel
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${clientName.replace(/\s+/g, '_')}_${title.replace(/\s+/g, '_')}_Selection.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadSelectionAsPDF(gallery: Gallery) {
  const selected = gallery.photos.filter((p) => p.selectedByClient);
  const clientName = gallery.client.name;
  const title = gallery.collectionTitle || 'Gallery';
  const date = gallery.submittedAt ? new Date(gallery.submittedAt).toLocaleDateString() : new Date().toLocaleDateString();

  // Build HTML for the printable PDF
  const rows = selected.map((p, i) =>
    `<tr style="background:${i % 2 === 0 ? '#f9fafb' : '#ffffff'}">
      <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#6b7280;font-size:12px">${i + 1}</td>
      <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;font-family:monospace">${p.name || ''}</td>
      <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px">${p.originalName || p.name || ''}</td>
      <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center"><span style="background:#dcfce7;color:#16a34a;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700">Selected</span></td>
    </tr>`
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Selection Report — ${clientName}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;padding:40px}@media print{body{padding:20px}}</style>
  </head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f59e0b;padding-bottom:20px;margin-bottom:24px">
    <div>
      <h1 style="font-size:22px;font-weight:800;color:#0f172a">Diva Shots Studios</h1>
      <p style="color:#64748b;font-size:13px;margin-top:4px">Selected Photos Report</p>
    </div>
    <div style="text-align:right;font-size:12px;color:#64748b">
      <p>Date: <strong>${date}</strong></p>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:28px">
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px">
      <p style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Client</p>
      <p style="font-size:16px;font-weight:800;color:#0f172a;margin-top:4px">${clientName}</p>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px">
      <p style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Collection</p>
      <p style="font-size:16px;font-weight:800;color:#0f172a;margin-top:4px">${title}</p>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px">
      <p style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Total Selected</p>
      <p style="font-size:16px;font-weight:800;color:#2563eb;margin-top:4px">${selected.length} photos</p>
    </div>
  </div>
  ${gallery.extraPhotosCount > 0 ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px">
    <strong style="color:#b45309">Extra Photos:</strong> ${gallery.extraPhotosCount} extra photo${gallery.extraPhotosCount > 1 ? 's' : ''} beyond the ${gallery.includedPhotos}-photo limit.
    <strong style="color:#b45309">Amount Due: UGX ${gallery.extraAmountDue.toLocaleString()}</strong>
  </div>` : ''}
  <table style="width:100%;border-collapse:collapse;margin-top:8px">
    <thead><tr style="background:#1e293b">
      <th style="padding:10px 12px;border:1px solid #334155;color:#94a3b8;font-size:11px;text-align:left;width:50px">#</th>
      <th style="padding:10px 12px;border:1px solid #334155;color:#94a3b8;font-size:11px;text-align:left">File Name</th>
      <th style="padding:10px 12px;border:1px solid #334155;color:#94a3b8;font-size:11px;text-align:left">Original Name</th>
      <th style="padding:10px 12px;border:1px solid #334155;color:#94a3b8;font-size:11px;text-align:center;width:100px">Status</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between">
    <span>Diva Shots Studios — Confidential</span>
    <span>Generated on ${new Date().toLocaleString()}</span>
  </div>
  </body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.onload = () => {
      setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 500);
    };
  } else {
    // Fallback: download HTML file
    const a = document.createElement('a');
    a.href = url;
    a.download = `${clientName.replace(/\s+/g, '_')}_${title.replace(/\s+/g, '_')}_Selection.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const Galleries: React.FC = () => {
  const {
    galleries,
    clients,
    settings,
    uploadAndAddGallery,
    updateGallery,
    updateGalleryStatusInFirestore,
    deleteGalleryFromFirestore
  } = useStore();

  const handleRegenerateCode = async (id: string) => {
    const newCode = `DIVA-${Math.floor(1000 + Math.random() * 9000)}`;
    const targetGallery = galleries.find((g) => g.id === id);
    if (targetGallery) {
      updateGallery({ ...targetGallery, downloadCode: newCode });
      try {
        await withRetry(() => updateDoc(doc(db, 'galleries', id), { downloadCode: newCode }));
      } catch (err) {
        console.warn('[Download Code Update Error]:', err);
      }
    }
  };

  const [currentGalleryId, setCurrentGalleryId] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [collectionTitle, setCollectionTitle] = useState('');
  const [includedPhotos, setIncludedPhotos] = useState(20);
  const [extraPhotoPrice, setExtraPhotoPrice] = useState(10000);
  const [welcomeMessage, setWelcomeMessage] = useState('');

  // Local state for selecting files and displaying previews before upload
  const [localPhotos, setLocalPhotos] = useState<Photo[]>([]);
  const [localFilesMap, setLocalFilesMap] = useState<Map<string, File>>(new Map());
  const [uploadProgressMap, setUploadProgressMap] = useState<Record<string, { progress: number; status: 'compressing' | 'uploading' | 'processing' | 'completed' | 'failed' }>>({});

  // Drag-and-Drop states
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
    
    const base = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'https://diva-selection.web.app'
      : window.location.origin;

    return `${base}/gallery/${gallery.id}/${slug}`;
  };

  const copyToClipboard = (text: string, id: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-HTTPS or incompatible mobile browsers
        const textContent = text;
        const textArea = document.createElement("textarea");
        textArea.value = textContent;
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

  const processFiles = (files: FileList | File[]) => {
    const fileList = Array.from(files);
    const newPhotos: Photo[] = [];
    const newFilesMap = new Map(localFilesMap);

    fileList.forEach((file) => {
      // Check for duplicates locally
      const isDuplicate = localPhotos.some(
        (p) => p.name === file.name && p.sizeBytes === file.size
      );
      if (isDuplicate) {
        console.warn(`File ${file.name} is already added.`);
        return;
      }

      const tempId = `pic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const localUrl = file.type.startsWith('image/') 
        ? URL.createObjectURL(file) 
        : '/logo.png';

      const photo: Photo = {
        id: tempId,
        url: localUrl,
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        selectedByClient: false,
        originalName: file.name,
        mimeType: file.type || 'image/jpeg',
        sizeBytes: file.size,
        width: null,
        height: null,
        duration: null,
        thumbnailUrl: localUrl,
        uploadedAt: new Date().toISOString(),
        galleryId: currentGalleryId
      };

      newPhotos.push(photo);
      newFilesMap.set(tempId, file);

      // Immediately trigger direct Cloudinary upload with percentage tracking & dynamic URLs
      (async () => {
        try {
          try {
            validateImageFile(file);
          } catch (valErr: any) {
            setFormError(valErr?.message || 'Unsupported file format');
            setUploadProgressMap((prev) => ({ ...prev, [tempId]: { progress: 0, status: 'completed' } }));
            return;
          }

          setUploadProgressMap((prev) => ({ ...prev, [tempId]: { progress: 0, status: 'uploading' } }));

          const uRes = await uploadPhotoSmart(
            currentGalleryId,
            tempId,
            file,
            (info) => {
              setUploadProgressMap((prev) => ({
                ...prev,
                [tempId]: { progress: info.percent, status: info.status }
              }));
            }
          );

          let blurDataUrl = '';
          try {
            blurDataUrl = await generateBlurPlaceholder(file);
          } catch (bErr) {
            console.warn('[Blur Placeholder Fallback]:', bErr);
          }

          setUploadProgressMap((prev) => ({ ...prev, [tempId]: { progress: 100, status: 'completed' } }));

          setLocalPhotos((prev) =>
            prev.map((p) =>
              p.id === tempId
                ? {
                    ...p,
                    url: uRes.url,
                    cloudinaryPublicId: uRes.publicId,
                    thumbnailUrl: uRes.thumbnailUrl || uRes.url,
                    previewUrl: uRes.previewUrl || uRes.url,
                    width: uRes.width || null,
                    height: uRes.height || null,
                    sizeBytes: uRes.bytes || file.size,
                    blurDataUrl
                  }
                : p
            )
          );
        } catch (uErr: any) {
          console.error(`[Upload Failed for ${file.name}]:`, uErr);
          setFormError(`Upload failed for ${file.name}: ${uErr?.message || String(uErr)}`);
          setUploadProgressMap((prev) => ({ ...prev, [tempId]: { progress: 0, status: 'completed' } }));
        }
      })();
    });

    setLocalPhotos((prev) => [...prev, ...newPhotos]);
    setLocalFilesMap(newFilesMap);
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

  const handleRemovePhoto = (photoId: string) => {
    const photo = localPhotos.find((p) => p.id === photoId);
    if (photo && photo.url.startsWith('blob:')) {
      URL.revokeObjectURL(photo.url);
    }
    setLocalPhotos((prev) => prev.filter((p) => p.id !== photoId));
    const newFilesMap = new Map(localFilesMap);
    newFilesMap.delete(photoId);
    setLocalFilesMap(newFilesMap);
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
    
    // Revoke old object URLs
    localPhotos.forEach((photo) => {
      if (photo.url.startsWith('blob:')) {
        URL.revokeObjectURL(photo.url);
      }
    });
    setLocalPhotos([]);
    setLocalFilesMap(new Map());
    setIsSaving(false);
    setIsModalOpen(true);
  };

  const handleCancelModal = () => {
    // Revoke object URLs
    localPhotos.forEach((photo) => {
      if (photo.url.startsWith('blob:')) {
        URL.revokeObjectURL(photo.url);
      }
    });
    setLocalPhotos([]);
    setLocalFilesMap(new Map());
    setIsSaving(false);
    setIsModalOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setFormError('');

    if (!clientName.trim()) {
      setFormError('Please enter a client name.');
      setIsSaving(false);
      return;
    }
    if (includedPhotos === undefined || extraPhotoPrice === undefined) {
      setFormError('Included photo count and extra photo price are required.');
      setIsSaving(false);
      return;
    }
    if (localPhotos.length === 0) {
      setFormError('Please upload photographs for this gallery.');
      setIsSaving(false);
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

    const newGallery: Gallery = {
      id: currentGalleryId,
      client,
      collectionTitle: collectionTitle || undefined,
      coverPhotoUrl: '',
      downloadCode: `DIVA-${Math.floor(1000 + Math.random() * 9000)}`,
      includedPhotos,
      extraPhotoPrice,
      welcomeMessage: welcomeMessage || undefined,
      status: 'Draft' as const,
      photos: localPhotos.map(p => ({
        id: p.id,
        url: p.url,
        name: p.name,
        size: p.size,
        selectedByClient: false,
        originalName: p.originalName,
        mimeType: p.mimeType,
        sizeBytes: p.sizeBytes,
        width: p.width,
        height: p.height,
        duration: p.duration,
        galleryId: p.galleryId,
        thumbnailUrl: p.thumbnailUrl
      })),
      selectedCount: 0,
      submittedAt: null,
      extraPhotosCount: 0,
      extraAmountDue: 0
    };

    // Start parallel upload in background
    uploadAndAddGallery(newGallery, localFilesMap)
      .catch((err) => {
        console.error('[Background Upload Failed]:', err);
      });

    // Close modal immediately and clear states
    setIsModalOpen(false);
    setLocalPhotos([]);
    setLocalFilesMap(new Map());
    setIsSaving(false);
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
                  {/* Download Code Card */}
                  <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-2.5 shadow-sm border border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-brand-gold" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Client Download Code</span>
                      </div>
                      <span className="text-[10px] bg-brand-gold/20 text-brand-gold font-mono font-bold px-2 py-0.5 rounded-md">
                        UGX 5,000 / photo
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-800/80 p-2.5 rounded-xl border border-slate-700 font-mono text-sm tracking-widest text-brand-gold font-bold">
                      <span>{activeGallery.downloadCode || 'DIVA-8492'}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyToClipboard(activeGallery.downloadCode || 'DIVA-8492', `code-${activeGallery.id}`)}
                          className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
                          title="Copy Download Code"
                        >
                          {copiedId === `code-${activeGallery.id}` ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleRegenerateCode(activeGallery.id)}
                          className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-amber-300 transition-colors"
                          title="Regenerate Download Code"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

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

                  {/* Export Selected Photos — Excel & PDF */}
                  {activeGallery.selectedCount > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Export Selection List</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => downloadSelectionAsExcel(activeGallery)}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>Excel</span>
                        </button>
                        <button
                          onClick={() => downloadSelectionAsPDF(activeGallery)}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>
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
                      {getProcessedPhotos(activeGallery.photos).map((photo) => {
                        const statusInfo = uploadProgressMap[photo.id] || {
                          progress: photo.url?.startsWith('http') ? 100 : 0,
                          status: photo.url?.startsWith('http') ? 'completed' : 'uploading'
                        };
                        const isUploaded = photo.url && photo.url.startsWith('http');
                        const isProcessing = statusInfo.status === 'processing';
                        const progressPct = Math.min(100, Math.max(0, statusInfo.progress || 0));

                        return (
                          <div
                            key={photo.id}
                            className={`group bg-slate-50 border rounded-2xl overflow-hidden relative select-none transition-all duration-200 ${
                              photo.selectedByClient ? 'border-emerald-500/45 shadow-sm ring-1 ring-emerald-500/20' : 'border-slate-150'
                            }`}
                          >
                            <div className="aspect-square bg-slate-900 overflow-hidden relative">
                              <img
                                src={photo.thumbnailUrl || photo.url}
                                alt={photo.name}
                                className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                                loading="lazy"
                              />
                              
                              {/* Pixieset-style Circular Upload Progress / Processing Overlay */}
                              {!isUploaded && (
                                isProcessing ? (
                                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1 z-10">
                                    <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                                    <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Processing</span>
                                  </div>
                                ) : (
                                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1 z-10">
                                    <div className="relative w-9 h-9 flex items-center justify-center">
                                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                        <path
                                          className="text-white/20"
                                          strokeWidth="3.5"
                                          stroke="currentColor"
                                          fill="none"
                                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                        <path
                                          className="text-brand-blue"
                                          strokeDasharray={`${progressPct}, 100`}
                                          strokeWidth="3.5"
                                          strokeLinecap="round"
                                          stroke="currentColor"
                                          fill="none"
                                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                      </svg>
                                      <span className="absolute text-[9px] font-extrabold text-white">{progressPct}%</span>
                                    </div>
                                  </div>
                                )
                              )}

                              {isUploaded && (
                                <div className="absolute top-2 left-2 bg-emerald-500/90 text-white rounded-full p-1 flex items-center shadow-md backdrop-blur-sm" title="Uploaded to Cloud Storage">
                                  <CheckCircle className="w-3.5 h-3.5 text-white" />
                                </div>
                              )}

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
                        );
                      })}
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
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-scale-up relative">

            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100">
              <h3 className="font-display font-bold text-lg text-slate-800">
                Create Selection Gallery
              </h3>
              <button
                onClick={handleCancelModal}
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

              {/* Image Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Select Photos
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

                {localPhotos.length > 0 ? (
                  <div className="space-y-3">
                    {(() => {
                      const uploadedCount = localPhotos.filter((p) => p.url && p.url.startsWith('http')).length;
                      const isAllUploaded = localPhotos.length > 0 && uploadedCount === localPhotos.length;
                      const overallPct = Math.round((uploadedCount / localPhotos.length) * 100);

                      return (
                        <div className={`p-4 rounded-2xl border transition-all ${
                          isAllUploaded
                            ? 'bg-emerald-50/80 border-emerald-200'
                            : 'bg-blue-50/80 border-blue-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl ${
                                isAllUploaded ? 'bg-emerald-500 text-white' : 'bg-brand-blue text-white animate-pulse'
                              }`}>
                                {isAllUploaded ? (
                                  <CheckCircle className="w-5 h-5" />
                                ) : (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                )}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                  {isAllUploaded ? (
                                    <span className="text-emerald-900">All {localPhotos.length} photos uploaded to Cloudinary</span>
                                  ) : (
                                    <span className="text-blue-900">Uploading to Cloudinary: {uploadedCount} of {localPhotos.length} complete ({overallPct}%)</span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-600 font-medium">
                                  {isAllUploaded
                                    ? 'All image URLs & metadata confirmed. Ready to save gallery.'
                                    : 'Please wait for uploads to complete before saving.'}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={triggerFileInput}
                                className="text-xs text-brand-blue hover:text-brand-blue-dark font-semibold bg-white border border-slate-200 py-1.5 px-3 rounded-xl transition-colors shadow-sm"
                              >
                                Add More
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  localPhotos.forEach((p) => {
                                    if (p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
                                  });
                                  setLocalPhotos([]);
                                  setLocalFilesMap(new Map());
                                }}
                                className="text-xs text-slate-400 hover:text-red-500 font-semibold bg-white border border-slate-200 hover:border-red-100 py-1.5 px-3 rounded-xl transition-colors shadow-sm"
                              >
                                Clear All
                              </button>
                            </div>
                          </div>

                          {!isAllUploaded && (
                            <div className="w-full bg-blue-200/60 h-2 rounded-full overflow-hidden mt-3">
                              <div
                                className="bg-brand-blue h-full rounded-full transition-all duration-300"
                                style={{ width: `${overallPct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Previews Strip */}
                    <div className="flex gap-2.5 overflow-x-auto py-2 scrollbar-none max-w-full">
                      {localPhotos.map((photo) => {
                        const statusInfo = uploadProgressMap[photo.id] || {
                          progress: photo.url?.startsWith('http') ? 100 : 0,
                          status: photo.url?.startsWith('http') ? 'completed' : 'uploading'
                        };
                        const isUploaded = photo.url && photo.url.startsWith('http');
                        const isCompressing = statusInfo.status === 'compressing';
                        const isProcessing = statusInfo.status === 'processing';
                        const progressPct = Math.min(100, Math.max(0, statusInfo.progress || 0));

                        return (
                          <div key={photo.id} className="relative w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-slate-200 bg-slate-950 shadow-sm group">
                            <img src={photo.thumbnailUrl || photo.url} alt="" className="w-full h-full object-cover" />
                            
                            {/* Overlay Statuses */}
                            {!isUploaded && (
                              isCompressing ? (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center pointer-events-none z-10 text-amber-300">
                                  <Loader2 className="w-4 h-4 animate-spin mb-0.5" />
                                  <span className="text-[7px] font-bold">Optimizing</span>
                                </div>
                              ) : isProcessing ? (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center pointer-events-none z-10 text-purple-300">
                                  <Loader2 className="w-4 h-4 animate-spin mb-0.5" />
                                  <span className="text-[7px] font-bold">Processing</span>
                                </div>
                              ) : (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-10">
                                  <div className="relative w-8 h-8 flex items-center justify-center">
                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                      <path
                                        className="text-white/20"
                                        strokeWidth="4"
                                        stroke="currentColor"
                                        fill="none"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                      />
                                      <path
                                        className="text-brand-blue"
                                        strokeDasharray={`${progressPct}, 100`}
                                        strokeWidth="4"
                                        strokeLinecap="round"
                                        stroke="currentColor"
                                        fill="none"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                      />
                                    </svg>
                                    <span className="absolute text-[8px] font-extrabold text-white">{progressPct}%</span>
                                  </div>
                                </div>
                              )
                            )}

                            {isUploaded && (
                              <div className="absolute bottom-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow z-10">
                                <CheckCircle className="w-3.5 h-3.5 text-white" />
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(photo.id)}
                              className="absolute -top-1 -right-1 bg-black/80 hover:bg-red-500 text-white rounded-full p-0.5 z-20 shadow transition-colors"
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
                      <p className="text-xs text-slate-450 font-medium">
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
                  onClick={handleCancelModal}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-brand-blue hover:bg-brand-blue-dark disabled:bg-slate-350 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors shadow-md shadow-brand-blue/10 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    'Saving...'
                  ) : localPhotos.length > 0 && localPhotos.filter((p) => p.url && p.url.startsWith('http')).length < localPhotos.length ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Uploading ({localPhotos.filter((p) => p.url && p.url.startsWith('http')).length}/{localPhotos.length})...</span>
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
