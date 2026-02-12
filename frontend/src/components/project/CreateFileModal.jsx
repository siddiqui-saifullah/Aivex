import { useState } from "react";
import { X, File, Folder } from "lucide-react";

const CreateFileModal = ({ isOpen, onClose, onCreate, currentPath = "" }) => {
  const [name, setName] = useState("");
  const [type, setType] = useState("file"); // "file" or "folder"
  const [error, setError] = useState("");

  const handleCreate = () => {
    if (!name.trim()) {
      setError("Name cannot be empty");
      return;
    }

    // Validate filename/folder name
    if (!/^[a-zA-Z0-9._\-/]+$/.test(name)) {
      setError(
        "Invalid characters. Use only letters, numbers, dots, hyphens, and underscores",
      );
      return;
    }

    if (type === "file" && !name.includes(".")) {
      setError("File must have an extension (e.g., .js, .html)");
      return;
    }

    onCreate({
      name: name.trim(),
      type,
      path: currentPath,
    });

    setName("");
    setType("file");
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-white/10 rounded-lg p-6 w-96 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-100">
            Create New {type === "file" ? "File" : "Folder"}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Type Selector */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              setType("file");
              setError("");
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded transition ${
              type === "file"
                ? "bg-teal-500/20 text-teal-300 border border-teal-500/50"
                : "bg-zinc-800 text-zinc-400 border border-white/10 hover:bg-zinc-700"
            }`}
          >
            <File size={16} />
            File
          </button>
          <button
            onClick={() => {
              setType("folder");
              setError("");
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded transition ${
              type === "folder"
                ? "bg-teal-500/20 text-teal-300 border border-teal-500/50"
                : "bg-zinc-800 text-zinc-400 border border-white/10 hover:bg-zinc-700"
            }`}
          >
            <Folder size={16} />
            Folder
          </button>
        </div>

        {/* Input */}
        <div className="mb-4">
          {currentPath && (
            <div className="mb-2">
              <label className="text-xs text-zinc-500">Path</label>
              <div className="text-sm text-zinc-400 bg-zinc-800 p-2 rounded border border-white/5">
                {currentPath}/
              </div>
            </div>
          )}
          <label className="block text-xs text-zinc-500 mb-2">
            {type === "file" ? "Filename with extension" : "Folder name"}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") onClose();
            }}
            placeholder={type === "file" ? "index.js" : "my-folder"}
            className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-teal-500/50 focus:bg-zinc-800"
            autoFocus
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-white/10 text-zinc-300 hover:bg-white/5 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded bg-teal-500 text-black font-medium hover:bg-teal-400 transition"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateFileModal;
