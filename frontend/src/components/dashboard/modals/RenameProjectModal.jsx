import { useState, useEffect } from "react";
import { Edit2 } from "lucide-react";
import InputField from "../../ui/InputField";
import Button from "../../ui/Button";
import { API_MESSAGES } from "../../../constants/api";

const RenameProjectModal = ({
  isOpen,
  onClose,
  onConfirm,
  projectName,
  isLoading,
}) => {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && projectName) {
      setNewName(projectName);
      setError("");
    }
  }, [isOpen, projectName]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = newName.trim();

    if (!trimmedName) {
      setError("Project name cannot be empty");
      return;
    }

    if (trimmedName === projectName) {
      setError("New name is the same as current name");
      return;
    }

    // Validate length (min 3, max 50)
    if (trimmedName.length < 3) {
      setError("Project name must be at least 3 characters");
      return;
    }
    if (trimmedName.length > 50) {
      setError("Project name must not exceed 50 characters");
      return;
    }

    // Validate characters - allow alphanumeric, spaces, hyphens, underscores
    const validNameRegex = /^[a-zA-Z0-9\s\-_]+$/;
    if (!validNameRegex.test(trimmedName)) {
      setError(
        "Project name can only contain letters, numbers, spaces, hyphens, and underscores",
      );
      return;
    }

    try {
      setError("");
      await onConfirm(trimmedName);
    } catch (err) {
      const status = err.response?.status;
      if (status === 409) {
        setError(API_MESSAGES.PROJECT_NAME_EXISTS);
      } else {
        setError("Failed to rename project. Please try again.");
      }
    }
  };

  const handleNameChange = (e) => {
    setNewName(e.target.value);
    if (error) setError("");
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
          <div className="shrink-0 w-12 h-12 bg-teal-500/10 rounded-lg flex items-center justify-center">
            <Edit2 size={24} className="text-teal-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">Rename Project</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Update your project name
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Current Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
              Current Name
            </label>
            <div className="px-3 py-2 bg-zinc-900/50 border border-white/5 rounded-lg text-sm text-zinc-300">
              {projectName}
            </div>
          </div>

          {/* New Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
              New Name
            </label>

            <InputField
              theme="dark"
              icon={<Edit2 size={18} />}
              type="text"
              value={newName}
              onChange={handleNameChange}
              placeholder="Enter new project name"
              autoFocus
            />

            <p className="mt-2 text-[11px] text-zinc-500">
              <span className="text-amber-500/80 font-medium">Note:</span> You
              can only change this name once every 24 hours.
            </p>

            {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-4">
            <Button
              variant="primary"
              loading={isLoading}
              disabled={isLoading || newName.trim() === projectName}
              className="w-full"
            >
              {isLoading ? "Renaming..." : "Rename Project"}
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
        </form>
      </div>
    </div>
  );
};

export default RenameProjectModal;
