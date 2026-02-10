import { useNavigate } from "react-router-dom";
import { MoreVertical, Code2, Clock, User } from "lucide-react";
import StatusBadge from "../StatusBadge";
import ProjectMenu from "./ProjectMenu";
import { useProjectCard } from "./useProjectCard";

const ProjectCard = ({ project, onDelete, onRename, onLeave, isOwner }) => {
  const navigate = useNavigate();
  const { showMenu, setShowMenu, menuRef, formatDate, formatStack } =
    useProjectCard();

  const handleCardClick = () => {
    navigate(`/projects/${project._id}`);
  };

  const handleMenuToggle = (e) => {
    e.stopPropagation();
    setShowMenu((prev) => !prev);
  };

  const handleRenameClick = () => {
    onRename(project._id, project.name);
    setShowMenu(false);
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative cursor-pointer bg-zinc-900/50 border border-white/5 hover:border-teal-500/30 rounded-xl p-5 transition-all duration-300 hover:bg-zinc-900 hover:shadow-xl hover:shadow-teal-900/10"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-black border border-white/10 rounded-lg text-teal-500">
          <Code2 size={24} />
        </div>

        <div ref={menuRef} className="relative z-20">
          <button
            onClick={handleMenuToggle}
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
        <StatusBadge status={project.status} />
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
          <span>{project.usersCount ?? project.users?.length ?? 0} users</span>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
