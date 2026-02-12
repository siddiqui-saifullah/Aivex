import { useState, useEffect } from "react";
import { getFileIcon } from "../../utils/fileIconMap";
import { FolderIcon } from "../../assets/fileIcons";
import { MoreVertical, Plus, Trash2 } from "lucide-react";

const AUTO_OPEN_FOLDERS = ["src"];

const TreeNode = ({
  name,
  node,
  path,
  depth = 0,
  activeFile,
  onSelectFile,
  onCreateInFolder,
  onDeleteItem,
  fileTree = {},
}) => {
  const isFile = node.__isFile;
  const [open, setOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // auto-open important folders
  useEffect(() => {
    if (!isFile && AUTO_OPEN_FOLDERS.includes(name)) {
      setOpen(true);
    }
  }, [isFile, name]);

  const paddingLeft = 12 + depth * 14;

  /* ---------- FILE ---------- */
  if (isFile) {
    const FileIcon = getFileIcon(name);
    const isSystemFile = name === ".aivex";

    return (
      <div
        onClick={() => {
          if (!isSystemFile) onSelectFile(path);
        }}
        style={{ paddingLeft }}
        className={`py-1 rounded flex items-center gap-2 group
          ${isSystemFile ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
          ${
            activeFile === path
              ? "bg-white/10 text-white"
              : "hover:bg-white/5 text-zinc-300"
          }
        `}
        title={isSystemFile ? "System file - read only" : ""}
      >
        <FileIcon />
        <span className="truncate flex-1">{name}</span>

        {/* Delete Button - Show on hover (but not for system files) */}
        {!isSystemFile && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteItem(path, "file");
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition"
            title="Delete file"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    );
  }

  /* ---------- FOLDER ---------- */
  const entries = Object.entries(node.__children);

  const folders = entries.filter(([, n]) => !n.__isFile);
  const files = entries.filter(([, n]) => n.__isFile);

  return (
    <div>
      <div
        className="py-1 cursor-pointer flex items-center gap-2 text-zinc-200 hover:bg-white/5 rounded group relative"
        style={{ paddingLeft }}
      >
        <FolderIcon open={open} />
        <span className="font-medium flex-1" onClick={() => setOpen((p) => !p)}>
          {name}
        </span>

        {/* Context Menu Button */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateInFolder(path);
            }}
            className="p-1 rounded hover:bg-teal-500/20 text-zinc-500 hover:text-teal-400 transition"
            title="Create file/folder here"
          >
            <Plus size={14} />
          </button>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-200 transition"
              title="More options"
            >
              <MoreVertical size={14} />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute right-0 mt-1 w-40 bg-zinc-800 border border-white/10 rounded-lg shadow-lg z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteItem(path, "folder");
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 rounded-lg transition"
                >
                  <Trash2 size={14} />
                  Delete Folder
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {open &&
        [...folders, ...files].map(([childName, childNode]) => (
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
            fileTree={fileTree}
          />
        ))}
    </div>
  );
};

export default TreeNode;
