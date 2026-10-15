import { Edit2, Trash2, LogOut } from "lucide-react";

interface ProjectMenuProps {
  showMenu: boolean;
  onRename: () => void;
  onDelete: (projectId: string, projectName: string) => void;
  onLeave: (projectId: string, projectName: string) => void;
  projectId: string;
  projectName: string;
  isOwner: boolean;
}

// Dropdown menu for project actions (rename, delete, leave)
const ProjectMenu = ({
  showMenu,
  onRename,
  onDelete,
  onLeave,
  projectId,
  projectName,
  isOwner,
}: ProjectMenuProps) => {
  if (!showMenu) return null;

  const handleLeaveClick = () => {
    onLeave(projectId, projectName);
  };

  return (
    <div
      className="absolute right-0 top-8 w-40 bg-zinc-950 border border-white/10 rounded-lg shadow-xl z-50"
      onClick={(e) => e.stopPropagation()}
    >
      {isOwner && (
        <>
          <button
            onClick={onRename}
            className="w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 flex items-center gap-2"
          >
            <Edit2 size={14} /> Rename
          </button>
          <button
            onClick={() => onDelete(projectId, projectName)}
            className="w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 border-t border-white/5"
          >
            <Trash2 size={14} /> Delete
          </button>
        </>
      )}
      {/* Owners can't leave; they rename/delete (or transfer ownership in the project) */}
      {!isOwner && (
        <button
          onClick={handleLeaveClick}
          className="w-full px-4 py-2.5 text-sm text-yellow-400 hover:bg-yellow-500/10 flex items-center gap-2"
        >
          <LogOut size={14} /> Leave
        </button>
      )}
    </div>
  );
};

export default ProjectMenu;
