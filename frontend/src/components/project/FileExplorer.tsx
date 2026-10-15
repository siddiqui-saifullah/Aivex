import { buildFileTree } from "../../utils/buildFileTree";
import TreeNode from "./TreeNode";
import { useMemo, useState } from "react";
import { Download, Plus, X } from "lucide-react";
import type { CreateFilePayload, FileItemType, FlatFileTree } from "../../types";

interface FileExplorerProps {
  fileTree?: FlatFileTree;
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  onCreateFile: (payload: CreateFilePayload) => void;
  onDeleteFile: (path: string, type: FileItemType) => void;
  onRenameItem: (path: string, newName: string) => boolean | Promise<boolean>;
  onDownload: () => void;
  className?: string;
}

const FileExplorer = ({
  fileTree = {},
  activeFile,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onRenameItem,
  onDownload,
  className = "",
}: FileExplorerProps) => {
  const [selectedPath, setSelectedPath] = useState("");
  const [inlineInput, setInlineInput] = useState("");
  const [inlineMode, setInlineMode] = useState<FileItemType | null>(null);
  const [inlineError, setInlineError] = useState("");

  // Build tree structure from fileTree prop
  const tree = useMemo(() => {
    if (Object.keys(fileTree).length === 0) {
      return {};
    }

    return buildFileTree(fileTree);
  }, [fileTree]);

  // Folders first, then files, alphabetically (like most editors)
  const rootEntries = useMemo(
    () =>
      Object.entries(tree).sort(([a, na], [b, nb]) =>
        na.__isFile === nb.__isFile ? a.localeCompare(b) : na.__isFile ? 1 : -1,
      ),
    [tree],
  );

  const handleCreateClick = (folderPath: string) => {
    setSelectedPath(folderPath);
    setInlineMode("file");
    setInlineInput("");
    setInlineError("");
  };

  const handleInlineCreate = () => {
    if (!inlineMode) return;

    if (!inlineInput.trim()) {
      setInlineError("Name cannot be empty");
      return;
    }

    // Validate name
    if (!/^[a-zA-Z0-9._-]+$/.test(inlineInput)) {
      setInlineError("Invalid characters");
      return;
    }

    if (inlineMode === "file" && !inlineInput.includes(".")) {
      setInlineError("File must have an extension");
      return;
    }

    onCreateFile({
      name: inlineInput,
      type: inlineMode,
      path: selectedPath,
    });

    setInlineInput("");
    setInlineMode(null);
    setInlineError("");
  };

  return (
    <aside className={`bg-zinc-900 border-r border-white/10 flex flex-col ${className}`}>
      {/* Header */}
      <div className="h-12.5 px-4 flex items-center justify-between border-b border-white/10">
        <span className="text-sm font-medium text-zinc-200">Explorer</span>
        <div className="flex items-center gap-1">
        <button
          onClick={onDownload}
          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition"
          title="Download project as .zip"
          aria-label="Download project as zip"
        >
          <Download size={16} />
        </button>
        <button
          onClick={() => {
            setSelectedPath("");
            setInlineMode("file");
            setInlineInput("");
            setInlineError("");
          }}
          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition"
          title="Create file or folder"
          aria-label="Create file or folder"
        >
          <Plus size={18} />
        </button>
        </div>
      </div>

      {/* Inline Input for File/Folder Creation */}
      {inlineMode && (
        <div className="px-2 py-2 border-b border-white/10 bg-zinc-800/50">
          {selectedPath && (
            <div className="mb-2">
              <label className="text-xs text-zinc-500">Location:</label>
              <div className="text-xs text-zinc-400 mb-2">{selectedPath}/</div>
            </div>
          )}
          <div className="flex gap-1 mb-2">
            <button
              onClick={() => {
                setInlineMode("file");
                setInlineError("");
              }}
              className={`text-xs px-2 py-1 rounded transition ${
                inlineMode === "file"
                  ? "bg-teal-500 text-black"
                  : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
              }`}
            >
              File
            </button>
            <button
              onClick={() => {
                setInlineMode("folder");
                setInlineError("");
              }}
              className={`text-xs px-2 py-1 rounded transition ${
                inlineMode === "folder"
                  ? "bg-teal-500 text-black"
                  : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
              }`}
            >
              Folder
            </button>
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={inlineInput}
              onChange={(e) => {
                setInlineInput(e.target.value);
                setInlineError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleInlineCreate();
                if (e.key === "Escape") {
                  setInlineMode(null);
                  setInlineInput("");
                }
              }}
              placeholder={inlineMode === "file" ? "app.js" : "folder-name"}
              className="flex-1 px-2 py-1 bg-zinc-700 border border-white/10 rounded text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-teal-500"
              autoFocus
            />
            <button
              onClick={() => {
                setInlineMode(null);
                setInlineInput("");
              }}
              className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200"
            >
              <X size={14} />
            </button>
          </div>
          {inlineError && (
            <p className="text-xs text-red-400 mt-1">{inlineError}</p>
          )}
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-1 py-2 text-sm" role="tree" aria-label="Project files">
        {rootEntries.length > 0 ? (
          rootEntries.map(([name, node]) => (
            <TreeNode
              key={name}
              name={name}
              node={node}
              path={name}
              activeFile={activeFile}
              onSelectFile={onSelectFile}
              onCreateInFolder={handleCreateClick}
              onDeleteItem={onDeleteFile}
              onRenameItem={onRenameItem}
            />
          ))
        ) : (
          <div className="text-xs text-zinc-500 p-3 text-center">
            No files yet. Create one or get responses from AI.
          </div>
        )}
      </div>
    </aside>
  );
};

export default FileExplorer;
