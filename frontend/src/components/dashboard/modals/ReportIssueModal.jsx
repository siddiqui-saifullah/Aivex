import { useState, useContext } from "react";
import {
  X,
  AlertCircle,
  MessageSquare,
  Lightbulb,
  Loader2,
  Send,
  Bug,
} from "lucide-react";
import { reportIssue } from "../../../services/project.service";
import { UserContext } from "../../../context/user.context";
import { useToast } from "../../../context/toast.context";

const ReportIssueModal = ({ isOpen, onClose, projectId }) => {
  const { user } = useContext(UserContext);
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    type: "bug",
    title: "",
    description: "",
    severity: "medium",
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    try {
      const contextData = {
        url: window.location.href,
        userAgent: navigator.userAgent,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        timestamp: new Date().toISOString(),
      };

      await reportIssue(projectId, {
        ...formData,
        context: contextData,
      });

      toast.success("Report submitted successfully!");
      onClose();
      setFormData({
        type: "bug",
        title: "",
        description: "",
        severity: "medium",
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      {/* Reduced max-width to max-w-md for a more concise look */}
      <div
        className="w-full max-w-md bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/80 overflow-hidden animate-scale-in transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Compact padding */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/5">
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <div className="p-1 rounded-md bg-teal-500/10 text-teal-400">
              <AlertCircle size={16} />
            </div>
            Report Issue
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-all duration-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form - Compact padding and spacing */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type Selection - Consized Buttons */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Issue Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <TypeButton
                active={formData.type === "bug"}
                onClick={() => setFormData({ ...formData, type: "bug" })}
                icon={<Bug size={16} />}
                label="Bug"
                activeColor="border-red-500/40 bg-red-500/10 text-red-400"
              />
              <TypeButton
                active={formData.type === "feature"}
                onClick={() => setFormData({ ...formData, type: "feature" })}
                icon={<Lightbulb size={16} />}
                label="Feature"
                activeColor="border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
              />
              <TypeButton
                active={formData.type === "feedback"}
                onClick={() => setFormData({ ...formData, type: "feedback" })}
                icon={<MessageSquare size={16} />}
                label="Feedback"
                activeColor="border-blue-500/40 bg-blue-500/10 text-blue-400"
              />
            </div>
          </div>

          <div className="space-y-3">
            {/* Title Input */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">
                Subject
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder={
                  formData.type === "bug"
                    ? "Briefly describe the error..."
                    : "Title of your request..."
                }
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/40 transition-all"
              />
            </div>

            {/* Severity (Only show for bugs) */}
            {formData.type === "bug" && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-400">
                  Severity
                </label>
                <div className="relative">
                  <select
                    value={formData.severity}
                    onChange={(e) =>
                      setFormData({ ...formData, severity: e.target.value })
                    }
                    className="w-full appearance-none bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/40 transition-all cursor-pointer"
                  >
                    <option value="low">Low - Minor cosmetic</option>
                    <option value="medium">Medium - Annoying</option>
                    <option value="high">High - Broken feature</option>
                    <option value="critical">Critical - Crash</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600">
                    <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {/* Description Input */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">
                Details
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
                placeholder="Steps to reproduce or details..."
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/40 transition-all resize-none leading-relaxed custom-scrollbar"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-linear-to-r from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/20 hover:shadow-teal-500/40 hover:scale-[1.02] active:scale-95 flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Helper Component for Type Selection
const TypeButton = ({ active, onClick, icon, label, activeColor }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center justify-center gap-2 px-2 py-2.5 rounded-lg border transition-all duration-200 group ${
      active
        ? `${activeColor} shadow-md ring-1 ring-inset ring-white/5`
        : "bg-black/20 border-white/5 text-zinc-500 hover:bg-white/5 hover:border-white/10 hover:text-zinc-300"
    }`}
  >
    <div
      className={`transition-transform duration-200 ${active ? "scale-105" : "group-hover:scale-105"}`}
    >
      {icon}
    </div>
    <span className="text-xs font-medium">{label}</span>
  </button>
);

export default ReportIssueModal;
