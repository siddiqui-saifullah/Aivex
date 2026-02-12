import { buildFileTree } from "../../utils/buildFileTree";
import TreeNode from "./TreeNode";
import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import CreateFileModal from "./CreateFileModal";

const FileExplorer = ({
  fileTree = {},
  activeFile,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  emptyFolders = new Set(),
}) => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState("");
  const [inlineInput, setInlineInput] = useState("");
  const [inlineMode, setInlineMode] = useState(null); // null, "file", "folder"
  const [inlineError, setInlineError] = useState("");

  // Build tree structure from fileTree prop
  const tree = useMemo(() => {
    console.log("[FileExplorer] fileTree prop:", fileTree);
    console.log("[FileExplorer] fileTree keys:", Object.keys(fileTree));

    if (Object.keys(fileTree).length === 0 && emptyFolders.size === 0) {
      return {};
    }

    const builtTree = buildFileTree(fileTree, Array.from(emptyFolders));
    console.log("[FileExplorer] Built tree:", builtTree);
    return builtTree;
  }, [fileTree, emptyFolders]);

  const handleCreateClick = (folderPath) => {
    setSelectedPath(folderPath);
    setInlineMode("file");
    setInlineInput("");
    setInlineError("");
  };

  const handleInlineCreate = () => {
    if (!inlineInput.trim()) {
      setInlineError("Name cannot be empty");
      return;
    }

    // Validate name
    if (!/^[a-zA-Z0-9._\-]+$/.test(inlineInput)) {
      setInlineError("Invalid characters");
      return;
    }

    if (inlineMode === "file" && !inlineInput.includes(".")) {
      setInlineError("File must have an extension");
      return;
    }

    const fullPath = selectedPath
      ? `${selectedPath}/${inlineInput}`
      : inlineInput;

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
    <aside className="w-64 bg-zinc-900 border-r border-white/10 flex flex-col">
      {/* Header */}
      <div className="h-12.5 px-4 flex items-center justify-between border-b border-white/10">
        <span className="text-sm font-medium text-zinc-200">Explorer</span>
        <button
          onClick={() => {
            setSelectedPath("");
            setInlineMode("file");
            setInlineInput("");
            setInlineError("");
          }}
          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition"
          title="Create file or folder"
        >
          <Plus size={18} />
        </button>
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
      <div className="flex-1 overflow-y-auto px-1 py-2 text-sm">
        {Object.keys(tree).length > 0 ? (
          Object.entries(tree).map(([name, node]) => (
            <TreeNode
              key={name}
              name={name}
              node={node}
              path={name}
              activeFile={activeFile}
              onSelectFile={onSelectFile}
              onCreateInFolder={handleCreateClick}
              onDeleteItem={onDeleteFile}
              fileTree={fileTree}
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
