import { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, Hand, Pen, Eraser } from 'lucide-react';
import { supabase } from '../../shared/lib/supabaseClient';
import { CacheManager } from '../../shared/lib/cache';

interface Marker {
  id: string;
  x: number;
  y: number;
  type:
    | 'radiation'
    | 'mutant'
    | 'anomaly'
    | 'danger'
    | 'target'
    | 'base'
    | 'checkpoint'
    | 'artifact'
    | 'bubble'
    | 'text';
  note: string;
  text?: string;
}

interface DrawingPath {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MapModal({ isOpen, onClose }: MapModalProps) {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [drawings, setDrawings] = useState<DrawingPath[]>([]);
  const [selectedTool, setSelectedTool] = useState<
    Marker['type'] | 'pan' | 'draw' | 'eraser' | null
  >('pan');
  const [editingMarker, setEditingMarker] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredMarkerType, setHoveredMarkerType] = useState<
    Marker['type'] | 'pan' | 'draw' | 'eraser' | null
  >(null);
  const [draggingMarker, setDraggingMarker] = useState<string | null>(null);
  const [showLoading, setShowLoading] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>(
    []
  );
  const [drawColor, setDrawColor] = useState('#ff0000');
  const [drawWidth, setDrawWidth] = useState(3);

  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(
    null
  );

