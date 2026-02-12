import { getImagePath } from "../../shared/lib/PlaceholderImages";

interface FolderViewerProps {
  isOpen: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

export function FolderViewer({ isOpen, onToggle, children }: FolderViewerProps) {
  return (
    <div 
      className="fixed w-[440px] h-[560px] left-[34vw] group folder-root"
      style={{ 
        perspective: "2600px",
        transformStyle: "preserve-3d",
        zIndex: isOpen ? 1030 : 1100, // Higher z-index when closed to be above documents
        scale: "1.50",
        filter: "drop-shadow(20px 20px 40px rgba(0,0,0,0.6)) drop-shadow(10px 10px 20px rgba(0,0,0,0.4))",
      }}
    >
      {/* Задняя часть папки */}
      <div 
        className="absolute top-0 left-[6.5px] w-full h-full bg-cover bg-center z-[1]"
        style={{ 
          scale: "1.03",
          backgroundImage: `url(${getImagePath("folder_back.png")})`,
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* Документы внутри папки */}
      <div 
        className="absolute inset-0 z-[1020] pointer-events-none"
        style={{ 
          transformStyle: "preserve-3d",
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }}
      >
        {children}
      </div>

      {/* Крышка */}
      <div 
        className={`absolute inset-0 z-[1000] cursor-pointer folder-cover ${isOpen ? "open" : ""}`}
        onClick={onToggle}
      >
        {/* Внешняя сторона крышки */}
        <div 
          className="absolute inset-0 bg-cover bg-center folder-cover-front"
          style={{ 
            backgroundImage: `url(${getImagePath("folder_cover.png")})`,
            transform: "scaleX(-1)",
          }}
        />

        {/* Внутренняя сторона крышки */}
        <div 
          className="absolute inset-0 bg-cover bg-center folder-cover-inside"
          style={{ 
            backgroundImage: `url(${getImagePath("folder_inside.png")})`,
            transform: "rotateY(180deg)",
          }}
        />
      </div>

      {/* CSS */}
      <style>
        {`
          /* Крышка — закрыта */
          .folder-cover {
            transform-origin: left center;
            transform-style: preserve-3d;
            transition: transform 2.8s cubic-bezier(.25,.8,.25,1);
            transform: rotateY(0deg);
          }

          /* При наведении — лёгкое приоткрытие */
          .folder-root:hover .folder-cover:not(.open) {
            transform: rotateY(-22deg);
          }

          /* При клике — полностью открыта */
          .folder-cover.open {
            transform: rotateY(-180deg);
          }

          /* Лицевая сторона крышки */
          .folder-cover-front {
            backface-visibility: hidden;
            z-index: 2;
          }

          /* Внутренняя сторона крышки */
          .folder-cover-inside {
            backface-visibility: hidden;
            z-index: 1;
          }
        `}
      </style>
    </div>
  );
}
