import { createElement, useState, type KeyboardEvent } from "react";
import { getFileIcon } from "../../utils/fileIconMap";
import { FolderIcon } from "../../assets/fileIcons";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import type { TreeNodeData } from "../../utils/buildFileTree";
import type { FileItemType } from "../../types";

interface TreeNodeProps {
  name: string;
  node: TreeNodeData;
  path: string;
  depth?: number;
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  onCreateInFolder: (path: string) => void;
  onDeleteItem: (path: string, type: FileItemType) => void;
  /** Returns false if the rename was rejected (name taken, invalid). */
  onRenameItem: (path: string, newName: string) => boolean | Promise<boolean>;
}

const AUTO_OPEN_FOLDERS = ["src"];
const VALID_NAME = /^[a-zA-Z0-9._-]+$/;

const iconButton =
  "p-1 rounded text-zinc-500 transition opacity-0 group-hover:opacity-100 focus:opacity-100";

const TreeNode = ({
  name,
  node,
  path,
  depth = 0,
  activeFile,
  onSelectFile,
  onCreateInFolder,
  onDeleteItem,
  onRenameItem,
}: TreeNodeProps) => {
  const isFile = node.__isFile;
  // auto-open important folders and the folders containing the open file
  const [open, setOpen] = useState(
    () =>
      !isFile &&
      (AUTO_OPEN_FOLDERS.includes(name) || Boolean(activeFile?.startsWith(path + "/"))),
  );
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [renameError, setRenameError] = useState("");

  const paddingLeft = 12 + depth * 14;
  const isSystemFile = name === ".aivex";

  const startRename = () => {
    setDraftName(name);
    setRenameError("");
    setIsRenaming(true);
  };

  const commitRename = async () => {
    const next = draftName.trim();
    if (!next || next === name) {
      setIsRenaming(false);
      return;
    }
    if (!VALID_NAME.test(next)) {
      setRenameError("Use letters, numbers, . _ -");
      return;
    }
    if (await onRenameItem(path, next)) {
      setIsRenaming(false);
    } else {
      setRenameError("Name already exists");
    }
  };

  const handleRenameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setIsRenaming(false);
  };

  const renameInput = (
    <div className="flex-1 min-w-0">
      <input
        value={draftName}
        onChange={(e) => {
          setDraftName(e.target.value);
          setRenameError("");
        }}
        onKeyDown={handleRenameKey}
        onBlur={() => setIsRenaming(false)}
        onClick={(e) => e.stopPropagation()}
        autoFocus
        onFocus={(e) => {
          // Select the name without its extension, like VS Code
          const dot = e.target.value.lastIndexOf(".");
          e.target.setSelectionRange(0, dot > 0 && isFile ? dot : e.target.value.length);
        }}
        aria-label={`Rename ${name}`}
        className="w-full bg-zinc-800 border border-teal-500/60 rounded px-1 text-sm text-zinc-100 focus:outline-none"
      />
      {renameError && <p className="text-[11px] text-red-400">{renameError}</p>}
    </div>
  );

  /* ---------- FILE ---------- */
  if (isFile) {
    // Icons are static module-level components; pick one by file name
    const fileIcon = createElement(getFileIcon(name));

    return (
      <div
        role="treeitem"
        aria-selected={activeFile === path}
        tabIndex={isSystemFile ? -1 : 0}
        onClick={() => {
          if (!isSystemFile && !isRenaming) onSelectFile(path);
        }}
        onKeyDown={(e) => {
          if (isRenaming || isSystemFile) return;
          if (e.key === "Enter") onSelectFile(path);
          if (e.key === "F2") startRename();
        }}
        style={{ paddingLeft }}
        className={`py-1 pr-1 rounded flex items-center gap-2 group outline-none focus-visible:ring-1 focus-visible:ring-teal-500/60
          ${isSystemFile ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
          ${activeFile === path ? "bg-white/10 text-white" : "hover:bg-white/5 text-zinc-300"}
        `}
        title={isSystemFile ? "System file - read only" : path}
      >
        {fileIcon}
        {isRenaming ? renameInput : <span className="truncate flex-1">{name}</span>}

        {!isSystemFile && !isRenaming && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                startRename();
              }}
              className={`${iconButton} hover:bg-white/10 hover:text-zinc-200`}
              title="Rename (F2)"
              aria-label={`Rename ${name}`}
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteItem(path, "file");
              }}
              className={`${iconButton} hover:bg-red-500/20 hover:text-red-400`}
              title="Delete file"
              aria-label={`Delete ${name}`}
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    );
  }

  /* ---------- FOLDER ---------- */
  const entries = Object.entries(node.__children);

  const folders = entries
    .filter(([, n]) => !n.__isFile)
    .sort(([a], [b]) => a.localeCompare(b));
  const files = entries
    .filter(([, n]) => n.__isFile)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div role="treeitem" aria-expanded={open}>
      <div
        tabIndex={0}
        onClick={() => !isRenaming && setOpen((p) => !p)}
        onKeyDown={(e) => {
          if (isRenaming) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((p) => !p);
          }
          if (e.key === "F2") startRename();
        }}
        className="py-1 pr-1 cursor-pointer flex items-center gap-1.5 text-zinc-200 hover:bg-white/5 rounded group outline-none focus-visible:ring-1 focus-visible:ring-teal-500/60"
        style={{ paddingLeft: paddingLeft - 6 }}
      >
        <ChevronRight
          size={12}
          className={`shrink-0 text-zinc-500 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <FolderIcon open={open} />
        {isRenaming ? renameInput : <span className="font-medium flex-1 truncate">{name}</span>}

        {!isRenaming && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(true);
                onCreateInFolder(path);
              }}
              className={`${iconButton} hover:bg-teal-500/20 hover:text-teal-400`}
              title="New file/folder here"
              aria-label={`New file in ${name}`}
            >
              <Plus size={13} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                startRename();
              }}
              className={`${iconButton} hover:bg-white/10 hover:text-zinc-200`}
              title="Rename (F2)"
              aria-label={`Rename ${name}`}
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteItem(path, "folder");
              }}
              className={`${iconButton} hover:bg-red-500/20 hover:text-red-400`}
              title="Delete folder"
              aria-label={`Delete ${name}`}
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>

      {open && (
        <div role="group">
          {[...folders, ...files].map(([childName, childNode]) => (
            <TreeNode
              key={childName}
              name={childName}
              node={childNode}
              path={`${path}/${childName}`}
              depth={depth + 1}
              activeFile={activeFile}
              onSelectFile={onSelectFile}
              onCreateInFolder={onCreateInFolder}
              onDeleteItem={onDeleteItem}
              onRenameItem={onRenameItem}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeNode;
