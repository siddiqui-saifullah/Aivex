import { Trash2, AlertCircle } from "lucide-react";

const DeleteConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType = "file",
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-white/10 rounded-lg p-6 w-96 shadow-xl">
        {/* Icon and Title */}
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle size={24} className="text-red-500" />
          <h2 className="text-lg font-semibold text-zinc-100">
            Delete {itemType === "file" ? "File" : "Folder"}?
          </h2>
        </div>

        {/* Message */}
        <div className="mb-6">
          <p className="text-sm text-zinc-400 mb-2">
            Are you sure you want to delete:
          </p>
          <div className="bg-zinc-800 border border-red-500/20 rounded p-3">
            <code className="text-sm text-amber-300 break-all">{itemName}</code>
          </div>
          {itemType === "folder" && (
            <p className="text-xs text-red-400 mt-2">
              ⚠️ All files and subfolders will be deleted permanently.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded border border-white/10 text-zinc-300 hover:bg-white/5 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 rounded bg-red-500/80 text-white font-medium hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2"
          >
            <Trash2 size={16} />
            {isLoading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
