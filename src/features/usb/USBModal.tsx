import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { supabase } from '../../shared/lib/supabaseClient';
import { CacheManager } from '../../shared/lib/cache';

interface USBFile {
  id?: string;
  url: string;
  name: string;
  createdAt: string;
}

interface USBFiles {
  photo: USBFile[];
  video: USBFile[];
  audio: USBFile[];
}

interface USBModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFile: (context: 'usb') => void;
}

export function USBModal({ isOpen, onClose, onAddFile }: USBModalProps) {
  const [usbView, setUsbView] = useState<'root' | 'photo' | 'video' | 'audio'>('root');
  const [usbFiles, setUsbFiles] = useState<USBFiles>({
    photo: [],
    video: [],
    audio: []
  });
  const [viewerFile, setViewerFile] = useState<USBFile | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number>(0);
  const [currentType, setCurrentType] = useState<'photo' | 'video' | 'audio' | null>(null);
  const [showLoading, setShowLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  
  const allSoundRef = useRef<HTMLAudioElement>(null);
  const delSoundRef = useRef<HTMLAudioElement>(null);
  const startSoundRef = useRef<HTMLAudioElement>(null);

  const playAllSound = () => {
    if (allSoundRef.current) {
      allSoundRef.current.currentTime = 0;
      allSoundRef.current.play().catch(() => {});
    }
  };

  const playDelSound = () => {
    if (delSoundRef.current) {
      delSoundRef.current.currentTime = 0;
      delSoundRef.current.play().catch(() => {});
    }
  };

  const playStartSound = () => {
    if (startSoundRef.current) {
      startSoundRef.current.currentTime = 0;
      startSoundRef.current.play().catch(() => {});
    }
  };

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (viewerFile) {
          closeViewer();
        } else if (usbView !== 'root') {
          playAllSound();
          setUsbView('root');
        } else {
          playAllSound();
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
  }, [isOpen, onClose, viewerFile, usbView]);

  // Arrow key navigation in viewer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewerFile || !currentType) return;
      
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextFile();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevFile();
      }
    };

    if (viewerFile) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewerFile, currentType, viewerIndex]);

  // Load USB files from Supabase + кеш + realtime подписка
  useEffect(() => {
    if (!supabase) {
      // Пробуем загрузить из кеша если Supabase не настроен
      const cached = CacheManager.get<USBFiles>('usb_files');
      if (cached) {
        setUsbFiles(cached);
      }
      return;
    }

    let isMounted = true;

    const loadUsbFiles = async () => {
      // Сначала загружаем из кеша для мгновенного отображения
      const cached = CacheManager.get<USBFiles>('usb_files');
      if (cached && isMounted) {
        setUsbFiles(cached);
      }

      // Затем загружаем свежие данные из Supabase
      const { data, error } = await supabase
        .from('usb_files')
        .select('id, type, url, name, created_at_label')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to load usb_files from Supabase:', error);
        return;
      }

      if (!isMounted || !data) return;

      const next: USBFiles = { photo: [], video: [], audio: [] };
      for (const row of data) {
        const type = row.type as 'photo' | 'video' | 'audio';
        next[type].push({
          id: row.id as string,
          url: row.url as string,
          name: row.name as string,
          createdAt: (row.created_at_label as string) ?? '',
        });
      }

      setUsbFiles(next);
      // Сохраняем в кеш
      CacheManager.set('usb_files', next, 10 * 60 * 1000); // 10 минут
    };

    loadUsbFiles();

    const channel = supabase
      .channel('usb_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'usb_files' },
        () => loadUsbFiles()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      playStartSound();
      setLoadingText('ЗАГРУЗКА USB...');
      setShowLoading(true);
      setTimeout(() => {
        setShowLoading(false);
      }, 1500);
    }
  }, [isOpen]);

  const detectFileType = (url: string): 'photo' | 'video' | 'audio' => {
    const lower = url.toLowerCase();
    
    if (lower.match(/\.(mp4|webm|mov|avi|mkv|flv|wmv|m4v)$/i) || 
        lower.startsWith('data:video') ||
        lower.includes('youtube.com') ||
        lower.includes('youtu.be') ||
        lower.includes('vimeo.com') ||
        lower.includes('drive.google.com')) {
      return 'video';
    }
    
    if (lower.match(/\.(mp3|wav|ogg|flac|aac|m4a|wma)$/i) || 
        lower.startsWith('data:audio')) {
      return 'audio';
    }
    
    return 'photo';
  };

  const convertToEmbedUrl = (url: string): string => {
    // YouTube
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    
    // Google Drive
    if (url.includes('drive.google.com/file/d/')) {
      const fileId = url.split('/file/d/')[1]?.split('/')[0];
      if (fileId) return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    
    return url;
  };

  const generateAutoName = (type: 'photo' | 'video' | 'audio'): string => {
    const prefix = type === 'photo' ? 'IMG' : type === 'video' ? 'MOV' : 'VID';
    const files = usbFiles[type];
    
    let counter = 1;
    let name = `${prefix}_${String(counter).padStart(4, '0')}`;
    
    while (files.some(f => f.name === name)) {
      counter++;
      name = `${prefix}_${String(counter).padStart(4, '0')}`;
    }
    
    return name;
  };

  const addUSBFile = (url: string) => {
    playAllSound();
    const type = detectFileType(url);
    const embedUrl = convertToEmbedUrl(url);
    
    const autoName = generateAutoName(type);
    const name = prompt('Введите название файла:', autoName) || autoName;
    
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = 2009;
    const createdAt = `${day}.${month}.${year}`;

    const newFile: USBFile = { url: embedUrl, name, createdAt };
    const updated = {
      ...usbFiles,
      [type]: [...usbFiles[type], newFile]
    };

    setUsbFiles(updated);
    // Обновляем кеш
    CacheManager.set('usb_files', updated, 10 * 60 * 1000);

    if (supabase) {
      supabase
        .from('usb_files')
        .insert({
          type,
          url: embedUrl,
          name,
          created_at_label: createdAt,
        })
        .select('id')
        .then(({ data, error }) => {
          if (error) {
            console.error('Failed to insert usb_file into Supabase:', error);
            // Откатываем при ошибке
            setUsbFiles(usbFiles);
            CacheManager.set('usb_files', usbFiles, 10 * 60 * 1000);
            return;
          }

          const insertedId = data?.[0]?.id as string | undefined;
          if (!insertedId) return;

          // Обновляем id только что добавленного файла в состоянии
          setUsbFiles((prev) => {
            const updatedWithId: USBFiles = {
              photo: [...prev.photo],
              video: [...prev.video],
              audio: [...prev.audio],
            };

            const filesOfType = updatedWithId[type];
            const index = filesOfType.findIndex(
              (f) => !f.id && f.url === embedUrl && f.name === name && f.createdAt === createdAt
            );

            if (index !== -1) {
              filesOfType[index] = { ...filesOfType[index], id: insertedId };
            }

            CacheManager.set('usb_files', updatedWithId, 10 * 60 * 1000);
            return updatedWithId;
          });
        });
    }

    setUsbView('root');
  };

  useEffect(() => {
    (window as any).__addUSBFile = addUSBFile;
    return () => {
      delete (window as any).__addUSBFile;
    };
  }, [usbFiles]);

  const openFolder = (folderType: 'photo' | 'video' | 'audio') => {
    playAllSound();
    setLoadingText('ОТКРЫТИЕ ПАПКИ...');
    setShowLoading(true);
    setTimeout(() => {
      setUsbView(folderType);
      setShowLoading(false);
    }, 1200);
  };

  const openViewer = (file: USBFile, index: number, type: 'photo' | 'video' | 'audio') => {
    playAllSound();
    setViewerFile(file);
    setViewerIndex(index);
    setCurrentType(type);
  };

  const closeViewer = () => {
    playAllSound();
    setViewerFile(null);
    setCurrentType(null);
  };

  const deleteFile = () => {
    playDelSound();
    if (!viewerFile || !currentType) return;
    
    const deletedFile = usbFiles[currentType][viewerIndex];
    const newFiles = usbFiles[currentType].filter((_, i) => i !== viewerIndex);
    const updated = {
      ...usbFiles,
      [currentType]: newFiles
    };

    setUsbFiles(updated);
    // Обновляем кеш
    CacheManager.set('usb_files', updated, 10 * 60 * 1000);

    if (supabase && deletedFile) {
      const query = supabase.from('usb_files').delete();

      const deletePromise = deletedFile.id
        ? query.eq('id', deletedFile.id)
        : query.match({
            url: deletedFile.url,
            name: deletedFile.name,
            created_at_label: deletedFile.createdAt,
          });

      deletePromise.then(({ error }) => {
        if (error) {
          console.error('Failed to delete usb_file from Supabase:', error);
          // Откатываем при ошибке
          setUsbFiles(usbFiles);
          CacheManager.set('usb_files', usbFiles, 10 * 60 * 1000);
        }
      });
    }

    if (newFiles.length === 0) {
      closeViewer();
    } else {
      const newIndex = Math.min(viewerIndex, newFiles.length - 1);
      setViewerFile(newFiles[newIndex]);
      setViewerIndex(newIndex);
    }
  };

  const nextFile = () => {
    playAllSound();
    if (!currentType || !viewerFile) return;
    const files = usbFiles[currentType];
    if (viewerIndex < files.length - 1) {
      setViewerIndex(viewerIndex + 1);
      setViewerFile(files[viewerIndex + 1]);
    }
  };

  const prevFile = () => {
    playAllSound();
    if (!currentType || !viewerFile) return;
    if (viewerIndex > 0) {
      setViewerIndex(viewerIndex - 1);
      setViewerFile(usbFiles[currentType][viewerIndex - 1]);
    }
  };

  if (!isOpen) return null;

  const folders = [
    { key: 'photo' as const, title: 'Фотографии', icon: '📷', color: '#4a9eff', count: usbFiles.photo.length },
    { key: 'video' as const, title: 'Видео', icon: '📹', color: '#ff6b6b', count: usbFiles.video.length },
    { key: 'audio' as const, title: 'Музыка', icon: '🎵', color: '#51cf66', count: usbFiles.audio.length }
  ];

  const isVideoEmbed = (url: string) => {
    return url.includes('youtube.com/embed') || url.includes('drive.google.com');
  };

  return (
    <>
      <audio ref={allSoundRef} src="/media/sounds/usb_all.mp3" />
      <audio ref={delSoundRef} src="/media/sounds/usb_del.mp3" />
      <audio ref={startSoundRef} src="/media/sounds/usb_start.mp3" />

      {/* FULLSCREEN MONITOR */}
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="relative w-full h-full flex items-center justify-center">

          {/* Монитор как IMG — правильное масштабирование */}
          <img 
            src="/icons/pc.png"
            className="max-w-full max-h-full object-contain pointer-events-none select-none scale-166"
            alt="monitor"
          />

          {/* USB WINDOW — позиционируется в процентах от монитора */}
          <div
            className="absolute bg-gradient-to-b from-[#e0e0e0] to-[#c0c0c0] rounded-sm overflow-hidden flex flex-col z-[50]"
            style={{
              width: "77%",
              height: "74.5%",
              left: "50%",
              top: "34.1%",
              transform: "translate(-50%, -50%)",
              mixBlendMode: "overlay",
            }}
          >
            {/* Loading overlay */}
            {showLoading && (
              <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-[100]">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 border-4 border-[#c0c0c0] border-t-[#0054e3] rounded-full animate-spin"></div>
                  <div className="text-[#0054e3] font-bold text-xs" style={{ fontFamily: 'Tahoma, sans-serif' }}>
                    {loadingText}
                  </div>
                </div>
              </div>
            )}

            {/* Title bar */}
            <div className="bg-gradient-to-b from-[#0054e3] to-[#0046c7] h-8 px-2 flex items-center justify-between border-b-2 border-[#000080] shadow-[0_2px_0_rgba(255,255,255,0.3)]">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#c0c0c0] border-2 border-[#808080] flex items-center justify-center text-[10px] shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)]">
                  💾
                </div>
                <span className="text-white text-xs font-bold drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)]" style={{ fontFamily: 'Tahoma, sans-serif' }}>
                  USB НАКОПИТЕЛЬ
                </span>
              </div>

              <button 
                className="w-5 h-5 bg-[#c0c0c0] border-2 border-t-white border-l-white border-r-[#404040] border-b-[#404040] flex items-center justify-center text-black font-bold text-xs hover:border-t-[#404040] hover:border-l-[#404040] hover:border-r-white hover:border-b-white"
                onClick={() => {
                  playAllSound();
                  onClose();
                }}
              >
                ×
              </button>
            </div>

            {/* CONTENT */}
            <div className="flex-1 p-3 overflow-y-auto bg-white usb-scrollbar" style={{ 
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.03) 1px, rgba(0,0,0,0.03) 2px)'
            }}>
              {usbView === 'root' ? (
                <div className="grid grid-cols-3 gap-4">
                  {folders.map(folder => (
                    <div
                      key={folder.key}
                      className="p-4 bg-[#c0c0c0] border-2 border-t-white border-l-white border-r-[#404040] border-b-[#404040] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[#d0d0d0] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white shadow-[2px_2px_0_rgba(0,0,0,0.2)]"
                      onClick={() => openFolder(folder.key)}
                    >
                      <div className="text-4xl filter drop-shadow-[1px_1px_0_rgba(0,0,0,0.3)]">{folder.icon}</div>
                      <div className="text-xs font-bold text-black text-center" style={{ fontFamily: 'Tahoma, sans-serif' }}>{folder.title}</div>
                      <div className="text-[10px] text-gray-700 font-mono bg-white px-1 border border-gray-400">{folder.count} файлов</div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <button
                    className="mb-3 px-3 py-1 bg-[#c0c0c0] border-2 border-t-white border-l-white border-r-[#404040] border-b-[#404040] cursor-pointer hover:bg-[#d0d0d0] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white flex items-center gap-2 text-black font-bold text-xs shadow-[1px_1px_0_rgba(0,0,0,0.2)]"
                    onClick={() => {
                      playAllSound();
                      setUsbView('root');
                    }}
                    style={{ fontFamily: 'Tahoma, sans-serif' }}
                  >
                    <ChevronLeft className="w-3 h-3" />
                    Назад
                  </button>
                  
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                    {usbFiles[usbView].map((file, index) => (
                      <div
                        key={index}
                        className="p-2 bg-[#c0c0c0] border-2 border-t-white border-l-white border-r-[#404040] border-b-[#404040] flex flex-col items-center gap-1 cursor-pointer hover:bg-[#d0d0d0] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white shadow-[1px_1px_0_rgba(0,0,0,0.2)]"
                        onClick={() => openViewer(file, index, usbView)}
                      >
                        {usbView === 'photo' ? (
                          <div className="w-full h-16 border border-gray-500 bg-white flex items-center justify-center overflow-hidden">
                            <img 
                              src={file.url} 
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : usbView === 'video' ? (
                          <div className="w-full h-16 border border-gray-500 bg-black flex items-center justify-center text-3xl">
                            📹
                          </div>
                        ) : (
                          <div className="w-full h-16 border border-gray-500 bg-white flex items-center justify-center text-3xl">
                            🎵
                          </div>
                        )}
                        <div className="text-[10px] font-mono text-black text-center truncate w-full px-1 bg-white border border-gray-400">
                          {file.name}
                        </div>
                        <div className="text-[9px] text-gray-700 font-mono">{file.createdAt}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="px-3 py-2 border-t-2 border-[#808080] bg-[#c0c0c0] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
              <button
                className="px-3 py-1 bg-[#c0c0c0] border-2 border-t-white border-l-white border-r-[#404040] border-b-[#404040] cursor-pointer hover:bg-[#d0d0d0] active:border-t-[#404040] active:border-l-[#404040] active:border-r-white active:border-b-white text-xs font-bold text-black shadow-[1px_1px_0_rgba(0,0,0,0.2)]"
                onClick={() => {
                  playAllSound();
                  onAddFile('usb');
                }}
                style={{ fontFamily: 'Tahoma, sans-serif' }}
              >
                ➕ Добавить файл
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Viewer window */}
      {viewerFile && (
        <div className="fixed inset-0 flex items-center justify-center z-[100000] p-4">
          <div className="scale-110 bg-[#c0c0c0] border-4 border-[#808080] shadow-[4px_4px_0_rgba(0,0,0,0.5)] max-w-[90vw] max-h-[90vh] flex flex-col" style={{ minWidth: '500px' }}>
            {/* Title bar */}
            <div className="bg-gradient-to-b from-[#0054e3] to-[#0046c7] h-8 px-2 flex items-center justify-between border-b-2 border-[#000080] shadow-[0_2px_0_rgba(255,255,255,0.3)] flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#c0c0c0] border-2 border-[#808080] flex items-center justify-center text-[10px] shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)]">
                  {currentType === 'photo' ? '🖼️' : currentType === 'video' ? '📹' : '🎵'}
                </div>
                <span className="text-white text-xs font-bold drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)] truncate" style={{ fontFamily: 'Tahoma, sans-serif', maxWidth: '300px' }}>
                  {viewerFile.name}
                </span>
              </div>
              
              <button 
                className="w-5 h-5 bg-[#c0c0c0] border-2 border-t-white border-l-white border-r-[#404040] border-b-[#404040] flex items-center justify-center text-black font-bold text-xs hover:border-t-[#404040] hover:border-l-[#404040] hover:border-r-white hover:border-b-white"
                onClick={closeViewer}
              >
                ×
              </button>
            </div>
      
            {/* Content area */}
            <div className="flex-1 bg-white p-2 min-h-[400px] max-h-[70vh] overflow-auto usb-scrollbar flex items-center justify-center">
              {currentType === 'photo' ? (
                <img 
                  src={viewerFile.url} 
                  alt={viewerFile.name}
                  className="max-w-full max-h-full object-contain"
                  style={{ 
                    imageRendering: 'auto',
                    maxHeight: 'calc(70vh - 4rem)'
                  }}
                />
              ) : currentType === 'video' ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-black">
                  {/* 2000s style video player */}
                  <div className="bg-[#d4d0c8] border-2 border-[#808080] p-2 w-full max-w-2xl">
                    {isVideoEmbed(viewerFile.url) ? (
                      <iframe
                        src={viewerFile.url}
                        className="w-full aspect-video bg-black"
                        style={{ border: '2px solid #808080' }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video 
                        src={viewerFile.url} 
                        controls 
                        className="w-full bg-black"
                        style={{ border: '2px solid #808080' }}
                      />
                    )}
                    <div className="mt-2 p-2 bg-[#c0c0c0] border border-[#808080] text-xs font-mono text-black">
                      <div className="flex items-center justify-between">
                        <span>{viewerFile.name}</span>
                        <span>{viewerFile.createdAt}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-md">
                  {/* 2000s style music player */}
                  <div className="bg-gradient-to-b from-[#e0e0e0] to-[#c0c0c0] border-4 border-[#808080] p-4">
                    <div className="bg-[#2a2a2a] border-2 border-[#404040] p-6 mb-4">
                      <div className="text-center mb-4">
                        <div className="text-6xl mb-2">🎵</div>
                        <div className="text-[#00ff00] font-mono text-sm">{viewerFile.name}</div>
                      </div>
                      
                      {/* Visualizer bars */}
                      <div className="flex items-end justify-center gap-1 h-12 mb-4">
                        {[...Array(16)].map((_, i) => (
                          <div 
                            key={i} 
                            className="w-2 bg-[#00ff00] animate-pulse" 
                            style={{ 
                              height: `${20 + Math.random() * 80}%`,
                              animationDelay: `${i * 50}ms`,
                              animationDuration: `${800 + Math.random() * 400}ms`
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    
                    <audio 
                      src={viewerFile.url} 
                      controls 
                      autoPlay
                      className="w-full"
                    />
                    
                    <div className="mt-2 text-xs text-gray-700 text-center font-mono">
                      {viewerFile.createdAt}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Status bar */}
            <div className="bg-[#c0c0c0] border-t-2 border-[#808080] px-2 py-1 flex items-center justify-between">
              <div className="flex gap-2">
                {viewerIndex > 0 && (
                  <button
                    onClick={prevFile}
                    className="px-2 py-0.5 bg-[#c0c0c0] border-2 border-t-white border-l-white border-r-[#404040] border-b-[#404040] text-xs hover:bg-[#d0d0d0]"
                    style={{ fontFamily: 'Tahoma, sans-serif' }}
                  >
                    &lt; Пред
                  </button>
                )}
                {currentType && viewerIndex < usbFiles[currentType].length - 1 && (
                  <button
                    onClick={nextFile}
                    className="px-2 py-0.5 bg-[#c0c0c0] border-2 border-t-white border-l-white border-r-[#404040] border-b-[#404040] text-xs hover:bg-[#d0d0d0]"
                    style={{ fontFamily: 'Tahoma, sans-serif' }}
                  >
                    След &gt;
                  </button>
                )}
                <button
                  onClick={deleteFile}
                  className="px-2 py-0.5 bg-[#c0c0c0] border-2 border-t-white border-l-white border-r-[#404040] border-b-[#404040] text-xs hover:bg-[#d0d0d0]"
                  style={{ fontFamily: 'Tahoma, sans-serif' }}
                >
                  🗑️ Удалить
                </button>
              </div>
              <div className="text-[10px] text-gray-700 font-mono">
                {viewerIndex + 1} из {currentType ? usbFiles[currentType].length : 0}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          .usb-scrollbar::-webkit-scrollbar {
            width: 16px;
            height: 16px;
          }
          .usb-scrollbar::-webkit-scrollbar-track {
            background: #c0c0c0;
            border: 1px solid #808080;
          }
          .usb-scrollbar::-webkit-scrollbar-thumb {
            background: #d4d0c8;
            border: 2px outset #fff;
          }
          .usb-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #e0e0e0;
          }
          .usb-scrollbar::-webkit-scrollbar-corner {
            background: #c0c0c0;
          }

          /* CRT Arc Effect */
          .crt-arc {
            position: relative;
            box-shadow: 
              inset 0 0 100px rgba(0,0,0,0.3),
              inset 0 0 50px rgba(0,0,0,0.2);
          }

          /* CRT Bulge Effect */
          .crt-arc::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background: radial-gradient(
              ellipse at center,
              rgba(255,255,255,0.08) 0%,
              rgba(255,255,255,0.03) 30%,
              rgba(0,0,0,0.15) 100%
            );
            border-radius: inherit;
          }

          /* CRT Scanlines */
          .crt-arc::after {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background: repeating-linear-gradient(
              0deg,
              rgba(0,0,0,0.05) 0px,
              rgba(0,0,0,0.05) 1px,
              transparent 1px,
              transparent 2px
            );
            border-radius: inherit;
          }
        `}
      </style>
    </>
  );
}
