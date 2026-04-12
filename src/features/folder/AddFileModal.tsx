import { useState, useEffect, useRef } from 'react';
import { Link2, X, FileUp } from 'lucide-react';

interface AddFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (url: string) => void;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  pending: boolean;
}

export function AddFileModal({ isOpen, onClose, onAdd }: AddFileModalProps) {
  const [fileUrl, setFileUrl] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>('url');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_PARALLEL_UPLOADS = 10;

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && uploadingFiles.length === 0) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, uploadingFiles.length]);

  const handleConfirm = () => {
    if (fileUrl.trim()) {
      onAdd(fileUrl.trim());
      setFileUrl('');
      onClose();
    }
  };

  const handleLocalUpload = () => {
    fileInputRef.current?.click();
  };

  const processFileQueue = async (files: UploadingFile[]) => {
    const activeFiles = files.filter(f => f.pending);
    const activeUploads = files.filter(f => !f.pending);
    const availableSlots = MAX_PARALLEL_UPLOADS - activeUploads.length;

    if (availableSlots > 0 && activeFiles.length > 0) {
      const filesToProcess = activeFiles.slice(0, availableSlots);

      for (const uploadFile of filesToProcess) {
        setUploadingFiles(prev => 
          prev.map(f => f.id === uploadFile.id ? { ...f, pending: false } : f)
        );

        const reader = new FileReader();
        
        reader.onload = (event) => {
          if (event.target?.result) {
            const result = event.target.result as string;
            onAdd(result);
            setUploadingFiles(prev => prev.filter(f => f.id !== uploadFile.id));
          }
        };
        
        reader.onerror = () => {
          setUploadingFiles(prev => prev.filter(f => f.id !== uploadFile.id));
        };
        
        reader.readAsDataURL(uploadFile.file);
      }
    }
  };

  useEffect(() => {
    if (uploadingFiles.length > 0) {
      processFileQueue(uploadingFiles);
    }
  }, [uploadingFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to MAX_PARALLEL_UPLOADS total
    const remainingSlots = MAX_PARALLEL_UPLOADS - uploadingFiles.length;
    const filesToAdd = files.slice(0, remainingSlots);

    const newUploads: UploadingFile[] = filesToAdd.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      pending: true,
    }));

    setUploadingFiles(prev => [...prev, ...newUploads]);
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
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-[#1a1a1a] border-2 border-[#3a3a3a] rounded-lg w-[min(90vw,480px)] shadow-[0_0_50px_rgba(58,58,58,0.5)] overflow-hidden">
        {/* Title Bar */}
        <div className="bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] h-12 px-4 flex items-center justify-between border-b-2 border-[#3a3a3a]">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></div>
            <span className="text-gray-400 text-sm font-mono tracking-wider">ЗАГРУЗКА ФАЙЛА</span>
          </div>
          <button 
            className="w-8 h-8 bg-red-900/50 border border-red-700 rounded hover:bg-red-800/70 transition-all flex items-center justify-center"
            onClick={onClose}
          >
            <X className="w-5 h-5 text-red-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Method Selector */}
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
              ФАЙЛ
            </button>
          </div>

          {uploadMethod === 'url' ? (
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
          ) : (
            <div>
              <button
                onClick={handleLocalUpload}
                disabled={uploadingFiles.length >= MAX_PARALLEL_UPLOADS}
                className="w-full p-6 bg-[#0f0f0f] border-2 border-dashed border-[#2a2a2a] rounded-lg hover:border-[#3a3a3a] hover:bg-[#1a1a1a] transition-all flex flex-col items-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingFiles.length > 0 ? (
                  <>
                    <div className="w-12 h-12 border-4 border-gray-500/30 border-t-gray-400 rounded-full animate-spin" />
                    <div className="text-gray-400 font-mono text-sm">
                      ЗАГРУЗКА {uploadingFiles.length}/{MAX_PARALLEL_UPLOADS}...
                    </div>
                  </>
                ) : (
                  <>
                    <FileUp className="w-12 h-12 text-gray-600 group-hover:text-gray-500 transition-colors" />
                    <div className="text-gray-400 font-mono text-sm">ВЫБЕРИТЕ ДО {MAX_PARALLEL_UPLOADS} ФАЙЛОВ</div>
                    <div className="text-gray-600 font-mono text-xs">Поддерживаются: изображения, видео, аудио</div>
                  </>
                )}
              </button>
              
              {uploadingFiles.length > 0 && (
                <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                  {uploadingFiles.map(f => (
                    <div key={f.id} className="p-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-xs text-gray-400">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-4 h-4 rounded border border-gray-500 flex items-center justify-center">
                          {f.pending ? '⏳' : '⏬'}
                        </div>
                        <span className="truncate">{f.file.name}</span>
                      </div>
                      <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all" style={{ width: `${f.progress}%` }} />
                      </div>
                    </div>
                  ))}
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
            accept="image/*,video/*,audio/*"
          />

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={uploadingFiles.length > 0}
              className="flex-1 px-4 py-3 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ОТМЕНА
            </button>
            <button
              onClick={handleConfirm}
              disabled={!fileUrl.trim() || uploadingFiles.length > 0}
              className="flex-1 px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg hover:bg-gray-700/70 transition-all text-gray-300 font-mono text-sm disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-gray-700/50"
            >
              ДОБАВИТЬ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
