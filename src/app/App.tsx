import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Trash2 } from 'lucide-react';
import { DocumentStack } from '../features/folder/DocumentStack';
import { USBModal } from '../features/usb/USBModal';
import { PDAModal } from '../features/pda/PDAModal';
import { AddFileModal } from '../features/folder/AddFileModal';
import { WelcomeGuide } from '../features/welcome/WelcomeGuide';
import { MapModal } from '../features/map/MapModal';
import { getImagePath } from '../shared/lib/PlaceholderImages';
import { FolderViewer } from '../features/folder/FolderViewer';
import { supabase } from '../shared/lib/supabaseClient';

interface Document {
  url: string;
  id: string;
}

export default function App() {
  const [isUSBOpen, setIsUSBOpen] = useState(false);
  const [isPDAOpen, setIsPDAOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addContext, setAddContext] = useState<'folder' | 'usb'>('folder');
  const [marlboroClicked, setMarlboroClicked] = useState(false);
  const [zippoClicked, setZippoClicked] = useState(false);
  const [smokeVisible, setSmokeVisible] = useState(false);

  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isPDAAnimating, setIsPDAAnimating] = useState(false);
  const [showPDALoading, setShowPDALoading] = useState(false);

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
  const isAnyModalOpen = isUSBOpen || isPDAOpen || isMapOpen || isAddModalOpen || fullscreenIndex !== null;

  // Load documents from Supabase (fallback to empty if Supabase не настроен)
  useEffect(() => {
    let isMounted = true;

    const loadDocuments = async () => {
      if (!supabase) return;

      const { data, error } = await supabase
        .from('documents')
        .select('id, url')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to load documents from Supabase:', error);
        return;
      }

      if (!isMounted || !data) return;

      setDocuments(
        data.map((row) => ({
          id: row.id as string,
          url: row.url as string,
        }))
      );
    };

    loadDocuments();

    return () => {
      isMounted = false;
    };
  }, []);

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
    setShowPDALoading(true);

    setTimeout(() => setShowPDALoading(false), 1500);
    setTimeout(() => setIsPDAOpen(true), 1800);
  };

  const handlePDAClose = () => {
    setIsPDAOpen(false);
    setIsPDAAnimating(false);
  };

  const handleAddFile = (context: 'folder' | 'usb') => {
    setAddContext(context);
    setIsAddModalOpen(true);
  };

  const handleConfirmAdd = (url: string) => {
    if (addContext === 'folder') {
      const optimisticId = `doc-${Date.now()}`;
      setDocuments(prev => [...prev, { url, id: optimisticId }]);

      if (supabase) {
        supabase
          .from('documents')
          .insert({ url })
          .then(({ data, error }) => {
            if (error || !data || !data[0]) {
              console.error('Failed to insert document into Supabase:', error);
              return;
            }

            const realId = data[0].id as string;
            setDocuments(prev =>
              prev.map(doc =>
                doc.id === optimisticId ? { ...doc, id: realId } : doc
              )
            );
          });
      }
    } else if (addContext === 'usb') {
      if ((window as any).__addUSBFile) {
        (window as any).__addUSBFile(url);
      }
    }
  };

  const handleDeleteDocument = (index: number) => {
    const docToDelete = documents[index];
    const newDocs = documents.filter((_, i) => i !== index);
    setDocuments(newDocs);
    setCurrentIndex(Math.min(currentIndex, newDocs.length - 1));

    if (supabase && docToDelete) {
      supabase
        .from('documents')
        .delete()
        .eq('id', docToDelete.id)
        .then(({ error }) => {
          if (error) {
            console.error('Failed to delete document from Supabase:', error);
          }
        });
    }
  };

  const handleMarlboroClick = () => {
    if (isAnyModalOpen) return;
    setMarlboroClicked(true);
    sound1Ref.current?.play();
  };

  const handleZippoClick = () => {
    if (!marlboroClicked || isAnyModalOpen) return;
    
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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-cover bg-center bg-fixed flex items-center justify-center"
      style={{ backgroundImage: `url(${getImagePath(isUSBOpen ? 'back2.jpg' : 'background.jpg')})` }}
    >
      <audio ref={sound1Ref} src="/media/sounds/sound1.mp3" />
      <audio ref={sound2Ref} src="/media/sounds/sound2.mp3" />
      <audio ref={sound3Ref} src="/media/sounds/sound3.mp3" />

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
      />

      {/* Map Corner - with proper shape detection */}
      <div 
        className="fixed top-0 left-0 w-48 h-48 cursor-pointer transition-all duration-[1000ms] hover:scale-110 group"
        onClick={() => !isAnyModalOpen && setIsMapOpen(true)}
        style={{
          clipPath: 'polygon(0 0, 100% 0, 0 100%)',
          pointerEvents: isAnyModalOpen ? 'none' : 'auto',
          zIndex: 1200,
          opacity: isUSBOpen ? 0 : 1,
          transition: 'opacity 0s',
        }}
      >
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `url(${getImagePath('map_corner.png')})`,
            backgroundSize: 'cover',
            backgroundPosition: 'top left',
            filter: 'drop-shadow(10px 10px 15px rgba(0,0,0,0.6)) drop-shadow(5px 5px 10px rgba(0,0,0,0.4))',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/0 via-yellow-500/0 to-yellow-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" 
          style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
        />
      </div>

      {/* Screen Wrapper */}
      <div 
        className="w-screen h-screen flex items-center justify-center relative"
        style={{ 
          pointerEvents: isMapOpen || isUSBOpen ? 'none' : 'auto',
          opacity: isUSBOpen ? 0 : 1,
          transition: 'opacity 0s',
        }}
      >
        {/* Folder Viewer */}
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
          />
        )}
      </div>

      {/* USB Modal */}
      {isUSBOpen && (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(90vw,800px)] h-[min(85vh,600px)] z-[10000]">
          <USBModal 
            isOpen={isUSBOpen}
            onClose={handleUSBClose}
            onAddFile={() => handleAddFile('usb')}
          />
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
            <img 
              src={documents[fullscreenIndex].url} 
              className="max-w-full max-h-full object-contain pointer-events-none"
              alt=""
            />
          </div>

          <button
            onClick={() => {
              const newDocs = documents.filter((_, i) => i !== fullscreenIndex);
              setDocuments(newDocs);
              if (newDocs.length === 0) {
                setFullscreenIndex(null);
              } else {
                setFullscreenIndex(Math.min(fullscreenIndex, newDocs.length - 1));
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
            pointerEvents: isMapOpen || isUSBOpen ? 'none' : 'auto',
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
      <MapModal 
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
      />

      <AddFileModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleConfirmAdd}
      />

      <WelcomeGuide />
    </div>
  );
}
