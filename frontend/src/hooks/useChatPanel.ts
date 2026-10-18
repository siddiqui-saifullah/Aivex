import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

const COLLAPSED_KEY = "aivex-chat-collapsed";
const WIDTH_KEY = "aivex-chat-width";
const MIN_WIDTH = 288;
const MAX_WIDTH = 640;

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
};

/** Never let the chat take more than half the window. */
const clampWidth = (width: number) =>
  Math.round(
    Math.min(
      Math.max(width, MIN_WIDTH),
      Math.min(MAX_WIDTH, window.innerWidth * 0.5),
    ),
  );

/**
 * Desktop chat column: collapse to a rail (Ctrl/Cmd+B) and drag its edge to
 * resize. Both are remembered per browser.
 */
export const useChatPanel = () => {
  const [collapsed, setCollapsed] = useState(() => read(COLLAPSED_KEY) === "1");
  const [width, setWidth] = useState<number | null>(() => {
    const saved = Number(read(WIDTH_KEY));
    return Number.isFinite(saved) && saved > 0 ? clampWidth(saved) : null;
  });
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLElement>(null);

  const setCollapsedSaved = useCallback((next: boolean) => {
    setCollapsed(next);
    write(COLLAPSED_KEY, next ? "1" : "0");
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      write(COLLAPSED_KEY, prev ? "0" : "1");
      return !prev;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === "b"
      ) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const startResize = useCallback((e: ReactPointerEvent) => {
    const panel = panelRef.current;
    if (!panel || e.button !== 0) return;
    e.preventDefault();
    const left = panel.getBoundingClientRect().left;
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    let latest = panel.getBoundingClientRect().width;
    const onMove = (ev: PointerEvent) => {
      latest = clampWidth(ev.clientX - left);
      setWidth(latest);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setIsResizing(false);
      write(WIDTH_KEY, String(latest));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  /** Keyboard resizing for the separator (arrow keys). */
  const resizeBy = useCallback((delta: number) => {
    const current =
      panelRef.current?.getBoundingClientRect().width ?? MIN_WIDTH;
    const next = clampWidth(current + delta);
    setWidth(next);
    write(WIDTH_KEY, String(next));
  }, []);

  const resetWidth = useCallback(() => {
    setWidth(null);
    write(WIDTH_KEY, null);
  }, []);

  return {
    collapsed,
    setCollapsed: setCollapsedSaved,
    toggle,
    width,
    isResizing,
    panelRef,
    startResize,
    resizeBy,
    resetWidth,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
  };
};
