import { useState, useEffect, useRef, useCallback } from 'react';
import { Link2, X, FileUp, Trash2, Image, Music, Video, CheckCircle, AlertCircle } from 'lucide-react';

interface AddFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (url: string, name?: string) => void;
}

interface QueuedFile {
  id: string;
  index: number;
  file: File;
  preview: string | null;
  name: string;
  size: string;
  type: 'image' | 'video' | 'audio' | 'other';
}

const MAX_QUEUE_SIZE = 20;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
}

function getFileType(file: File): 'image' | 'video' | 'audio' | 'other' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type === 'application/pdf') return 'other';
  return 'other';
}

function getFileIcon(type: QueuedFile['type']) {
  switch (type) {
    case 'image': return <Image className="w-5 h-5" />;
    case 'video': return <Video className="w-5 h-5" />;
    case 'audio': return <Music className="w-5 h-5" />;
    default: return <FileUp className="w-5 h-5" />;
  }
}

export function AddFileModal({ isOpen, onClose, onAdd }: AddFileModalProps) {
  const [fileUrl, setFileUrl] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>('url');
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isProcessing) {
        if (showConfirm) {
          setShowConfirm(false);
        } else if (queuedFiles.length > 0) {
          setQueuedFiles([]);
          setUploadErrors([]);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, isProcessing, showConfirm, queuedFiles.length]);

  // Drag & Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (isProcessing) return;

    const files = Array.from(e.dataTransfer.files);
    addFilesToQueue(files);
  }, [isProcessing]);

  const addFilesToQueue = useCallback((files: File[]) => {
    const remainingSlots = MAX_QUEUE_SIZE - queuedFiles.length;
    const filesToAdd = files.slice(0, remainingSlots);
    const startIndex = queuedFiles.length;

    filesToAdd.forEach((file, idx) => {
      const fileType = getFileType(file);
      const newFile: QueuedFile = {
        id: `queue-${Date.now()}-${idx}-${Math.random()}`,
        index: startIndex + idx,
        file,
        preview: null,
        name: file.name,
        size: formatFileSize(file.size),
        type: fileType,
      };

      // Generate preview for images
      if (fileType === 'image') {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setQueuedFiles(prev =>
              prev.map(f => f.id === newFile.id ? { ...f, preview: event.target!.result as string } : f)
            );
          }
        };
        reader.readAsDataURL(file);
      }

      setQueuedFiles(prev => [...prev, newFile]);
    });

    if (files.length > remainingSlots && remainingSlots > 0) {
      setUploadErrors(prev => [...prev, `Превышен лимит. Добавлено ${remainingSlots} из ${files.length} файлов`]);
    }
  }, [queuedFiles.length]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    addFilesToQueue(files);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const removeFromQueue = (id: string) => {
    setQueuedFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearQueue = () => {
    setQueuedFiles([]);
    setUploadErrors([]);
    setUploadProgress(0);
  };

  const processQueue = async () => {
    if (queuedFiles.length === 0) return;

    setIsProcessing(true);
    setUploadProgress(0);
    setUploadErrors([]);

    const errors: string[] = [];
    let successCount = 0;

    for (let i = 0; i < queuedFiles.length; i++) {
      const queuedFile = queuedFiles[i];
      try {
        const dataUrl = queuedFile.preview || await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(queuedFile.file);
        });

        onAdd(dataUrl, queuedFile.name);
        successCount++;
      } catch {
        errors.push(`Ошибка загрузки: ${queuedFile.name}`);
      }
      setUploadProgress(((i + 1) / queuedFiles.length) * 100);
    }

    setUploadErrors(errors);

    if (errors.length === 0) {
      // All success — close after brief delay
      setTimeout(() => {
        setQueuedFiles([]);
        setUploadProgress(0);
        setShowConfirm(false);
        setIsProcessing(false);
        onClose();
      }, 500);
    } else {
      // Some failed — keep modal open, show errors
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (fileUrl.trim()) {
      onAdd(fileUrl.trim());
      setFileUrl('');
      onClose();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && fileUrl.trim()) {
      handleConfirm();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-[99998]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          if (showConfirm) {
            setShowConfirm(false);
          } else if (queuedFiles.length > 0) {
            clearQueue();
          } else {
            onClose();
          }
        }
      }}
    >
      <div className="bg-[#1a1a1a] border-2 border-[#3a3a3a] rounded-lg w-[min(90vw,560px)] shadow-[0_0_50px_rgba(58,58,58,0.5)] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Title Bar */}
        <div className="bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] h-12 px-4 flex items-center justify-between border-b-2 border-[#3a3a3a] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></div>
            <span className="text-gray-400 text-sm font-mono tracking-wider">
              {showConfirm ? `ПОДТВЕРЖДЕНИЕ — ${queuedFiles.length} ФАЙЛОВ` : 'ЗАГРУЗКА ФАЙЛОВ'}
            </span>
          </div>
          <button
            className="w-8 h-8 bg-red-900/50 border border-red-700 rounded hover:bg-red-800/70 transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => {
              if (showConfirm) {
                setShowConfirm(false);
              } else if (queuedFiles.length > 0) {
                clearQueue();
              } else {
                onClose();
              }
            }}
            disabled={isProcessing}
          >
            <X className="w-5 h-5 text-red-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Method Selector */}
          {!showConfirm && (
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setUploadMethod('url')}
                className={`flex-1 p-3 rounded-lg border-2 transition-all font-mono text-sm flex items-center justify-center gap-2 ${
                  uploadMethod === 'url'
                    ? 'bg-[#2a2a2a] border-[#4a4a4a] text-gray-300'
                    : 'bg-[#0f0f0f] border-[#2a2a2a] text-gray-500 hover:border-[#3a3a3a]'
                }`}
              >
                <Link2 className="w-4 h-4" />
                URL
              </button>
              <button
                onClick={() => setUploadMethod('file')}
                className={`flex-1 p-3 rounded-lg border-2 transition-all font-mono text-sm flex items-center justify-center gap-2 ${
                  uploadMethod === 'file'
                    ? 'bg-[#2a2a2a] border-[#4a4a4a] text-gray-300'
                    : 'bg-[#0f0f0f] border-[#2a2a2a] text-gray-500 hover:border-[#3a3a3a]'
                }`}
              >
                <FileUp className="w-4 h-4" />
                ФАЙЛЫ
              </button>
            </div>
          )}

          {uploadMethod === 'url' && !showConfirm ? (
            <div>
              <label className="block text-gray-500 text-xs font-mono mb-2">ВСТАВЬТЕ URL</label>
              <input
                type="text"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="https://example.com/image.jpg"
                className="w-full p-3 bg-[#0f0f0f] border-2 border-[#2a2a2a] rounded-lg text-gray-400 font-mono text-sm placeholder:text-gray-700 focus:border-[#3a3a3a] focus:outline-none transition-all"
                autoFocus
              />
            </div>
          ) : null}

          {/* File buffer / drop zone */}
          {uploadMethod === 'file' && !showConfirm && (
            <>
              {queuedFiles.length === 0 ? (
                <div
                  ref={dropZoneRef}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full p-10 border-2 border-dashed rounded-lg cursor-pointer transition-all flex flex-col items-center gap-3 group ${
                    isDragOver
                      ? 'border-[#4a9eff] bg-[#4a9eff]/10'
                      : 'border-[#2a2a2a] bg-[#0f0f0f] hover:border-[#3a3a3a] hover:bg-[#1a1a1a]'
                  }`}
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                    isDragOver
                      ? 'bg-[#4a9eff]/20'
                      : 'bg-[#1a1a1a] group-hover:bg-[#2a2a2a]'
                  }`}>
                    <FileUp className={`w-8 h-8 transition-all ${
                      isDragOver ? 'text-[#4a9eff]' : 'text-gray-600 group-hover:text-gray-500'
                    }`} />
                  </div>
                  <div className="text-center">
                    <div className="text-gray-400 font-mono text-sm">
                      {isDragOver ? 'ОТПУСТИТЕ ФАЙЛЫ' : 'ПЕРЕТАЩИТЕ ФАЙЛЫ СЮДА'}
                    </div>
                    <div className="text-gray-600 font-mono text-xs mt-1">
                      или нажмите для выбора • до {MAX_QUEUE_SIZE} файлов
                    </div>
                  </div>
                  <div className="text-gray-700 font-mono text-[10px]">
                    Изображения, видео, аудио
                  </div>
                </div>
              ) : (
                <div>
                  {/* Queue header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-gray-500 text-xs font-mono">
                      В БУФЕРЕ: {queuedFiles.length} / {MAX_QUEUE_SIZE}
                    </div>
                    <button
                      onClick={clearQueue}
                      disabled={isProcessing}
                      className="text-gray-500 hover:text-red-400 text-xs font-mono transition-colors disabled:opacity-30"
                    >
                      ОЧИСТИТЬ
                    </button>
                  </div>

                  {/* File list */}
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {queuedFiles.map((qf, idx) => (
                      <div
                        key={qf.id}
                        className="p-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg flex items-center gap-3 group hover:border-[#3a3a3a] transition-all"
                      >
                        {/* Index */}
                        <div className="w-6 h-6 rounded-full bg-[#1a1a1a] border border-[#3a3a3a] flex items-center justify-center text-[10px] text-gray-500 font-mono flex-shrink-0">
                          {idx + 1}
                        </div>

                        {/* Preview / Icon */}
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0">
                          {qf.preview ? (
                            <img src={qf.preview} alt={qf.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-gray-600">
                              {getFileIcon(qf.type)}
                            </div>
                          )}
                        </div>

                        {/* File info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-gray-400 text-xs font-mono truncate">{qf.name}</div>
                          <div className="text-gray-600 text-[10px] font-mono">{qf.size}</div>
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() => removeFromQueue(qf.id)}
                          disabled={isProcessing}
                          className="w-7 h-7 rounded flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add more button */}
                  {queuedFiles.length < MAX_QUEUE_SIZE && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessing}
                      className="w-full mt-3 p-3 border border-dashed border-[#2a2a2a] rounded-lg text-gray-500 font-mono text-xs hover:border-[#3a3a3a] hover:text-gray-400 transition-all disabled:opacity-30"
                    >
                      + ДОБАВИТЬ ЕЩЁ
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Confirmation screen */}
          {showConfirm && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <div>
                  <div className="text-gray-300 font-mono text-sm">ГОТОВО К ЗАГРУЗКЕ</div>
                  <div className="text-gray-600 text-xs font-mono">{queuedFiles.length} файлов</div>
                </div>
              </div>

              {/* Progress bar */}
              {isProcessing && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 mb-1">
                    <span>ЗАГРУЗКА...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#0f0f0f] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#4a9eff] transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Errors */}
              {uploadErrors.length > 0 && (
                <div className="mb-4 space-y-1">
                  {uploadErrors.map((err, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-mono text-red-400">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {err}
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              {!isProcessing && uploadErrors.length === 0 && queuedFiles.length > 0 && (
                <div className="text-gray-500 text-xs font-mono mb-4">
                  Нажмите «ЗАГРУЗИТЬ» для отправки файлов
                </div>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            multiple
            className="hidden"
            accept="image/*,video/*,audio/*,application/pdf"
          />
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-[#2a2a2a] flex-shrink-0">
          {uploadMethod === 'url' && !showConfirm ? (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-sm"
              >
                ОТМЕНА
              </button>
              <button
                onClick={handleConfirm}
                disabled={!fileUrl.trim()}
                className="flex-1 px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg hover:bg-gray-700/70 transition-all text-gray-300 font-mono text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ДОБАВИТЬ
              </button>
            </div>
          ) : uploadMethod === 'file' && !showConfirm ? (
            <div className="flex gap-3">
              {queuedFiles.length > 0 ? (
                <>
                  <button
                    onClick={clearQueue}
                    disabled={isProcessing}
                    className="flex-1 px-4 py-3 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    ОЧИСТИТЬ
                  </button>
                  <button
                    onClick={() => setShowConfirm(true)}
                    disabled={isProcessing}
                    className="flex-1 px-4 py-3 bg-[#4a9eff]/20 border border-[#4a9eff]/40 rounded-lg hover:bg-[#4a9eff]/30 transition-all text-[#4a9eff] font-mono text-sm disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    ПОДТВЕРДИТЬ ({queuedFiles.length})
                  </button>
                </>
              ) : (
                <button
                  onClick={onClose}
                  className="w-full px-4 py-3 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-sm"
                >
                  ОТМЕНА
                </button>
              )}
            </div>
          ) : showConfirm ? (
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isProcessing}
                className="flex-1 px-4 py-3 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                НАЗАД
              </button>
              <button
                onClick={processQueue}
                disabled={isProcessing}
                className="flex-1 px-4 py-3 bg-[#4a9eff]/30 border border-[#4a9eff]/50 rounded-lg hover:bg-[#4a9eff]/40 transition-all text-[#4a9eff] font-mono text-sm disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#4a9eff]/30 border-t-[#4a9eff] rounded-full animate-spin" />
                    ЗАГРУЗКА...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    ЗАГРУЗИТЬ {queuedFiles.length}
                  </>
                )}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
