import UserTile from "../shared/UserTile";

const ProjectMembers = ({ project, isOwner, onAddMember, invitePermissionError }) => {
  return (
    <section className="flex-1 min-h-0 overflow-y-auto">
      <h4 className="text-xs uppercase text-zinc-500 mb-2">
        Members ({project?.users?.length || 0})
      </h4>

      <div className="space-y-2">
        {project?.users?.map((user) => (
          <UserTile
            key={user._id}
            user={user}
            isOwner={user._id === project.owner?._id || user._id === project.owner}
          />
        ))}
      </div>

      <button
        onClick={onAddMember}
        className="mt-3 w-full text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors"
      >
        + Add Member
      </button>

      {!isOwner && invitePermissionError && (
        <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-2 py-1">
          Only the project owner can add members.
        </div>
      )}
    </section>
  );
};

export default ProjectMembers;