  const mapRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (editingMarker) {
          setEditingMarker(null);
          setNoteText('');
        } else {
          onClose();
        }
      }
    };

    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, editingMarker]);

  // Load markers & drawings from Supabase + кеш + realtime подписка
  useEffect(() => {
    if (!supabase) {
      // Пробуем загрузить из кеша если Supabase не настроен
      const cachedMarkers = CacheManager.get<Marker[]>('map_markers');
      const cachedDrawings = CacheManager.get<DrawingPath[]>('map_drawings');
      if (cachedMarkers) setMarkers(cachedMarkers);
      if (cachedDrawings) setDrawings(cachedDrawings);
      return;
    }

    let isMounted = true;

    const load = async () => {
      // Сначала загружаем из кеша для мгновенного отображения
      const cachedMarkers = CacheManager.get<Marker[]>('map_markers');
      const cachedDrawings = CacheManager.get<DrawingPath[]>('map_drawings');
      if (cachedMarkers && isMounted) setMarkers(cachedMarkers);
      if (cachedDrawings && isMounted) setDrawings(cachedDrawings);

      // Затем загружаем свежие данные из Supabase
      const [markersRes, drawingsRes] = await Promise.all([
        supabase.from('map_markers').select('id, marker').order('created_at', { ascending: true }),
        supabase.from('map_drawings').select('id, path').order('created_at', { ascending: true }),
      ]);

      if (!isMounted) return;

      if (markersRes.error) {
        console.error('Failed to load map_markers from Supabase:', markersRes.error);
      } else if (markersRes.data) {
        const mapped = markersRes.data.map((row: any) => ({
          ...(row.marker as Marker),
          id: row.marker.id ?? row.id,
        }));
        setMarkers(mapped);
        CacheManager.set('map_markers', mapped, 10 * 60 * 1000);
      }

      if (drawingsRes.error) {
        console.error('Failed to load map_drawings from Supabase:', drawingsRes.error);
      } else if (drawingsRes.data) {
        const mapped = drawingsRes.data.map((row: any) => ({
          ...(row.path as DrawingPath),
          id: row.path.id ?? row.id,
        }));
        setDrawings(mapped);
        CacheManager.set('map_drawings', mapped, 10 * 60 * 1000);
      }
    };

    load();

    const channel = supabase
      .channel('map_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'map_markers' },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'map_drawings' },
        () => load()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // loading overlay
  useEffect(() => {
    if (isOpen) {
      setShowLoading(true);
      setTimeout(() => setShowLoading(false), 1500);
    }
  }, [isOpen]);

  // canvas render - перерисовывается при изменении drawings, размера окна или открытии карты
  useEffect(() => {
    if (!canvasRef.current || !mapRef.current || !isOpen) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = mapRef.current.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем все сохранённые рисунки
    drawings.forEach(path => {
      if (path.points.length < 2) return;

      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      const first = path.points[0];
      ctx.moveTo(
        (first.x / 100) * canvas.width,
        (first.y / 100) * canvas.height
      );

      path.points.slice(1).forEach(p => {
        ctx.lineTo(
          (p.x / 100) * canvas.width,
          (p.y / 100) * canvas.height
        );
      });

      ctx.stroke();
    });

    // Рисуем текущий рисунок (во время рисования)
    if (currentPath.length > 1) {
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = drawWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      const first = currentPath[0];
      ctx.moveTo(
        (first.x / 100) * canvas.width,
        (first.y / 100) * canvas.height
      );

      currentPath.slice(1).forEach(p => {
        ctx.lineTo(
          (p.x / 100) * canvas.width,
          (p.y / 100) * canvas.height
        );
      });

      ctx.stroke();
    }
  }, [drawings, currentPath, drawColor, drawWidth, isOpen]);

  // wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!isOpen) return;
      e.preventDefault();

      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.max(0.5, Math.min(5, prev + delta)));
    };

    const container = mapContainerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [isOpen]);

  // coords
  const screenToMapCoords = (clientX: number, clientY: number) => {
    if (!mapRef.current) return { x: 0, y: 0 };

    const rect = mapRef.current.getBoundingClientRect();

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    return { x, y };
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return;
    if (
      selectedTool === 'pan' ||
      selectedTool === 'draw' ||
      selectedTool === 'eraser' ||
      draggingMarker
    )
      return;

    const coords = screenToMapCoords(e.clientX, e.clientY);

    if (
      selectedTool &&
      [
        'radiation',
        'mutant',
        'anomaly',
        'danger',
        'target',
        'base',
        'checkpoint',
        'artifact',
        'bubble',
        'text',
      ].includes(selectedTool)
    ) {
      let text = '';
      if (selectedTool === 'text') {
        text = prompt('Введите текст метки:') || '';
        if (!text) return;
      }

      const newMarker: Marker = {
        id: `marker-${Date.now()}`,
        x: coords.x,
        y: coords.y,
        type: selectedTool as Marker['type'],
        note: '',
        text: selectedTool === 'text' ? text : undefined,
      };

      const updated = [...markers, newMarker];
      setMarkers(updated);
      CacheManager.set('map_markers', updated, 10 * 60 * 1000);

      if (supabase) {
        supabase
          .from('map_markers')
          .insert({ marker: newMarker })
          .then(({ error }) => {
            if (error) {
              console.error('Failed to insert map_marker into Supabase:', error);
              setMarkers(markers);
              CacheManager.set('map_markers', markers, 10 * 60 * 1000);
            }
          });
      }
      setSelectedTool('pan');
    }
  };

  const eraseAtPoint = (coords: { x: number; y: number }) => {
    const eraseRadius = (drawWidth / zoom) * 0.2;

    setDrawings(prev => {
      const newDrawings: DrawingPath[] = [];

      prev.forEach(path => {
        const segments: { x: number; y: number }[][] = [[]];
        let current = 0;

        path.points.forEach(point => {
          const dx = point.x - coords.x;
          const dy = point.y - coords.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > eraseRadius) {
            segments[current].push(point);
          } else {
            if (segments[current].length > 0) {
              current++;
              segments[current] = [];
            }
          }
        });

        segments.forEach(seg => {
          if (seg.length > 1) {
            newDrawings.push({
              id: `draw-${Date.now()}-${Math.random()}`,
              points: seg,
              color: path.color,
              width: path.width,
            });
          }
        });
      });

      if (supabase) {
        supabase
          .from('map_drawings')
          .upsert(
            newDrawings.map(path => ({ path })),
            { onConflict: 'id' }
          )
          .then(({ error }) => {
            if (error) {
              console.error('Failed to upsert map_drawings in Supabase:', error);
            }
          });
      }

      return newDrawings;
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool === 'draw') {
      e.preventDefault();
      setIsDrawing(true);
      const coords = screenToMapCoords(e.clientX, e.clientY);
      setCurrentPath([coords]);
      return;
    }

    if (selectedTool === 'eraser') {
      e.preventDefault();
      setIsDrawing(true);
      const coords = screenToMapCoords(e.clientX, e.clientY);
      eraseAtPoint(coords);
      return;
    }

    if (selectedTool === 'pan' || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y,
      });
      return;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool === 'draw' || selectedTool === 'eraser') {
      setCursorPos({ x: e.clientX, y: e.clientY });
    } else {
      setCursorPos(null);
    }

    if (isDrawing && selectedTool === 'draw') {
      const coords = screenToMapCoords(e.clientX, e.clientY);
      setCurrentPath(prev => [...prev, coords]);
      return;
    }

    if (isDrawing && selectedTool === 'eraser') {
      const coords = screenToMapCoords(e.clientX, e.clientY);
      eraseAtPoint(coords);
      return;
    }

    if (isPanning && !draggingMarker) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (draggingMarker) {
      const coords = screenToMapCoords(e.clientX, e.clientY);
      const updated = markers.map(m =>
        m.id === draggingMarker ? { ...m, x: coords.x, y: coords.y } : m
      );
      setMarkers(updated);
      // Не сохраняем в кеш при каждом движении мыши - только при отпускании
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && selectedTool === 'draw' && currentPath.length > 1) {
      const newDrawing: DrawingPath = {
        id: `draw-${Date.now()}`,
        points: currentPath,
        color: drawColor,
        width: drawWidth,
      };
      const updated = [...drawings, newDrawing];
      setDrawings(updated);
      CacheManager.set('map_drawings', updated, 10 * 60 * 1000);

      if (supabase) {
        supabase
          .from('map_drawings')
          .insert({ path: newDrawing })
          .then(({ error }) => {
            if (error) {
              console.error('Failed to insert map_drawing into Supabase:', error);
              setDrawings(drawings);
              CacheManager.set('map_drawings', drawings, 10 * 60 * 1000);
            }
          });
      }
      setCurrentPath([]);
    }

    // Сохраняем позицию маркера после перетаскивания
    if (draggingMarker && supabase) {
      const marker = markers.find(m => m.id === draggingMarker);
      if (marker) {
        CacheManager.set('map_markers', markers, 10 * 60 * 1000);
        supabase
          .from('map_markers')
          .update({ marker })
          .match({ 'marker->>id': draggingMarker })
          .then(({ error }) => {
            if (error) {
              console.error('Failed to update marker position in Supabase:', error);
            }
          });
      }
    }

    setIsDrawing(false);
    setIsPanning(false);
    setDraggingMarker(null);
  };

  const handleMarkerMouseDown = (
    e: React.MouseEvent,
    markerId: string
  ) => {
    if (selectedTool === 'draw' || selectedTool === 'eraser') return;
    e.stopPropagation();
    setDraggingMarker(markerId);
  };

  const handleMarkerClick = (e: React.MouseEvent, markerId: string) => {
    e.stopPropagation();
    if (draggingMarker || selectedTool === 'draw' || selectedTool === 'eraser')
      return;

    const marker = markers.find(m => m.id === markerId);
    if (marker) {
      setEditingMarker(markerId);
      setNoteText(marker.note);
    }
  };

  const saveNote = () => {
    if (editingMarker) {
      const updated = markers.map(m =>
        m.id === editingMarker ? { ...m, note: noteText } : m
      );
      setMarkers(updated);
      CacheManager.set('map_markers', updated, 10 * 60 * 1000);
      setEditingMarker(null);
      setNoteText('');

      // Сохраняем в Supabase
      if (supabase) {
        const marker = updated.find(m => m.id === editingMarker);
        if (marker) {
          supabase
            .from('map_markers')
            .update({ marker })
            .match({ 'marker->>id': editingMarker })
            .then(({ error }) => {
              if (error) {
                console.error('Failed to update marker note in Supabase:', error);
              }
            });
        }
      }
    }
  };

  const deleteMarker = (markerId: string) => {
    const markerToDelete = markers.find(m => m.id === markerId);
    const updated = markers.filter(m => m.id !== markerId);
    setMarkers(updated);
    setEditingMarker(null);
    CacheManager.set('map_markers', updated, 10 * 60 * 1000);

    if (supabase && markerToDelete) {
      supabase
        .from('map_markers')
        .delete()
        .match({ 'marker->>id': markerToDelete.id })
        .then(({ error }) => {
          if (error) {
            console.error('Failed to delete map_marker from Supabase:', error);
            setMarkers(markers);
            CacheManager.set('map_markers', markers, 10 * 60 * 1000);
          }
        });
    }
  };

  const clearDrawings = () => {
    if (confirm('Очистить все рисунки?')) {
      setDrawings([]);
      CacheManager.set('map_drawings', [], 10 * 60 * 1000);

      if (supabase) {
        supabase
          .from('map_drawings')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000') // delete all
          .then(({ error }) => {
            if (error) {
              console.error('Failed to clear map_drawings in Supabase:', error);
              // Не откатываем при ошибке очистки - пользователь уже подтвердил
            }
          });
      }
    }
  };

  const editMarkerText = (markerId: string) => {
    const marker = markers.find(m => m.id === markerId);
    if (marker && marker.type === 'text') {
      const newText =
        prompt('Введите новый текст метки:', marker.text || '') ?? null;
      if (newText !== null) {
        setMarkers(prev =>
          prev.map(m =>
            m.id === markerId ? { ...m, text: newText } : m
          )
        );
      }
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.3, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.3, 0.5));
  const resetZoom = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const getMarkerIcon = (type: Marker['type']) => {
    const base = 'w-6 h-6 pointer-events-none select-none';

    switch (type) {
      case 'radiation':
        return (
          <img src="/icons/radio.png" className={base} draggable={false} />
        );
      case 'mutant':
        return (
          <img src="/icons/mutant.png" className={base} draggable={false} />
        );
      case 'anomaly':
        return (
          <img src="/icons/anomaly.png" className={base} draggable={false} />
        );
      case 'artifact':
        return (
          <img src="/icons/artifact.png" className={base} draggable={false} />
        );
      case 'bubble':
        return <img src="/icons/puz.png" className={base} draggable={false} />;
      case 'danger':
        return (
          <img src="/icons/danger.png" className={base} draggable={false} />
        );
      case 'target':
        return <img src="/icons/cel.png" className={base} draggable={false} />;
      case 'base':
        return <img src="/icons/baze.png" className={base} draggable={false} />;
      case 'checkpoint':
        return (
          <img src="/icons/tochka.png" className={base} draggable={false} />
        );
      case 'text':
        return <img src="/icons/txt.png" className={base} draggable={false} />;
      default:
        return null;
    }
  };

  const getMarkerName = (type: Marker['type']) => {
    switch (type) {
      case 'radiation':
        return 'РАДИАЦИЯ';
      case 'mutant':
        return 'МУТАНТЫ';
      case 'anomaly':
        return 'АНОМАЛИЯ';
      case 'danger':
        return 'ОПАСНОСТЬ';
      case 'target':
        return 'ЦЕЛЬ';
      case 'base':
        return 'БАЗА';
      case 'checkpoint':
        return 'ТОЧКА';
      case 'artifact':
        return 'АРТЕФАКТ';
      case 'bubble':
        return 'ПУЗЫРЬ';
      case 'text':
        return 'ТЕКСТ';
      default:
        return '';
    }
  };

  if (!isOpen) return null;

  const markerTypes: Marker['type'][] = [
    'radiation',
    'mutant',
    'anomaly',
    'artifact',
    'bubble',
    'danger',
    'target',
    'base',
    'checkpoint',
    'text',
  ];

  return (
    <div
      ref={mapContainerRef}
      className="fixed inset-0 bg-black/95 flex items-center justify-center z-[99999] pointer-events-auto"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      onContextMenu={e => e.preventDefault()}
    >
      {showLoading && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100001]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-gray-500/30 border-t-gray-400 rounded-full animate-spin" />
            <div className="text-gray-400 font-mono text-sm">
              ЗАГРУЗКА КАРТЫ...
            </div>
          </div>
        </div>
      )}

      {/* Close */}
      <button
        className="fixed top-4 right-4 w-10 h-10 bg-red-900/70 border-2 border-red-700 rounded-full hover:bg-red-800/90 transition-all flex items-center justify-center z-[100005]"
        onClick={onClose}
      >
        <X className="w-5 h-5 text-red-400" />
      </button>

      {/* Toolbar */}
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 bg-[#0f0f0f]/95 border-2 border-[#3a3a3a] rounded-lg p-2 flex gap-2 z-[100004] items-center"
        style={{ opacity: showLoading ? 0 : 1 }}
      >
        <button
          onClick={() => setSelectedTool('pan')}
          onMouseEnter={() => setHoveredMarkerType('pan')}
          onMouseLeave={() => setHoveredMarkerType(null)}
          className={`p-2 rounded-lg border-2 transition-all relative ${
            selectedTool === 'pan'
              ? 'bg-[#2a2a2a] border-[#4a4a4a] text-gray-300'
              : 'bg-[#1a1a1a] border-[#2a2a2a] text-gray-500 hover:border-[#3a3a3a]'
          }`}
        >
          <Hand className="w-5 h-5" />
          {hoveredMarkerType === 'pan' && (
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/90 text-gray-300 text-xs font-mono px-2 py-1 rounded whitespace-nowrap">
              ПЕРЕМЕЩЕНИЕ
            </div>
          )}
        </button>

        <button
          onClick={() => setSelectedTool('draw')}
          onMouseEnter={() => setHoveredMarkerType('draw')}
          onMouseLeave={() => setHoveredMarkerType(null)}
          className={`p-2 rounded-lg border-2 transition-all relative ${
            selectedTool === 'draw'
              ? 'bg-[#2a2a2a] border-[#4a4a4a] text-gray-300'
              : 'bg-[#1a1a1a] border-[#2a2a2a] text-gray-500 hover:border-[#3a3a3a]'
          }`}
        >
          <Pen className="w-5 h-5" />
          {hoveredMarkerType === 'draw' && (
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/90 text-gray-300 text-xs font-mono px-2 py-1 rounded whitespace-nowrap">
              РИСОВАТЬ
            </div>
          )}
        </button>

        <button
          onClick={() => setSelectedTool('eraser')}
          onMouseEnter={() => setHoveredMarkerType('eraser')}
          onMouseLeave={() => setHoveredMarkerType(null)}
          className={`p-2 rounded-lg border-2 transition-all relative ${
            selectedTool === 'eraser'
              ? 'bg-[#2a2a2a] border-[#4a4a4a] text-gray-300'
              : 'bg-[#1a1a1a] border-[#2a2a2a] text-gray-500 hover:border-[#3a3a3a]'
          }`}
        >
          <Eraser className="w-5 h-5" />
          {hoveredMarkerType === 'eraser' && (
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/90 text-gray-300 text-xs font-mono px-2 py-1 rounded whitespace-nowrap">
              ЛАСТИК
            </div>
          )}
        </button>

        {(selectedTool === 'draw' || selectedTool === 'eraser') && (
          <>
            <div className="w-px h-6 bg-[#2a2a2a]" />

            {selectedTool === 'draw' && (
              <input
                type="color"
                value={drawColor}
                onChange={e => setDrawColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
            )}

            <input
              type="range"
              min={1}
              max={10}
              value={drawWidth}
              onChange={e => setDrawWidth(Number(e.target.value))}
              className="w-24"
            />

            <span className="text-gray-400 font-mono text-xs min-w-[2rem]">
              {drawWidth}px
            </span>

            <button
              onClick={clearDrawings}
              className="px-2 py-1 bg-red-900/30 border border-red-800 rounded text-red-400 text-xs font-mono hover:bg-red-900/50"
            >
              Очистить
            </button>
          </>
        )}

        <div className="w-px h-6 bg-[#2a2a2a]" />

        {markerTypes.map(type => (
          <button
  key={type}
  onClick={() => setSelectedTool(selectedTool === type ? 'pan' : type)}
  onMouseEnter={() => setHoveredMarkerType(type)}
  onMouseLeave={() => setHoveredMarkerType(null)}
  className={`rounded-lg border-2 transition-all relative h-10 w-10 flex items-center justify-center ${
    selectedTool === type
      ? 'bg-[#2a2a2a] border-[#4a4a4a]'
      : 'bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#3a3a3a]'
  }`}
>
  {getMarkerIcon(type)}
  {hoveredMarkerType === type && (
    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/90 text-gray-300 text-xs font-mono px-2 py-1 rounded whitespace-nowrap">
      {getMarkerName(type)}
    </div>
  )}
</button>

        ))}
      </div>

      {/* Zoom Controls */}
      <div
        className="fixed bottom-6 right-6 bg-[#0f0f0f]/95 border-2 border-[#3a3a3a] rounded-lg p-2 flex flex-col gap-2 z-[100004]"
        style={{ opacity: showLoading ? 0 : 1 }}
      >
        <button
          onClick={handleZoomIn}
          className="p-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded hover:border-[#3a3a3a] hover:bg-[#2a2a2a] transition-all"
        >
          <ZoomIn className="w-5 h-5 text-gray-400" />
        </button>

        <button
          onClick={resetZoom}
          className="p-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded hover:border-[#3a3a3a] hover:bg-[#2a2a2a] transition-all text-gray-400 font-mono text-xs text-center"
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          onClick={handleZoomOut}
          className="p-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded hover:border-[#3a3a3a] hover:bg-[#2a2a2a] transition-all"
        >
          <ZoomOut className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Map Container */}
      <div
        className="w-full h-full flex items-center justify-center overflow-hidden"
        style={{ opacity: showLoading ? 0 : 1 }}
      >
        <div
          ref={mapRef}
          className="relative overflow-hidden"
          style={{
            cursor: isDrawing
              ? 'none'
              : isPanning
              ? 'grabbing'
              : selectedTool === 'pan' || draggingMarker
              ? 'grab'
              : selectedTool === 'draw'
              ? 'none'
              : selectedTool === 'eraser'
              ? 'none'
              : 'crosshair',
            width: `100vw`,
            height: `100vh`,
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition:
              isPanning || draggingMarker || isDrawing
                ? 'none'
                : 'transform 0.2s ease-out',
          }}
          onClick={handleMapClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            handleMouseUp();
            setCursorPos(null);
          }}
        >
          {/* Fullscreen image without cropping */}
          <img
            src="/icons/map.png"
            alt="Карта"
            className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
            loading="eager"
            decoding="async"
          />

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{ width: '100%', height: '100%' }}
          />

          {/* Markers */}
          {markers.map(marker => (
            <div
              key={marker.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move transition-all hover:scale-125 group"
              style={{
                left: `${marker.x}%`,
                top: `${marker.y}%`,
              }}
              onMouseDown={e => handleMarkerMouseDown(e, marker.id)}
              onClick={e => handleMarkerClick(e, marker.id)}
              onDoubleClick={e => {
                e.stopPropagation();
                if (marker.type === 'text') editMarkerText(marker.id);
              }}
            >
              {marker.type === 'text' ? (
                <div className="bg-black/80 text-gray-300 px-2 py-1 rounded border border-gray-500 text-xs font-mono whitespace-nowrap pointer-events-none select-none">
                  {marker.text}
                </div>
              ) : (
              <div className="flex items-center justify-center w-7 h-7 bg-[#0f2f0f]/70 border border-[#2a2a2a] rounded-md pointer-events-none select-none">
  {getMarkerIcon(marker.type)}
</div>

              )}

              {marker.note && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-gray-400 rounded-full flex items-center justify-center text-[8px] text-black font-bold pointer-events-none">
                  !
                </div>
              )}

              <button
                onClick={e => {
                  e.stopPropagation();
                  deleteMarker(marker.id);
                }}
                className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Brush cursor */}
      {cursorPos && (selectedTool === 'draw' || selectedTool === 'eraser') && (
        <div
          className="fixed rounded-full border-2 pointer-events-none z-[100010]"
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
            width: drawWidth * 2,
            height: drawWidth * 2,
            transform: 'translate(-50%, -50%)',
            borderColor: selectedTool === 'draw' ? drawColor : '#ff0000',
            backgroundColor:
              selectedTool === 'eraser'
                ? 'rgba(255, 0, 0, 0.1)'
                : 'rgba(255, 255, 255, 0.1)',
          }}
        />
      )}

      {/* Marker Edit Modal */}
      {editingMarker && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100010]">
          <div className="bg-[#1a1a1a] w-[min(90vw,400px)] border-2 border-[#4a4a4a] rounded-lg overflow-hidden">
            <div className="bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] h-10 px-4 flex items-center justify-between border-b-2 border-[#3a3a3a]">
              <span className="text-gray-400 text-sm font-mono text-center flex-1">
                ЗАМЕТКА
              </span>
              <button
                onClick={() => {
                  setEditingMarker(null);
                  setNoteText('');
                }}
                className="w-6 h-6 bg-red-900/50 border border-red-700 rounded-full hover:bg-red-800/70 transition-all flex items-center justify-center"
              >
                <X className="w-4 h-4 text-red-400" />
              </button>
            </div>

            <div className="p-4">
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Добавьте заметку..."
                className="w-full p-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded text-gray-400 font-mono text-sm focus:border-[#3a3a3a] focus:outline-none resize-none"
                rows={4}
                autoFocus
              />

              <div className="flex gap-2 mt-4">
                <button
                  onClick={saveNote}
                  className="flex-1 px-4 py-2 bg-gray-700/50 border border-gray-600 rounded hover:bg-gray-700/70 transition-all text-gray-300 font-mono text-sm text-center"
                >
                  СОХРАНИТЬ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
