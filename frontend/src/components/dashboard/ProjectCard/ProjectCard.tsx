import { useNavigate } from "react-router-dom";
import { MoreVertical, Code2, Clock, User, Crown, Atom, Server, Triangle, Globe } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { plural } from "../../../utils/plural";
import ProjectMenu from "./ProjectMenu";
import { useProjectCard } from "./useProjectCard";
import type { MouseEvent } from "react";
import type { Project } from "../../../types";

/** Icon + accent per stack, so projects are recognisable at a glance. */
const STACK_STYLE: Record<string, { icon: LucideIcon; className: string }> = {
  htmlcssjs: { icon: Globe, className: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  react: { icon: Atom, className: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
  nextjs: { icon: Triangle, className: "text-zinc-100 bg-white/5 border-white/15" },
  nodejs: { icon: Server, className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
};

type ProjectAction = (projectId: string, projectName: string) => void;

interface ProjectCardProps {
  project: Project;
  onDelete: ProjectAction;
  onRename: ProjectAction;
  onLeave: ProjectAction;
  isOwner: boolean;
}

const ProjectCard = ({ project, onDelete, onRename, onLeave, isOwner }: ProjectCardProps) => {
  const navigate = useNavigate();
  const { showMenu, setShowMenu, menuRef, formatDate, formatStack } =
    useProjectCard();

  const handleCardClick = () => {
    navigate(`/projects/${project._id}`);
  };

  const handleMenuToggle = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setShowMenu((prev) => !prev);
  };

  const handleRenameClick = () => {
    onRename(project._id, project.name);
    setShowMenu(false);
  };

  const stackStyle = STACK_STYLE[project.stack?.toLowerCase() ?? ""];
  const StackIcon = stackStyle?.icon ?? Code2;

  return (
    <div
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleCardClick();
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={`Open ${project.name}`}
      className="group relative cursor-pointer bg-zinc-900/50 border border-white/5 hover:border-teal-500/30 rounded-xl p-5 transition-all duration-300 hover:bg-zinc-900 hover:shadow-xl hover:shadow-teal-900/10"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 border rounded-lg ${stackStyle?.className ?? "bg-black border-white/10 text-teal-500"}`}>
          <StackIcon size={24} />
        </div>

        <div ref={menuRef} className="relative z-20">
          <button
            onClick={handleMenuToggle}
            aria-label="Project options"
            aria-haspopup="menu"
            aria-expanded={showMenu}
            className="p-1.5 text-zinc-500 hover:text-white rounded-md hover:bg-white/10"
          >
            <MoreVertical size={18} />
          </button>

          <ProjectMenu
            showMenu={showMenu}
            onRename={handleRenameClick}
            onDelete={onDelete}
            onLeave={onLeave}
            projectId={project._id}
            projectName={project.name}
            isOwner={isOwner}
          />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-zinc-100 mb-2 truncate">
        {project.name}
      </h3>

      {/* Meta */}
      <div className="flex items-center gap-3 mb-6">
        {/* The server doesn't track whether a project is running (that happens
            in each viewer's browser), so show the viewer's role instead */}
        <span
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            isOwner
              ? "text-yellow-300 bg-yellow-500/10 border-yellow-500/20"
              : "text-zinc-300 bg-white/5 border-white/10"
          }`}
        >
          {isOwner && <Crown size={12} />}
          {isOwner ? "Owner" : "Member"}
        </span>
        <span className="text-xs text-zinc-500">
          {formatStack(project.stack)}
        </span>
      </div>

      {/* Footer */}
      <div className="space-y-2 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <Clock size={14} />
          <span>Updated {formatDate(project.updatedAt)}</span>
        </div>

        <div className="flex items-center gap-2">
          <User size={14} />
          <span>{plural(project.usersCount ?? project.users?.length ?? 0, "member")}</span>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
