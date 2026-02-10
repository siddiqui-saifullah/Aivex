import { Users, X } from "lucide-react";

const ProjectHeader = ({ project, isSidePanelOpen, onToggleSidePanel }) => {
  return (
    <header className="h-14 shrink-0 px-3 flex items-center justify-between border-b border-white/10">
      {/* Left: Project Info */}
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-medium text-white truncate">
          {project?.name}
        </span>
        <span className="text-xs text-zinc-500">
          {project?.users?.length || 0} members
        </span>
      </div>

      {/* Right: Actions */}
      <button
        onClick={onToggleSidePanel}
        className="p-2 rounded-lg hover:bg-white/5 transition-colors"
      >
        {isSidePanelOpen ? (
          <X size={18} className="text-zinc-400" />
        ) : (
          <Users size={18} className="text-zinc-400" />
        )}
      </button>
    </header>
  );
};

export default ProjectHeader;
