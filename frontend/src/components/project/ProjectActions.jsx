const ProjectActions = ({
  onLeave,
  onDelete,
  isOwner,
  deletePermissionError,
}) => {
  return (
    <section className="border-t border-white/10 pt-3 space-y-2 shrink-0">
      <button
        onClick={onLeave}
        className="w-full text-left text-sm text-zinc-300 hover:text-white transition-colors"
      >
        Leave Project
      </button>

      {isOwner && (
        <button
          onClick={onDelete}
          className="w-full text-left text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          Delete Project
        </button>
      )}

      {!isOwner && deletePermissionError && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-2 py-1">
          Only the project owner can delete this project.
        </div>
      )}
    </section>
  );
};

export default ProjectActions;
