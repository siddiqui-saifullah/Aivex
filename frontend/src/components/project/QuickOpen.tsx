import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { getFileIcon } from "../../utils/fileIconMap";

interface QuickOpenProps {
  files: string[];
  onOpen: (path: string) => void;
  onClose: () => void;
}

/** Fuzzy score: every query char must appear in order; consecutive and file-name matches rank higher. */
const score = (path: string, query: string) => {
  if (!query) return 1;
  const lower = path.toLowerCase();
  const name = lower.split("/").pop() ?? lower;
  if (name.startsWith(query)) return 1000 - name.length;
  if (name.includes(query)) return 800 - name.length;
  let pos = -1;
  let total = 0;
  for (const ch of query) {
    const next = lower.indexOf(ch, pos + 1);
    if (next === -1) return 0;
    total += next === pos + 1 ? 5 : 1;
    pos = next;
  }
  return total;
};

/** VS Code-style "Go to file" (Ctrl/Cmd+P). */
const QuickOpen = ({ files, onOpen, onClose }: QuickOpenProps) => {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "");
    return files
      .map((path) => ({ path, s: score(path, q) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || a.path.localeCompare(b.path))
      .slice(0, 50)
      .map((r) => r.path);
  }, [files, query]);

  useEffect(() => {
    listRef.current?.children[highlight]?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  const pick = (path: string | undefined) => {
    if (!path) return;
    onOpen(path);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 backdrop-blur-sm px-4 pt-[12vh] animate-fade-in"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Go to file"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black/60"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-3">
          <Search size={16} className="text-zinc-500 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                pick(results[highlight]);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Go to file…"
            aria-label="File name"
            className="h-12 flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
          />
          <kbd className="hidden sm:block rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-500">Esc</kbd>
        </div>

        <ul ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 && <li className="px-4 py-6 text-center text-sm text-zinc-500">No matching files</li>}
          {results.map((path, i) => {
            const name = path.split("/").pop();
            const dir = path.slice(0, path.length - (name?.length ?? 0)).replace(/\/$/, "");
            return (
              <li
                key={path}
                role="option"
                aria-selected={i === highlight}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(path)}
                className={`flex cursor-pointer items-center gap-2.5 px-4 py-2 text-sm ${
                  i === highlight ? "bg-teal-500/15 text-white" : "text-zinc-300"
                }`}
              >
                <span className="shrink-0 [&_svg]:h-4 [&_svg]:w-4">{createElement(getFileIcon(name ?? path))}</span>
                <span className="truncate">{name}</span>
                {dir && <span className="ml-auto truncate pl-3 text-xs text-zinc-500">{dir}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default QuickOpen;
