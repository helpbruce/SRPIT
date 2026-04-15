import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { ChevronLeft, ChevronRight, X, Trash2 } from 'lucide-react';
const DocumentStack = lazy(() => import('../features/folder/DocumentStack').then(m => ({ default: m.DocumentStack })));
const USBModal = lazy(() => import('../features/usb/USBModal').then(m => ({ default: m.USBModal })));
import { PDAModal } from '../features/pda/PDAModal';
const AddFileModal = lazy(() => import('../features/folder/AddFileModal').then(m => ({ default: m.AddFileModal })));
const WelcomeGuide = lazy(() => import('../features/welcome/WelcomeGuide').then(m => ({ default: m.WelcomeGuide })));
import { getImagePath } from '../shared/lib/PlaceholderImages';
const FolderViewer = lazy(() => import('../features/folder/FolderViewer').then(m => ({ default: m.FolderViewer })));
import { supabase } from '../shared/lib/supabaseClient';
import { CacheManager } from '../shared/lib/cache';
import { debounce } from '../shared/lib/realtimeUtils';
import { isLimitExceededError, markLimitExceeded, shouldRetryFetch, clearLimitFlag } from '../shared/lib/limitUtils';
import { LimitWarning } from '../shared/ui/LimitWarning';
import { User } from '@supabase/supabase-js';
import { verifyDiscordMembership, isDiscordConfigured } from '../features/pda/discordAuth';
import { startDiscordPeriodicCheck, checkDiscordMembershipWithToken, getDiscordToken } from '../features/pda/discordPeriodicCheck';

// TTL для кэша: 7 дней (оптимизация для снижения запросов к Supabase)
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

// Определяем тип документа по URL
function getDocType(url: string): 'image' | 'pdf' | 'video' | 'audio' {
  const lower = url.toLowerCase();
  if (lower.includes('.pdf') || lower.startsWith('data:application/pdf') || lower.includes('drive.google.com') || lower.includes('docs.google.com')) {
    return 'pdf';
  }
  if (lower.match(/\.(mp4|webm|mov|avi|mkv)$/i) || lower.startsWith('data:video')) {
    return 'video';
  }
  if (lower.match(/\.(mp3|wav|ogg|flac|aac)$/i) || lower.startsWith('data:audio')) {
    return 'audio';
  }
  return 'image';
}

// Конвертируем URL в embed-формат для iframe
function convertToEmbedUrl(url: string): string {
  // Google Docs
  const docsMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docsMatch) {
    return `https://docs.google.com/document/d/${docsMatch[1]}/preview?chrome=false`;
  }
  // Google Drive
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }
  return url;
}

interface Document {
  url: string;
  id: string;
}

