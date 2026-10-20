import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

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

interface SidePaneOptions {
  /** localStorage prefix, e.g. "aivex-chat" (stores -collapsed and -width). */
  storageKey: string;
  minWidth: number;
  maxWidth: number;
  /** Keyboard shortcut that toggles the pane, e.g. Ctrl/Cmd+B. */
  isShortcut: (e: KeyboardEvent) => boolean;
}

/**
 * A desktop side column (chat, file explorer): collapse it to a rail with a
 * shortcut and drag its edge to resize. Both are remembered per browser.
 */
export const useSidePane = <T extends HTMLElement = HTMLElement>({
  storageKey,
  minWidth,
  maxWidth,
  isShortcut,
}: SidePaneOptions) => {
  const collapsedKey = `${storageKey}-collapsed`;
  const widthKey = `${storageKey}-width`;
  // Never let one pane take more than half the window
  const clampWidth = (width: number) =>
    Math.round(Math.min(Math.max(width, minWidth), Math.min(maxWidth, window.innerWidth * 0.5)));

  const [collapsed, setCollapsedState] = useState(() => read(collapsedKey) === "1");
  const [width, setWidth] = useState<number | null>(() => {
    const saved = Number(read(widthKey));
    return Number.isFinite(saved) && saved > 0 ? clampWidth(saved) : null;
  });
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<T>(null);

  const setCollapsed = (next: boolean) => {
    setCollapsedState(next);
    write(collapsedKey, next ? "1" : "0");
  };

  // Latest values for the window listener without re-subscribing
  const shortcutRef = useRef({ isShortcut, collapsedKey });
  useEffect(() => {
    shortcutRef.current = { isShortcut, collapsedKey };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!shortcutRef.current.isShortcut(e)) return;
      e.preventDefault();
      setCollapsedState((prev) => {
        write(shortcutRef.current.collapsedKey, prev ? "0" : "1");
        return !prev;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const startResize = (e: ReactPointerEvent) => {
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
      write(widthKey, String(latest));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /** Keyboard resizing for the separator (arrow keys). */
  const resizeBy = (delta: number) => {
    const current = panelRef.current?.getBoundingClientRect().width ?? minWidth;
    const next = clampWidth(current + delta);
    setWidth(next);
    write(widthKey, String(next));
  };

  const resetWidth = () => {
    setWidth(null);
    write(widthKey, null);
  };

  return {
    collapsed,
    setCollapsed,
    width,
    isResizing,
    panelRef,
    startResize,
    resizeBy,
    resetWidth,
    minWidth,
    maxWidth,
  };
};

export type SidePane = ReturnType<typeof useSidePane<HTMLElement>>;
