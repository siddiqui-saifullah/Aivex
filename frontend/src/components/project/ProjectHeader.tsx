import { Users, X } from "lucide-react";
import type { ProjectDetails } from "../../types";
import { plural } from "../../utils/plural";

interface ProjectHeaderProps {
  project: ProjectDetails | null;
  isSidePanelOpen: boolean;
  onToggleSidePanel: () => void;
}

const ProjectHeader = ({ project, isSidePanelOpen, onToggleSidePanel }: ProjectHeaderProps) => {
  return (
    <header className="h-14 shrink-0 px-3 flex items-center justify-between border-b border-white/10">
      {/* Left: Project Info */}
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-sm font-medium text-white truncate">
          {project?.name}
        </span>
        <span className="text-xs text-zinc-500">
          {plural(project?.users?.length || 0, "member")}
        </span>
      </div>

      {/* Right: Actions */}
      <button
        onClick={onToggleSidePanel}
        data-sidepanel-toggle
        title={isSidePanelOpen ? "Close members" : "Members & settings"}
        aria-label={isSidePanelOpen ? "Close members panel" : "Open members panel"}
        aria-expanded={isSidePanelOpen}
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
