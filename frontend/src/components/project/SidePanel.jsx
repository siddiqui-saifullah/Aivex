import ProjectMembers from "./ProjectMembers";
import ProjectActions from "./ProjectActions";

const SidePanel = ({
  isOpen,
  project,
  isOwner,
  onAddMember,
  onDelete,
  onLeave,
  invitePermissionError,
  deletePermissionError,
}) => {
  return (
    <div
      className={`
        absolute top-[9vh] left-0
        z-50 w-80
        h-[calc(100vh-18vh)]
        bg-zinc-900
        rounded-xl shadow-xl shadow-black/40
        transition-transform duration-300 ease-out
        border border-white/10
        flex flex-col
        ${isOpen ? "translate-x-90" : "-translate-x-full opacity-70"}
      `}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <p className="text-sm font-semibold text-white truncate">
          {project?.name}
        </p>
        <p className="text-xs text-zinc-400">Stack: {project?.stack}</p>
      </div>

      {/* Body */}
      <div className="flex flex-col h-[calc(100%-3.5rem)] px-4 py-3 overflow-y-auto">
        {/* Members */}
        <ProjectMembers
          project={project}
          isOwner={isOwner}
          onAddMember={onAddMember}
          invitePermissionError={invitePermissionError}
        />

        {/* Actions */}
        <ProjectActions
          isOwner={isOwner}
          onDelete={onDelete}
          onLeave={onLeave}
          deletePermissionError={deletePermissionError}
        />
      </div>
    </div>
  );
};

export default SidePanel;
