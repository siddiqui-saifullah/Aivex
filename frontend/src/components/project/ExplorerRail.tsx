import { FolderTree, PanelLeftOpen, Search } from "lucide-react";

/** The file explorer when collapsed: open it again, or jump to a file. */
const ExplorerRail = ({ onExpand, onQuickOpen }: { onExpand: () => void; onQuickOpen: () => void }) => (
  <div className="hidden md:flex h-full w-12 flex-col items-center gap-2 bg-zinc-900 py-2">
    <button
      onClick={onExpand}
      title="Show files (Ctrl+Shift+E)"
      aria-label="Show files"
      className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
    >
      <PanelLeftOpen size={18} />
    </button>
    <button
      onClick={onExpand}
      title="Explorer"
      aria-label="Explorer"
      className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
    >
      <FolderTree size={18} />
    </button>
    <button
      onClick={onQuickOpen}
      title="Go to file (Ctrl+P)"
      aria-label="Go to file"
      className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
    >
      <Search size={18} />
    </button>
  </div>
);

export default ExplorerRail;
