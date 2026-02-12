import { useState, useEffect, useRef } from 'react';
import { Link2, X, FileUp } from 'lucide-react';

interface AddFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (url: string) => void;
}

export function AddFileModal({ isOpen, onClose, onAdd }: AddFileModalProps) {
  const [fileUrl, setFileUrl] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>('url');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target?.result) {
          setFileUrl(event.target.result as string);
        }
        setIsUploading(false);
      };
      
      reader.onerror = () => {
        alert('Ошибка при загрузке файла');
        setIsUploading(false);
      };
      
      reader.readAsDataURL(file);
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
                disabled={isUploading}
                className="w-full p-6 bg-[#0f0f0f] border-2 border-dashed border-[#2a2a2a] rounded-lg hover:border-[#3a3a3a] hover:bg-[#1a1a1a] transition-all flex flex-col items-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <div className="w-12 h-12 border-4 border-gray-500/30 border-t-gray-400 rounded-full animate-spin" />
                    <div className="text-gray-400 font-mono text-sm">ЗАГРУЗКА...</div>
                  </>
                ) : (
                  <>
                    <FileUp className="w-12 h-12 text-gray-600 group-hover:text-gray-500 transition-colors" />
                    <div className="text-gray-400 font-mono text-sm">НАЖМИТЕ ДЛЯ ЗАГРУЗКИ</div>
                    <div className="text-gray-600 font-mono text-xs">Поддерживаются: изображения, видео, аудио</div>
                  </>
                )}
              </button>
              {fileUrl && !isUploading && (
                <div className="mt-3 p-3 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg">
                  <div className="text-gray-400 font-mono text-xs">✓ Файл загружен и готов к добавлению</div>
                  {fileUrl.startsWith('data:image') && (
                    <img 
                      src={fileUrl} 
                      alt="Preview" 
                      className="mt-2 max-h-32 mx-auto rounded border border-[#3a3a3a]"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          <input 
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,video/*,audio/*"
          />

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg hover:bg-[#3a3a3a] transition-all text-gray-400 font-mono text-sm"
            >
              ОТМЕНА
            </button>
            <button
              onClick={handleConfirm}
              disabled={!fileUrl.trim() || isUploading}
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