export default function App() {
  const [isUSBOpen, setIsUSBOpen] = useState(false);
  const [isPDAOpen, setIsPDAOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addContext, setAddContext] = useState<'folder' | 'usb'>('folder');
  const [marlboroClicked, setMarlboroClicked] = useState(false);
  const [zippoClicked, setZippoClicked] = useState(false);
  const [smokeVisible, setSmokeVisible] = useState(false);

  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isPDAAnimating, setIsPDAAnimating] = useState(false);
  const [showPDALoading, setShowPDALoading] = useState(false);

  const [isMuted, setIsMuted] = useState(false);

  // Уведомление о превышении лимитов
  const [showLimitWarning, setShowLimitWarning] = useState(() => {
    return !shouldRetryFetch();
  });

  // Admin status from PDA login
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      return localStorage.getItem('pda_user_role') === 'admin';
    } catch {
      return false;
    }
  });

  // Discord verification gate
  const [discordChecking, setDiscordChecking] = useState(true);
  const [discordVerified, setDiscordVerified] = useState(false);
  const [discordError, setDiscordError] = useState(false);
  const [discordAccessToken, setDiscordAccessToken] = useState<string | null>(() => getDiscordToken());

  // Auto-verify Discord on site load
  useEffect(() => {
    if (!isDiscordConfigured()) {
      setDiscordChecking(false);
      setDiscordVerified(true);
      return;
    }

    if (localStorage.getItem('srpit_discord_verified') === 'true') {
      setDiscordChecking(false);
      setDiscordVerified(true);
      return;
    }

    const token = getDiscordToken();
    if (token) {
      checkDiscordMembershipWithToken().then((isMember) => {
        setDiscordChecking(false);
        if (isMember) {
          setDiscordVerified(true);
          try { localStorage.setItem('srpit_discord_verified', 'true'); } catch {}
        } else {
          setDiscordError(true);
        }
      });
      return;
    }

    setDiscordChecking(false);
    setDiscordError(true);
  }, []);

  // Периодическая проверка Discord membership для доступа к сайту
  useEffect(() => {
    if (!isDiscordConfigured() || !discordVerified) return;

    const stopCheck = startDiscordPeriodicCheck(
      () => {
        // Если пользователь больше не на сервере, закрываем доступ
        setDiscordVerified(false);
        setDiscordError(true);
        try { localStorage.removeItem('srpit_discord_verified'); } catch {}
      },
      discordAccessToken
    );

    return stopCheck;
  }, [discordVerified]);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);

  const sound1Ref = useRef<HTMLAudioElement>(null);
  const sound2Ref = useRef<HTMLAudioElement>(null);
  const sound3Ref = useRef<HTMLAudioElement>(null);

  const pdaRef = useRef<HTMLDivElement>(null);

  const [pdaInitialPos] = useState({
    x: 1010,
    y: -300,
    w: 700,
    h: 700,
    rotate: 19,
  });

  // Определяем активные блокировки
  const isAnyModalOpen = isUSBOpen || isPDAOpen || isAddModalOpen || fullscreenIndex !== null;

  // Load documents from Supabase + кеш + realtime с debounce
  useEffect(() => {
    const cached = CacheManager.get<Document[]>('documents');
    if (cached) setDocuments(cached);

    if (!supabase) return;

    if (!shouldRetryFetch()) {
      console.log('[Documents] ⏭️ Пропускаем загрузку документов — лимиты Supabase превышены');
      return;
    }

    let isMounted = true;
    let isLoading = false;

    const loadDocuments = async () => {
      if (isLoading) return;
      isLoading = true;
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('id, url')
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Failed to load documents from Supabase:', error);
          return;
        }

        if (!isMounted || !data) return;

        const mapped = data.map((row) => ({
          id: row.id as string,
          url: row.url as string,
        }));

        setDocuments(mapped);
        CacheManager.set('documents', mapped, CACHE_TTL);
      } finally {
        isLoading = false;
      }
    };

    if (!cached) {
      loadDocuments();
    }

    // Realtime с debounce — 500ms
    let channel: any = null;
    if (shouldRetryFetch()) {
      const debouncedLoad = debounce(loadDocuments, 500);
      channel = supabase
        .channel('documents_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'documents' },
          debouncedLoad
        )
        .subscribe();
    }

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Предзагрузка данных в кэш при старте приложения (offline-first режим)
  const preloadData = useCallback(async (forceRefresh = false) => {
    if (!supabase) return;

    const hasCache = !!CacheManager.get('pda_characters') && !!CacheManager.get('bestiary_entries') && !!CacheManager.get('usb_files');
    if (!forceRefresh && hasCache) {
      console.log('[Preload] ⏭️ Все данные уже в кэше, пропускаем предзагрузку');
      return;
    }

    // Если не форсируем и лимиты превышены — не делаем запросы
    if (!forceRefresh && !shouldRetryFetch()) {
      console.log('[Preload] ⏭️ Пропускаем загрузку — лимиты Supabase превышены, используем кэш');
      return;
    }

    // Если форсируем — сбрасываем флаг лимитов
    if (forceRefresh) {
      clearLimitFlag();
      setShowLimitWarning(false);
    }

    console.log('[Preload] Начинаем загрузку данных в кэш...');
    const startTime = Date.now();
    try {
      // Загружаем USB файлы
      const { data: usbData, error: usbError } = await supabase
        .from('usb_files')
        .select('id, type, url, name, created_at_label, is_protected, password_hash, protected_hint')
        .order('created_at', { ascending: true });

      if (usbError && isLimitExceededError(usbError)) {
        console.warn('[Preload] ⚠️ Превышены лимиты Supabase, используем кэш');
        markLimitExceeded();
        setShowLimitWarning(true);
        return;
      }

      if (!usbError && usbData) {
        const usbFiles: { photo: any[], video: any[], audio: any[] } = { photo: [], video: [], audio: [] };
        for (const row of usbData) {
          const type = row.type as 'photo' | 'video' | 'audio';
          usbFiles[type].push({
            id: row.id as string,
            url: row.url as string,
            name: row.name as string,
            createdAt: (row.created_at_label as string) ?? '',
            is_protected: (row.is_protected as boolean) ?? false,
            password_hash: (row.password_hash as string) ?? null,
            protected_hint: (row.protected_hint as string) ?? null,
          });
        }
        CacheManager.set('usb_files', usbFiles, CACHE_TTL);
        console.log('[Preload] ✓ USB файлы загружены в кэш:', usbFiles.photo.length + usbFiles.video.length + usbFiles.audio.length, 'файлов');
      } else {
        console.warn('[Preload] ✗ Ошибка загрузки USB:', usbError);
      }

      // Загружаем персонажей PDA
      const { data: charsData, error: charsError } = await supabase
        .from('pda_characters')
        .select('*')
        .order('updated_at', { ascending: true });

      if (charsError && isLimitExceededError(charsError)) {
        console.warn('[Preload] ⚠️ Превышены лимиты Supabase, используем кэш');
        markLimitExceeded();
        setShowLimitWarning(true);
        return;
      }

      if (!charsError && charsData) {
        const characters = charsData.map((row: any) => ({
          id: row.id,
          photo: row.photo ?? '/icons/nodata.png',
          name: row.name ?? '',
          birthDate: row.birthdate ?? '',
          faction: row.faction ?? '',
          rank: row.rank ?? '',
          status: row.status ?? 'Неизвестен',
          shortInfo: row.shortinfo ?? '',
          fullInfo: row.fullinfo ?? '',
          notes: row.notes ?? '',
          tasks: (row.tasks ?? []) as Task[],
          caseNumber: row.casenumber ?? '',
        }));
        CacheManager.set('pda_characters', characters, CACHE_TTL);
        console.log('[Preload] ✓ Персонажи загружены в кэш:', characters.length);
      } else {
        console.warn('[Preload] ✗ Ошибка загрузки персонажей:', charsError);
      }

      // Загружаем бестиарий
      const { data: bestiaryData, error: bestiaryError } = await supabase
        .from('bestiary_entries')
        .select('*')
        .order('updated_at', { ascending: true });

      if (bestiaryError && isLimitExceededError(bestiaryError)) {
        console.warn('[Preload] ⚠️ Превышены лимиты Supabase, используем кэш');
        markLimitExceeded();
        setShowLimitWarning(true);
        return;
      }

      if (!bestiaryError && bestiaryData) {
        const bestiaryEntries = bestiaryData.map((row: any) => ({
          id: row.id,
          type: row.type,
          name: row.name,
          photos: [row.photos?.[0] ?? '/icons/nodata.png', row.photos?.[1] ?? '/icons/nodata.png'],
          shortInfo: row.short_info ?? '',
          fullInfo: row.full_info ?? '',
          dangerLevel: row.danger_level ?? 'средний',
          anomalyNames: row.anomaly_names ?? [],
        }));
        CacheManager.set('bestiary_entries', bestiaryEntries, CACHE_TTL);
        console.log('[Preload] ✓ Бестиарий загружен в кэш:', bestiaryEntries.length);
      } else {
        console.warn('[Preload] ✗ Ошибка загрузки бестиария:', bestiaryError);
      }

      const elapsed = Date.now() - startTime;
      console.log(`[Preload] ✓ Завершено за ${elapsed}мс`);
    } catch (e) {
      console.warn('[Preload] ✗ Ошибка предзагрузки данных:', e);
    }
  }, [supabase]);

  // Вызываем preload при монтировании
  useEffect(() => {
    preloadData();
  }, [preloadData]);

  useEffect(() => {
    if (!isFolderOpen) {
      setCurrentIndex(0);
    }
  }, [isFolderOpen]);

  const handleUSBClick = () => {
    if (isAnyModalOpen) return;
    setIsUSBOpen(true);
  };

  const handleUSBClose = () => {
    setIsUSBOpen(false);
  };

  const handlePDAClick = () => {
    if (isAnyModalOpen) return;

    setIsPDAAnimating(true);
    setTimeout(() => setIsPDAOpen(true), 800);
  };

  const handlePDAClose = () => {
    setIsPDAOpen(false);
    setIsPDAAnimating(false);
  };

  const handleAddFile = (context: 'folder' | 'usb') => {
    setAddContext(context);
    setIsAddModalOpen(true);
  };

  const handleConfirmAdd = (url: string, name?: string) => {
    if (addContext === 'folder') {
      const embedUrl = convertToEmbedUrl(url);
      const optimisticId = `doc-${Date.now()}-${Math.random()}`;
      const newDoc = { url: embedUrl, id: optimisticId };
      const updated = [...documents, newDoc];
      setDocuments(updated);

      // Обновляем кеш
      CacheManager.set('documents', updated, CACHE_TTL);

      if (supabase) {
        supabase
          .from('documents')
          .insert({ url })
          .then(({ data, error }) => {
            if (error || !data || !data[0]) {
              console.error('Failed to insert document into Supabase:', error);
              // Откатываем при ошибке
              setDocuments(documents);
              CacheManager.set('documents', documents, CACHE_TTL);
              return;
            }

            const realId = data[0].id as string;
            const finalDocs = documents.map(doc =>
              doc.id === optimisticId ? { ...doc, id: realId } : doc
            );
            setDocuments(finalDocs);
            CacheManager.set('documents', finalDocs, CACHE_TTL);
          });
      }
    } else if (addContext === 'usb') {
      if ((window as any).__addUSBFile) {
        (window as any).__addUSBFile(url, name);
      }
    }
  };

  const handleDeleteDocument = (index: number) => {
    const docToDelete = documents[index];
    if (!docToDelete) return;

    // Оптимистичное обновление UI
    const newDocs = documents.filter((_, i) => i !== index);
    setDocuments(newDocs);
    setCurrentIndex(Math.min(currentIndex, newDocs.length - 1));
    
    // Обновляем кеш
    CacheManager.set('documents', newDocs, CACHE_TTL);

    // Удаляем из Supabase
    if (supabase) {
      supabase
        .from('documents')
        .delete()
        .eq('id', docToDelete.id)
        .then(({ error }) => {
          if (error) {
            console.error('Failed to delete document from Supabase:', error);
            // Откатываем изменения при ошибке
            setDocuments(documents);
            CacheManager.set('documents', documents, CACHE_TTL);
          }
        });
    }
  };

  const handleMarlboroClick = () => {
    if (isAnyModalOpen || isMuted) return;
    setMarlboroClicked(true);
    sound1Ref.current?.play();
  };

  const handleZippoClick = () => {
    if (!marlboroClicked || isAnyModalOpen || isMuted) return;
    
    setZippoClicked(true);
    sound2Ref.current?.play();
    
    setTimeout(() => {
      if (sound3Ref.current) {
        sound3Ref.current.volume = 0.5;
        sound3Ref.current.play();
      }
    }, 1000);

    setTimeout(() => {
      setSmokeVisible(true);
    }, 3000);

    setTimeout(() => {
      setSmokeVisible(false);
    }, 6000);
  };

  const handleNextPage = () => {
    if (isFolderOpen && currentIndex < documents.length - 1) {
      setCurrentIndex(currentIndex + 1);
      if (fullscreenIndex !== null) {
        setFullscreenIndex(currentIndex + 1);
      }
    }
  };

  const handlePrevPage = () => {
    if (isFolderOpen && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      if (fullscreenIndex !== null) {
        setFullscreenIndex(currentIndex - 1);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFolderOpen) return;
      
      if (e.key === 'ArrowRight') handleNextPage();
      if (e.key === 'ArrowLeft') handlePrevPage();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFolderOpen, currentIndex, documents.length, fullscreenIndex]);

  useEffect(() => {
    if (fullscreenIndex !== null) {
      setCurrentIndex(fullscreenIndex);
    }
  }, [fullscreenIndex]);

  // ESC key for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreenIndex !== null) {
        setFullscreenIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenIndex]);

  // Discord gate — before everything
  if (isDiscordConfigured() && discordChecking) {
    return (
      <div className="fixed inset-0 bg-[#050505] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-300 font-mono text-sm mb-4">Проверка Discord...</div>
          <div className="w-10 h-10 border-2 border-gray-500 border-t-gray-300 rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  if (isDiscordConfigured() && discordError) {
    return (
      <div className="fixed inset-0 bg-[#050505] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border-2 border-red-800 bg-[#111111] p-8 text-center shadow-2xl">
          <div className="text-red-400 font-mono text-lg mb-2">ДОСТУП ЗАПРЕЩЁН</div>
          <div className="text-gray-500 font-mono text-xs mb-6">Вы не состоите в требуемом Discord сервере</div>
          <button
            onClick={() => {
              setDiscordError(false);
              setDiscordChecking(true);
              verifyDiscordMembership().then((result) => {
                setDiscordChecking(false);
                if (result.success && result.accessToken) {
                  try {
                    localStorage.setItem('srpit_discord_verified', 'true');
                    localStorage.setItem('srpit_discord_token', result.accessToken);
                    localStorage.setItem('srpit_discord_token_timestamp', String(Date.now()));
                  } catch {}
                  setDiscordAccessToken(result.accessToken);
                  setDiscordVerified(true);
                } else {
                  setDiscordError(true);
                }
              });
            }}
            className="px-6 py-3 bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl text-gray-400 font-mono text-sm hover:bg-[#3a3a3a]"
          >
            ПОПРОБОВАТЬ СНОВА
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-cover bg-center bg-fixed flex items-center justify-center"
      style={{ backgroundImage: `url(${getImagePath(isUSBOpen ? 'back2.jpg' : 'background.jpg')})` }}
    >
      <audio ref={sound1Ref} src="/media/sounds/sound1.mp3" preload="none" />
      <audio ref={sound2Ref} src="/media/sounds/sound2.mp3" preload="none" />
      <audio ref={sound3Ref} src="/media/sounds/sound3.mp3" preload="none" />

      {smokeVisible && (
        <video 
          className="fixed left-1/2 top-1/2 w-[2500px] h-auto -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[9999] transition-opacity duration-[2s]"
          style={{ 
            opacity: smokeVisible ? 1 : 0,
            mixBlendMode: 'screen',
          }}
          src="/media/video/smoke.mp4"
          autoPlay
          muted
          loop
          preload="none"
        />
      )}

      {/* Screen Wrapper */}
      <div
        className="w-screen h-screen flex items-center justify-center relative"
        style={{
          pointerEvents: isUSBOpen ? 'none' : 'auto',
          opacity: isUSBOpen ? 0 : 1,
          transition: 'opacity 0s',
        }}
      >
        {/* Folder Viewer */}
        <Suspense fallback={null}>
          <FolderViewer
            isOpen={isFolderOpen}
            onToggle={() => !isAnyModalOpen && setIsFolderOpen(prev => !prev)}
          >
            {documents.length > 0 && (
              <DocumentStack
                pages={documents}
                currentIndex={currentIndex}
                setCurrentIndex={setCurrentIndex}
                onDelete={handleDeleteDocument}
                onOpenFullscreen={(index) => setFullscreenIndex(index)}
                isFolderOpen={isFolderOpen}
              />
            )}
          </FolderViewer>
        </Suspense>
        

        {/* USB Icon */}
        <div 
          className="fixed w-66 h-66 bg-contain bg-no-repeat bg-center cursor-pointer transition-all duration-[1000ms] hover:scale-110 hover:translate-y-[-20px] hover:brightness-125 pointer-events-auto"
          style={{ 
            backgroundImage: `url(${getImagePath('usb.png')})`,
            filter: 'drop-shadow(15px 15px 25px rgba(0,0,0,0.8)) drop-shadow(8px 8px 15px rgba(0,0,0,0.6))',
            zIndex: 500,
            pointerEvents: isAnyModalOpen ? 'none' : 'auto',
            right: '5vw',
            top: '45vh',
          }}
          onClick={handleUSBClick}
        />

        {/* PDA Device */}
        <div
          ref={pdaRef}
          className="fixed bg-contain bg-no-repeat bg-center transition-all duration-[1500ms] cursor-pointer"
          style={{
            backgroundImage: `url(${getImagePath('pda.png')})`,

            left: isPDAAnimating ? "50%" : `calc(124vw - ${pdaInitialPos.w/2}px - 5vw)`,
            top: isPDAAnimating ? "50%" : `calc(5vw - ${pdaInitialPos.w/2}px - 5vw)`,

            width: isPDAAnimating ? "min(90vw,1100px)" : `${pdaInitialPos.w}px`,
            height: isPDAAnimating ? "min(90vw,1100px)" : `${pdaInitialPos.h}px`,

            transform: isPDAAnimating
              ? "translate(-50%, -50%)"
              : `translate(-50%, 0) rotate(${pdaInitialPos.rotate}deg)`,

            filter: isPDAAnimating
              ? "none"
              : "drop-shadow(15px 15px 25px rgba(0,0,0,0.7))",

            zIndex: isPDAAnimating ? 9998 : 500,
            pointerEvents: isPDAOpen ? 'none' : (isAnyModalOpen ? 'none' : 'auto'),
          }}

          onClick={!isPDAAnimating ? handlePDAClick : undefined}

          onMouseEnter={(e) => {
            if (!isPDAAnimating && !isPDAOpen) {
              e.currentTarget.style.transform =
                `translate(-50%, 0) rotate(${pdaInitialPos.rotate}deg) translateY(-20px) scale(1.08)`;

              e.currentTarget.style.filter =
                "drop-shadow(25px 25px 35px rgba(0,0,0,0.9))";
            }
          }}

          onMouseLeave={(e) => {
            if (!isPDAAnimating && !isPDAOpen) {
              e.currentTarget.style.transform =
                `translate(-50%, 0) rotate(${pdaInitialPos.rotate}deg)`;

              e.currentTarget.style.filter =
                "drop-shadow(15px 15px 25px rgba(0,0,0,0.7))";
            }
          }}
        >
          {showPDALoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-gray-500/30 border-t-gray-400 rounded-full animate-spin" />
            </div>
          )}

          {isPDAOpen && (
            <div className="absolute inset-0 flex items-center justify-center absolute top-51 right-19 left-8 bottom-52 mix-blend-screen">
              <PDAModal
                isOpen={isPDAOpen}
                onClose={handlePDAClose}
                isMuted={isMuted}
              />
            </div>
          )}
        </div>

        {/* Marlboro - with image mask for precise interaction */}
        {!marlboroClicked && (
          <img 
            src={getImagePath('malboro.png')}
            className="fixed w-[341px] h-[512px] rotate-[-2deg] cursor-pointer transition-all duration-[1000ms] ease-[cubic-bezier(.25,.8,.25,1)] hover:translate-y-[-60px] hover:scale-[1.15]"
            style={{ 
              filter: 'drop-shadow(45px 45px 45px rgba(0,0,0,1))',
              pointerEvents: isAnyModalOpen ? 'none' : 'auto',
              zIndex: 500,
              left: 'calc(70vw + 130px)',
              bottom: '-300px',
            }}
            onClick={handleMarlboroClick}
            alt="Marlboro"
            loading="lazy"
            decoding="async"
          />
        )}

        {/* Zippo - with image mask for precise interaction */}
        {!zippoClicked && (
          <img 
            src={getImagePath('zipo.png')}
            className={`fixed w-[247px] h-[361px] rotate-[-6deg] transition-all duration-[1000ms] ease-[cubic-bezier(.25,.8,.25,1)] hover:translate-y-[-50px] hover:scale-[1.15] ${
              marlboroClicked && !isAnyModalOpen ? 'cursor-pointer' : 'cursor-not-allowed opacity-100'
            }`}
            style={{ 
              filter: 'drop-shadow(15px 15px 15px rgba(0,0,0,1))',
              pointerEvents: isAnyModalOpen ? 'none' : 'auto',
              zIndex: 500,
              left: 'calc(70vw - 18px)',
              bottom: '-170px',
            }}
            onClick={handleZippoClick}
            alt="Zippo"
            loading="lazy"
            decoding="async"
          />
        )}
      </div>

      {/* USB Modal */}
      {isUSBOpen && (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(90vw,800px)] h-[min(85vh,600px)] z-[10000]">
          <Suspense fallback={null}>
            <USBModal
              isOpen={isUSBOpen}
              onClose={handleUSBClose}
              onAddFile={() => handleAddFile('usb')}
              isMuted={isMuted}
              isAdmin={isAdmin}
            />
          </Suspense>
        </div>
      )}

      {/* Fullscreen Modal */}
      {fullscreenIndex !== null && documents[fullscreenIndex] && (
        <div className="fixed inset-0 bg-black/95 z-[99999] flex items-center justify-center">
          <button
            onClick={() => setFullscreenIndex(null)}
            className="absolute top-6 right-6 p-3 bg-red-900/70 border-2 border-red-700 text-white hover:bg-red-800/90 transition-all duration-200 hover:scale-110 active:scale-95 z-10 rounded-lg flex items-center justify-center"
          >
            <X className="w-6 h-6" />
          </button>

          {fullscreenIndex > 0 && (
            <button
              onClick={() => setFullscreenIndex(fullscreenIndex - 1)}
              className="absolute left-6 top-1/2 -translate-y-1/2 p-3 bg-[#1a1a1a]/90 border-2 border-[#3a3a3a] text-gray-400 hover:bg-[#2a2a2a]/90 hover:border-[#4a4a4a] transition-all duration-200 hover:scale-110 active:scale-95 z-10 rounded-lg flex items-center justify-center"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {fullscreenIndex < documents.length - 1 && (
            <button
              onClick={() => setFullscreenIndex(fullscreenIndex + 1)}
              className="absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-[#1a1a1a]/90 border-2 border-[#3a3a3a] text-gray-400 hover:bg-[#2a2a2a]/90 hover:border-[#4a4a4a] transition-all duration-200 hover:scale-110 active:scale-95 z-10 rounded-lg flex items-center justify-center"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          <div className="w-full h-full p-8 flex flex-col items-center justify-center">
            {(() => {
              const docUrl = convertToEmbedUrl(documents[fullscreenIndex].url);
              const type = getDocType(docUrl);
              return type === 'pdf' ? (
                <div className="relative w-full h-full flex items-center justify-center" style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
                  <iframe
                    src={docUrl}
                    title={`doc-${fullscreenIndex}`}
                    className="w-full h-full border-0"
                    style={{
                      background: 'white',
                      borderRadius: '4px',
                    }}
                    scrolling="auto"
                  />
                </div>
              ) : (
                <img
                  src={docUrl}
                  className="max-w-full max-h-full object-contain pointer-events-none"
                  alt=""
                  loading="eager"
                  decoding="async"
                />
              );
            })()}
          </div>

          <button
            onClick={() => {
              handleDeleteDocument(fullscreenIndex);
              if (documents.length - 1 <= fullscreenIndex) {
                setFullscreenIndex(null);
              }
            }}
            className="fixed bottom-8 left-8 px-6 py-3 bg-red-900/70 border-2 border-red-700 text-red-400 rounded-lg hover:bg-red-800/90 transition-all z-10 font-mono flex items-center gap-2"
          >
            <Trash2 className="w-5 h-5" />
            УНИЧТОЖИТЬ
          </button>
        </div>
      )}

      {/* A4 Paper Corner Button - только когда папка открыта */}
      {isFolderOpen && (
        <div 
          className="fixed bottom-0 left-[155px] z-[9000]"
          style={{ 
            pointerEvents: isUSBOpen ? 'none' : 'auto',
            opacity: isUSBOpen ? 0 : 1,
            transition: 'opacity 0s',
          }}
        >
          <div 
            className="relative w-32 h-32 cursor-pointer transition-all duration-200 hover:translate-y-[-10px] group"
            onClick={() => handleAddFile('folder')}
            style={{
              pointerEvents: isAnyModalOpen ? 'none' : 'auto',
            }}
          >
            {/* A4 paper corner */}
            <svg 
              viewBox="0 0 100 100" 
              className="w-full h-full filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)] group-hover:drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)] transition-all"
            >
              {/* Paper */}
              <path 
                d="M 10 90 L 10 30 L 50 10 L 90 10 L 90 90 Z" 
                fill="#f5f5f5" 
                stroke="#d0d0d0" 
                strokeWidth="1"
              />
              {/* Fold */}
              <path 
                d="M 10 30 L 50 30 L 50 10" 
                fill="#e5e5e5" 
                stroke="#d0d0d0" 
                strokeWidth="1"
              />
              {/* Plus sign */}
              <line x1="50" y1="45" x2="50" y2="75" stroke="#666" strokeWidth="3" strokeLinecap="round" />
              <line x1="35" y1="60" x2="65" y2="60" stroke="#666" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      )}

      {/* Modals */}
      <Suspense fallback={null}>
        <AddFileModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleConfirmAdd}
        />

        <WelcomeGuide />
      </Suspense>

      {/* Global Mute Button */}
      <button
        onClick={() => setIsMuted(prev => !prev)}
        className="fixed bottom-4 right-4 z-[11000] px-3 py-2 bg-[#1a1a1a]/90 border border-[#3a3a3a] rounded text-xs font-mono text-gray-300 hover:bg-[#2a2a2a]"
      >
        {isMuted ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ'}
      </button>

      {/* Limit Warning */}
      {showLimitWarning && (
        <LimitWarning
          onClose={() => setShowLimitWarning(false)}
          onRefresh={() => preloadData(true)}
        />
      )}
    </div>
  );
}
