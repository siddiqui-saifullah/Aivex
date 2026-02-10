import { useState, useEffect } from "react";
import { getFileIcon } from "../../utils/fileIconMap";
import { FolderIcon } from "../../assets/fileIcons";

const AUTO_OPEN_FOLDERS = ["src"];

const TreeNode = ({
  name,
  node,
  path,
  depth = 0,
  activeFile,
  onSelectFile,
  fileTree = {},
}) => {
  const isFile = node.__isFile;
  const [open, setOpen] = useState(false);

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

    return (
      <div
        onClick={() => onSelectFile(path)}
        style={{ paddingLeft }}
        className={`py-1 rounded cursor-pointer flex items-center gap-2
          ${
            activeFile === path
              ? "bg-white/10 text-white"
              : "hover:bg-white/5 text-zinc-300"
          }
        `}
      >
        <FileIcon />
        <span className="truncate">{name}</span>
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
        onClick={() => setOpen((p) => !p)}
        style={{ paddingLeft }}
        className="py-1 cursor-pointer flex items-center gap-2 text-zinc-200 hover:bg-white/5 rounded"
      >
        <FolderIcon open={open} />
        <span className="font-medium">{name}</span>
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
            fileTree={fileTree}
          />
        ))}
    </div>
  );
};

export default TreeNode;
