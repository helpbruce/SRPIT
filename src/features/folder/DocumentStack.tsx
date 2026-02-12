import { Trash2 } from 'lucide-react';
import React, { 
  useState, 
  useEffect, 
  useCallback, 
  useRef 
} from "react";

interface Page {
  id: string;
  url: string;
}

interface DocumentStackProps {
  pages: Page[];
  currentIndex: number;
  setCurrentIndex: (i: number) => void;
  onDelete: (index: number) => void;
  onOpenFullscreen: (index: number) => void;
  isFolderOpen: boolean;
}

export function DocumentStack({
  pages,
  currentIndex,
  setCurrentIndex,
  onDelete,
  onOpenFullscreen,
  isFolderOpen,
}: DocumentStackProps) {
  const [flippingIndex, setFlippingIndex] = useState<number | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  
  // Swipe to delete states
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const DELETE_THRESHOLD = 200; // pixels to swipe right to delete

  const nextPage = useCallback(() => {
    if (!isFolderOpen) return;
    if (currentIndex < pages.length - 1) {
      setFlippingIndex(currentIndex);
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        setFlippingIndex(null);
      }, 450);
    }
  }, [currentIndex, pages.length, setCurrentIndex, isFolderOpen]);

  const prevPage = useCallback(() => {
    if (!isFolderOpen) return;
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex, setCurrentIndex, isFolderOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isFolderOpen) {
      setTouchStart(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null || !isFolderOpen) return;
    
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        nextPage();
      } else {
        prevPage();
      }
    }
    
    setTouchStart(null);
  };

  const openFullscreen = (index: number) => {
    if (!isDragging && isFolderOpen && index === currentIndex && dragOffset === 0) {
      onOpenFullscreen(index);
    }
  };

  // Swipe handlers
  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    if (index !== currentIndex || !isFolderOpen) return;
    
    e.preventDefault();
    setIsDragging(true);
    setDragStartX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const offset = e.clientX - dragStartX;
      // Only allow dragging to the right
      if (offset > 0) {
        setDragOffset(offset);
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      if (dragOffset > DELETE_THRESHOLD) {
        // Delete the document
        onDelete(currentIndex);
      }
      setIsDragging(false);
      setDragOffset(0);
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragOffset(0);
    }
  };

  const getPageStyle = (index: number) => {
    const offset = index - currentIndex;

    // Apply drag offset only to current page
    const additionalTransform = index === currentIndex && dragOffset > 0
      ? `translateX(${dragOffset}px)`
      : '';

    const opacity = index === currentIndex && dragOffset > DELETE_THRESHOLD 
      ? 0.3 
      : 1;

    if (flippingIndex === index && isFolderOpen) {
      return {
        transform: `translate(-250%, -50%) rotate(-5deg) translateZ(-20px) scale(0.95) ${additionalTransform}`,
        opacity: opacity,
        zIndex: 998,
        transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.45s ease',
      };
    }

    // Default position when folder is closed - documents should be UNDER the closed folder
    if (!isFolderOpen) {
      const stackOffset = index * 0.5;
      return {
        transform: `translate(-50%, calc(-50% + ${stackOffset}px)) rotate(0deg)`,
        zIndex: 900 + index, // Below folder cover (1000) and folder back (1)
        opacity: 0, // Hidden when folder is closed
      };
    }

    if (offset === 0) {
      return {
        transform: `translate(-50%, -50%) rotate(0deg) translateZ(10px) ${additionalTransform}`,
        zIndex: 1050, // Above folder back (1) and below cover when flipping
        opacity: opacity,
        transition: isDragging ? 'none' : 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      };
    }

    // LEFT STACK - above folder back but below closed folder cover
    if (offset < 0) {
      const leftOffset = Math.abs(offset);
      const x = -184 - leftOffset * 1.2;
      const y = -50 + leftOffset * 1.5;
      const rot = -3 - leftOffset * 0.5;
      const z = 50 - leftOffset * 4;

      return {
        transform: `translate(${x}%, ${y}%) rotate(${rot}deg) translateZ(${z}px) scale(${1.0 - leftOffset * 0.02})`,
        zIndex: 1050 + (10 - leftOffset),
        opacity: 1,
      };
    }

    // RIGHT STACK
    const x = -50 + offset * 2.5;
    const y = -50 + offset * 1.8;
    const rot = offset * 0.7;
    const z = 10 - offset * 5;

    return {
      transform: `translate(${x}%, ${y}%) rotate(${rot}deg) translateZ(${z}px) scale(${1 - offset * 0.02})`,
      zIndex: 999 - Math.abs(offset),
      opacity: 1,
    };
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center pointer-events-none"
      style={{ perspective: '1500px', transformStyle: 'preserve-3d', zIndex: 1030 }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <div 
        className="relative w-full h-full max-w-2xl max-h-[85vh] pointer-events-none"
        style={{ transformStyle: 'preserve-3d' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {pages.map((page, index) => (
          <div
            key={page.id}
            className={`absolute left-50 top-70 w-[60%] h-[55%] overflow-hidden ${
              isFolderOpen && index === currentIndex ? 'pointer-events-auto cursor-grab' : 'pointer-events-none'
            } ${isDragging && index === currentIndex ? 'cursor-grabbing' : ''}`}
            style={{
              ...getPageStyle(index),
              transition: isDragging && index === currentIndex
                ? 'none'
                : flippingIndex === index && isFolderOpen
                ? 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.45s ease, z-index 0s'
                : 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseDown={(e) => handleMouseDown(e, index)}
            onClick={() => openFullscreen(index)}
          >
            <img 
              src={page.url} 
              alt=""
              className="w-full h-full object-contain pointer-events-none"
              draggable={false}
              style={{ background: 'transparent' }}
            />
          </div>
        ))}
      </div>

      {/* Delete indicator when dragging */}
      {isDragging && dragOffset > 50 && (
        <div className="fixed right-8 top-1/2 -translate-y-1/2 pointer-events-none z-[99999]">
          <div className={`flex flex-col items-center gap-2 transition-all ${
            dragOffset > DELETE_THRESHOLD ? 'scale-125' : 'scale-100'
          }`}>
            <Trash2 className={`w-12 h-12 ${
              dragOffset > DELETE_THRESHOLD ? 'text-red-500' : 'text-white/50'
            }`} />
            <p className={`text-xs font-mono ${
              dragOffset > DELETE_THRESHOLD ? 'text-red-500' : 'text-white/50'
            }`}>
              {dragOffset > DELETE_THRESHOLD ? 'УНИЧТОЖИТЬ' : 'СВАЙП →'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
