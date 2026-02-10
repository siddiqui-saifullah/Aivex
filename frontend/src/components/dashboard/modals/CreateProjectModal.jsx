import { useState } from "react";
import { Type } from "lucide-react";
import InputField from "../../ui/InputField";
import Button from "../../ui/Button";
import { TECH_STACKS } from "../../../constants/options";
import { API_MESSAGES } from "../../../constants/api";

const CreateProjectModal = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState("");
  const [stack, setStack] = useState("React");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Project name cannot be empty");
      return;
    }

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
      setIsLoading(true);
      setError("");

      await onCreate({ name: trimmedName, stack });

      setName("");
      onClose();
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message;

      if (status === 409) {
        setError(API_MESSAGES.PROJECT_NAME_EXISTS);
        return;
      }

      setError(API_MESSAGES.CREATE_FAILED);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameChange = (e) => {
    setName(e.target.value);
    if (error) setError(""); // clear error as user types
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
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white mb-1">
            Create New Project
          </h2>
          <p className="text-sm text-zinc-400">
            Initialize a new containerized environment.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
              Project Name
            </label>

            <InputField
              theme="dark"
              icon={<Type size={18} />}
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="e.g., My Awesome App"
              autoFocus
            />

            {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
          </div>

          {/* Tech Stack */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
              Tech Stack
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TECH_STACKS.map((tech) => (
                <button
                  key={tech}
                  type="button"
                  onClick={() => setStack(tech)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    stack === tech
                      ? "bg-teal-500/10 border-teal-500/50 text-teal-400"
                      : "bg-zinc-900/50 border-white/5 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {tech}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-4">
            <Button
              variant="primary"
              loading={isLoading}
              disabled={isLoading}
              className="w-full"
            >
              Create Project
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

export default CreateProjectModal;
