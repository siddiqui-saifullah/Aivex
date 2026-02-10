import { useState, useEffect, useRef } from "react";
import {
  Maximize2,
  ExternalLink,
  X,
  Move,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  RotateCw,
} from "lucide-react";

const PreviewOverlay = ({ url, baseUrl, onClose, onNavigate }) => {
  const [input, setInput] = useState(url);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [size, setSize] = useState({ width: 550, height: 650 });

  // High-performance position reference
  const posRef = useRef({ x: window.innerWidth - 600, y: 100 });
  const overlayRef = useRef(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    setInput(url);
  }, [url]);

  const handleGo = () => {
    if (!input) return;
    const targetUrl = input.startsWith("/") ? baseUrl + input : input;
    onNavigate(targetUrl);
  };

  // Browser-like Navigation Actions
  const goBack = () => iframeRef.current?.contentWindow?.history.back();
  const goForward = () => iframeRef.current?.contentWindow?.history.forward();
  const reload = () => {
    if (iframeRef.current) iframeRef.current.src = url;
  };

  // --- Smooth Dragging Logic ---
  const handleMouseDown = (e) => {
    if (isFullScreen) return;

    const startX = e.clientX - posRef.current.x;
    const startY = e.clientY - posRef.current.y;
    let frameId = null;

    const onMouseMove = (moveEvent) => {
      if (frameId) cancelAnimationFrame(frameId);

      frameId = requestAnimationFrame(() => {
        const newX = moveEvent.clientX - startX;
        const newY = moveEvent.clientY - startY;
        posRef.current = { x: newX, y: newY };

        if (overlayRef.current) {
          overlayRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
        }
      });
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      if (frameId) cancelAnimationFrame(frameId);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // --- Resizing Logic ---
  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const startWidth = size.width;
    const startHeight = size.height;
    const startX = e.clientX;
    const startY = e.clientY;

    const onMouseMove = (moveEvent) => {
      setSize({
        width: Math.max(400, startWidth + (moveEvent.clientX - startX)),
        height: Math.max(450, startHeight + (moveEvent.clientY - startY)),
      });
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const overlayBaseStyle = isFullScreen
    ? {
        width: "100vw",
        height: "100vh",
        transform: "translate(0, 0)",
        borderRadius: "0px",
        zIndex: 100,
      }
    : {
        width: `${size.width}px`,
        height: `${size.height}px`,
        transform: `translate(${posRef.current.x}px, ${posRef.current.y}px)`,
        borderRadius: "16px", // Back to the original rounded look
      };

  return (
    <div
      ref={overlayRef}
      style={{
        ...overlayBaseStyle,
        position: "fixed",
        top: 0,
        left: 0,
        willChange: "transform, width, height",
      }}
      className="bg-zinc-950/95 backdrop-blur-2xl border border-white/10 shadow-2xl z-50 flex flex-col overflow-hidden transition-[border-radius] duration-300"
    >
      {/* Browser-style Header */}
      <div
        onMouseDown={handleMouseDown}
        className={`h-14 flex items-center gap-3 px-4 border-b border-white/10 bg-zinc-900/80 select-none ${
          isFullScreen ? "cursor-default" : "cursor-move"
        }`}
      >
        {/* Navigation Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={goBack}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={goForward}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={reload}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
          >
            <RotateCw size={15} />
          </button>
        </div>

        {/* Address Bar Area */}
        <div className="flex-1 flex items-center bg-black/40 border border-white/10 rounded-full px-3 py-1 gap-2 focus-within:border-teal-500/40 transition-all">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGo()}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full bg-transparent text-xs text-zinc-300 focus:outline-none"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => window.open(url, "_blank")}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg"
            title="Open in new tab"
          >
            <ExternalLink size={16} />
          </button>
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg"
          >
            {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="relative flex-1 bg-white">
        <iframe
          ref={iframeRef}
          src={url}
          title="App Preview"
          sandbox="allow-scripts allow-same-origin allow-forms"
          className="w-full h-full border-0"
        />
        {/* Pointer-events guard for resize */}
        <div className="absolute inset-0 pointer-events-none" />
      </div>

      {/* Resize Handle */}
      {!isFullScreen && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1.5 group"
        >
          <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-zinc-700 group-hover:border-teal-500 transition-colors" />
        </div>
      )}
    </div>
  );
};

export default PreviewOverlay;
