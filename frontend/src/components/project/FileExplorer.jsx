import { buildFileTree } from "../../utils/buildFileTree";
import TreeNode from "./TreeNode";
import { useMemo } from "react";

const FileExplorer = ({ fileTree = {}, activeFile, onSelectFile }) => {
  // Build tree structure from fileTree prop
  const tree = useMemo(() => {
    // Only build if fileTree has content
    console.log("[FileExplorer] fileTree prop:", fileTree);
    console.log("[FileExplorer] fileTree keys:", Object.keys(fileTree));

    if (Object.keys(fileTree).length === 0) {
      return {};
    }

    const builtTree = buildFileTree(fileTree);
    console.log("[FileExplorer] Built tree:", builtTree);
    return builtTree;
  }, [fileTree]);

  return (
    <aside className="w-64 bg-zinc-900 border-r border-white/10 flex flex-col">
      {/* Header */}
      <div className="h-12.5 px-4 flex items-center border-b border-white/10">
        <span className="text-sm font-medium text-zinc-200">Explorer</span>
      </div>

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
              fileTree={fileTree}
            />
          ))
        ) : (
          <div className="text-xs text-zinc-500 p-3 text-center">
            No files yet. AI responses will show code here.
          </div>
        )}
      </div>
    </aside>
  );
};

export default FileExplorer;
