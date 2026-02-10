import { Trash2 } from "lucide-react";
import Button from "../../ui/Button";
import { API_MESSAGES } from "../../../constants/api";

const DeleteProjectModal = ({ isOpen, onClose, onConfirm, projectName, isLoading }) => {
  if (!isOpen) return null;

  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-6">
          <div className="shrink-0 w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center">
            <Trash2 size={24} className="text-red-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">
              Delete Project
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              {API_MESSAGES.CONFIRM_DELETE}
            </p>
          </div>
        </div>

        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-6">
          <p className="text-sm text-red-400">
            <strong>Project:</strong> {projectName}
          </p>
          <p className="text-xs text-red-400/70 mt-2">
            This action cannot be undone.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            variant="primary"
            loading={isLoading}
            disabled={isLoading}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            onClick={handleConfirm}
          >
            {isLoading ? "Deleting..." : "Delete Project"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            className="w-full text-zinc-500 hover:text-zinc-300"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DeleteProjectModal;
