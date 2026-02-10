import { LogOut, Crown } from "lucide-react";
import Button from "../../ui/Button";
import { API_MESSAGES } from "../../../constants/api";

const LeaveProjectModal = ({
  isOpen,
  onClose,
  onConfirm,
  projectName,
  isLoading,
  isOwner = false,
}) => {
  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (isOwner) return; // hard guard
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error("Leave project failed:", error);
    }
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
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div
            className={`shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
              isOwner ? "bg-red-500/10" : "bg-yellow-500/10"
            }`}
          >
            {isOwner ? (
              <Crown size={24} className="text-red-400" />
            ) : (
              <LogOut size={24} className="text-yellow-400" />
            )}
          </div>

          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">
              {isOwner ? "Owner Restriction" : "Leave Project"}
            </h2>

            <p className="text-sm mt-1 text-zinc-400">
              {isOwner
                ? "Project owners cannot leave their own project."
                : (API_MESSAGES.CONFIRM_LEAVE ??
                  "Are you sure you want to leave this project?")}
            </p>
          </div>
        </div>

        {/* Info / Warning Box */}
        <div
          className={`border rounded-lg p-3 mb-6 ${
            isOwner
              ? "bg-red-500/5 border-red-500/20"
              : "bg-yellow-500/5 border-yellow-500/20"
          }`}
        >
          <p
            className={`text-sm ${
              isOwner ? "text-red-400" : "text-yellow-300"
            }`}
          >
            <strong>Project:</strong> {projectName}
          </p>

          <p
            className={`text-xs mt-2 ${
              isOwner ? "text-red-400/70" : "text-yellow-300/70"
            }`}
          >
            {isOwner
              ? "Transfer ownership or delete the project to proceed."
              : "You will lose access unless re-invited by the owner."}
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            variant="primary"
            disabled={isLoading || isOwner}
            loading={isLoading && !isOwner}
            onClick={handleConfirm}
            className={`w-full ${
              isOwner
                ? "bg-red-500/20 text-red-400 cursor-not-allowed"
                : "bg-yellow-500 hover:bg-yellow-600 text-black"
            }`}
          >
            {isOwner ? "Owner Cannot Leave" : "Leave Project"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="w-full text-zinc-500 hover:text-zinc-300"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LeaveProjectModal;
