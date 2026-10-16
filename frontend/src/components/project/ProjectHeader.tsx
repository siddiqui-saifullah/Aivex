import { GraduationCap, Users, X } from "lucide-react";
import { Link } from "react-router-dom";
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
        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
          {project?.classroom ? (
            project.isOwner ? (
              <span className="flex items-center gap-1 text-teal-300/80">
                <GraduationCap size={12} /> Class project
              </span>
            ) : (
              // The teacher is viewing a student's work
              <Link to={`/classes/${project.classroom}`} className="flex items-center gap-1 text-teal-300 hover:underline">
                <GraduationCap size={12} /> Student work · back to class
              </Link>
            )
          ) : (
            plural(project?.users?.length || 0, "member")
          )}
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
