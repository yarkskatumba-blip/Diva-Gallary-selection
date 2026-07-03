import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import {
  ChevronUp,
  ChevronDown,
  X,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  CheckCircle,
  AlertCircle,
  FileText,
  Video,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';

export const UploadManager: React.FC = () => {
  const {
    uploadQueue,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    retryUpload,
    removeCompletedUploads,
    clearActiveUploads
  } = useStore();

  const [isMinimized, setIsMinimized] = useState(false);

  if (uploadQueue.length === 0) return null;

  // Global Statistics
  const totalCount = uploadQueue.length;
  const completedCount = uploadQueue.filter(item => item.status === 'completed').length;
  const failedCount = uploadQueue.filter(item => item.status === 'failed').length;
  const activeQueue = uploadQueue.filter(item => item.status === 'uploading' || item.status === 'processing');
  const waitingCount = uploadQueue.filter(item => item.status === 'waiting').length;

  const totalSize = uploadQueue.reduce((acc, item) => acc + item.size, 0);
  const totalUploadedBytes = uploadQueue.reduce((acc, item) => acc + item.uploadedBytes, 0);
  const overallProgress = totalSize > 0 ? Math.round((totalUploadedBytes / totalSize) * 100) : 0;

  // Speed calculation
  const totalSpeed = activeQueue.reduce((acc, item) => acc + item.speed, 0); // bytes per second

  // Remaining bytes and time
  const remainingBytes = uploadQueue.reduce((acc, item) => {
    if (item.status === 'completed' || item.status === 'failed') return acc;
    return acc + (item.size - item.uploadedBytes);
  }, 0);
  const remainingTime = totalSpeed > 0 ? Math.round(remainingBytes / totalSpeed) : 0;

  const formatSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const formatSpeed = (bytesPerSec: number): string => {
    if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
    return `${bytesPerSec} B/s`;
  };

  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '0s';
    if (seconds >= 3600) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return `${h}h ${m}m`;
    }
    if (seconds >= 60) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}m ${s}s`;
    }
    return `${seconds}s`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-400" />;
    if (mimeType.startsWith('video/')) return <Video className="w-5 h-5 text-purple-400" />;
    return <FileText className="w-5 h-5 text-amber-400" />;
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[100] w-88 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden select-none animate-slide-up flex flex-col max-h-[460px] text-white">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-950/90 px-4 py-3 border-b border-slate-700/50">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-200">
            {activeQueue.length > 0
              ? `Uploading ${activeQueue.length + waitingCount} of ${totalCount} files`
              : `${completedCount} of ${totalCount} uploads complete`}
          </span>
          {activeQueue.length > 0 && (
            <span className="text-[10px] text-slate-400 font-medium">
              {formatSpeed(totalSpeed)} • {formatTime(remainingTime)} remaining
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-slate-450 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={clearActiveUploads}
            className="text-slate-450 hover:text-red-400 p-1 hover:bg-slate-800 rounded-lg transition-colors"
            title="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Global Progress Bar (Always visible even when minimized) */}
      <div className="w-full bg-slate-800 h-1">
        <div
          className={`h-full transition-all duration-300 ${
            activeQueue.length > 0 ? 'bg-brand-blue animate-pulse' : 'bg-emerald-500'
          }`}
          style={{ width: `${overallProgress}%` }}
        />
      </div>

      {/* Minimized Quick Info */}
      {isMinimized && (
        <div className="p-3.5 bg-slate-900/95 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            {activeQueue.length > 0 ? (
              <Loader2 className="w-4 h-4 animate-spin text-brand-blue" />
            ) : failedCount > 0 ? (
              <AlertCircle className="w-4 h-4 text-red-500" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            )}
            <span>{overallProgress}% Complete</span>
          </div>
          <span className="text-slate-400 font-medium text-[11px]">
            {completedCount} saved • {failedCount} failed
          </span>
        </div>
      )}

      {/* Expanded Uploads list */}
      {!isMinimized && (
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 bg-slate-900/90 backdrop-blur-md">
          {/* Header Summary actions */}
          <div className="px-4 py-2 bg-slate-950/40 text-[10px] text-slate-450 font-bold uppercase tracking-wider flex justify-between items-center">
            <span>Progress: {completedCount}/{totalCount} Completed</span>
            <div className="flex gap-2">
              {completedCount > 0 && (
                <button
                  onClick={removeCompletedUploads}
                  className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Clear Done
                </button>
              )}
            </div>
          </div>

          {/* List items */}
          <div className="divide-y divide-slate-800/85">
            {uploadQueue.map(item => (
              <div key={item.id} className="p-3 flex items-start gap-3 hover:bg-slate-800/35 transition-colors group">
                {/* Thumbnail / Icon preview */}
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-750 bg-slate-950 relative flex items-center justify-center">
                  {item.mimeType.startsWith('image/') && item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    getFileIcon(item.mimeType)
                  )}
                  {item.status === 'uploading' && (
                    <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-[10px] font-bold">
                      {item.progress}%
                    </div>
                  )}
                </div>

                {/* Upload details */}
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div className="flex justify-between items-start gap-1">
                    <span className="text-xs font-semibold truncate text-slate-200" title={item.name}>
                      {item.name}
                    </span>
                    
                    {/* Item Controls */}
                    <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                      {item.status === 'uploading' && (
                        <button
                          onClick={() => pauseUpload(item.id)}
                          className="text-slate-400 hover:text-white p-0.5 hover:bg-slate-750 rounded transition-colors"
                          title="Pause Upload"
                        >
                          <Pause className="w-3 h-3" />
                        </button>
                      )}
                      {item.status === 'paused' && (
                        <button
                          onClick={() => resumeUpload(item.id)}
                          className="text-slate-400 hover:text-white p-0.5 hover:bg-slate-750 rounded transition-colors"
                          title="Resume Upload"
                        >
                          <Play className="w-3 h-3" />
                        </button>
                      )}
                      {item.status === 'failed' && (
                        <button
                          onClick={() => retryUpload(item.id)}
                          className="text-slate-400 hover:text-white p-0.5 hover:bg-slate-750 rounded transition-colors"
                          title="Retry Upload"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                      {item.status !== 'completed' && (
                        <button
                          onClick={() => cancelUpload(item.id)}
                          className="text-slate-400 hover:text-red-400 p-0.5 hover:bg-slate-750 rounded transition-colors"
                          title="Cancel Upload"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sizes and Status details */}
                  <div className="text-[10px] text-slate-400 flex items-center gap-2 flex-wrap">
                    <span>{formatSize(item.size)}</span>
                    {item.status === 'uploading' && (
                      <>
                        <span>•</span>
                        <span>{formatSpeed(item.speed)}</span>
                        <span>•</span>
                        <span>{formatTime(item.timeRemaining)} left</span>
                      </>
                    )}
                    {item.status === 'waiting' && (
                      <>
                        <span>•</span>
                        <span className="text-slate-450 uppercase font-bold tracking-wider">Waiting</span>
                      </>
                    )}
                    {item.status === 'paused' && (
                      <>
                        <span>•</span>
                        <span className="text-amber-500 uppercase font-bold tracking-wider">Paused</span>
                      </>
                    )}
                    {item.status === 'processing' && (
                      <>
                        <span>•</span>
                        <span className="text-brand-blue uppercase font-bold tracking-wider flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" /> Processing
                        </span>
                      </>
                    )}
                    {item.status === 'completed' && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-500 uppercase font-bold tracking-wider flex items-center gap-0.5">
                          <CheckCircle className="w-2.5 h-2.5 stroke-[3]" /> Completed
                        </span>
                      </>
                    )}
                    {item.status === 'failed' && (
                      <>
                        <span>•</span>
                        <span className="text-red-500 font-bold uppercase tracking-wider">Failed</span>
                      </>
                    )}
                  </div>

                  {/* Item Progress Bar */}
                  {item.status !== 'completed' && item.status !== 'failed' && (
                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.status === 'paused' ? 'bg-amber-500' : 'bg-brand-blue'
                        }`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Error Message */}
                  {item.status === 'failed' && item.error && (
                    <span className="text-[9px] text-red-400 mt-1 block truncate leading-tight font-medium" title={item.error}>
                      {item.error}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
