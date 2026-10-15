import { useState } from "react";
import { Crown, UserMinus } from "lucide-react";
import UserTile from "../shared/UserTile";
import type { ProjectDetails, User } from "../../types";

type MemberAction = "transfer" | "remove";

interface ProjectMembersProps {
  project: ProjectDetails | null;
  isOwner: boolean;
  currentUserId?: string;
  onAddMember: () => void;
  onTransferOwnership?: (member: User) => Promise<void>;
  onRemoveMember?: (member: User) => Promise<void>;
  invitePermissionError?: boolean;
}

const ACTION_LABELS: Record<MemberAction, string> = {
  transfer: "Make owner",
  remove: "Remove",
};

const ProjectMembers = ({
  project,
  isOwner,
  currentUserId,
  onAddMember,
  onTransferOwnership,
  onRemoveMember,
  invitePermissionError,
}: ProjectMembersProps) => {
  const ownerId = typeof project?.owner === "string" ? project.owner : project?.owner?._id;

  // Destructive actions need a second click to confirm
  const [pending, setPending] = useState<{ memberId: string; action: MemberAction } | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const runAction = async (member: User, action: MemberAction) => {
    const handler = action === "transfer" ? onTransferOwnership : onRemoveMember;
    if (!handler) return;

    setIsWorking(true);
    try {
      await handler(member);
    } finally {
      setIsWorking(false);
      setPending(null);
    }
  };

  return (
    <section className="flex-1 min-h-0 overflow-y-auto">
      <h4 className="text-xs uppercase text-zinc-500 mb-2">
        Members ({project?.users?.length || 0})
      </h4>

      <div className="space-y-2">
        {project?.users?.map((user) => {
          const isMemberOwner = user._id === ownerId;
          const canManage = isOwner && !isMemberOwner && user._id !== currentUserId;
          const isPending = pending?.memberId === user._id;

          return (
            <div key={user._id} className="group/member">
              <UserTile user={user} isOwner={isMemberOwner} />

              {canManage && !isPending && (
                <div className="mt-1 flex gap-3 px-2 text-xs opacity-0 group-hover/member:opacity-100 focus-within:opacity-100 transition-opacity">
                  {onTransferOwnership && (
                    <button
                      onClick={() => setPending({ memberId: user._id, action: "transfer" })}
                      className="flex items-center gap-1 text-zinc-400 hover:text-yellow-300"
                    >
                      <Crown size={12} /> {ACTION_LABELS.transfer}
                    </button>
                  )}
                  {onRemoveMember && (
                    <button
                      onClick={() => setPending({ memberId: user._id, action: "remove" })}
                      className="flex items-center gap-1 text-zinc-400 hover:text-red-400"
                    >
                      <UserMinus size={12} /> {ACTION_LABELS.remove}
                    </button>
                  )}
                </div>
              )}

              {isPending && pending && (
                <div className="mt-1 rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-300">
                  <p className="mb-1.5">
                    {pending.action === "transfer"
                      ? `Make ${user.name || user.username} the owner? You will become a regular member.`
                      : `Remove ${user.name || user.username} from this project?`}
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={isWorking}
                      onClick={() => runAction(user, pending.action)}
                      className={`rounded px-2 py-0.5 font-medium disabled:opacity-50 ${
                        pending.action === "remove"
                          ? "bg-red-500/80 text-white hover:bg-red-500"
                          : "bg-teal-500 text-black hover:bg-teal-400"
                      }`}
                    >
                      {isWorking ? "Working…" : ACTION_LABELS[pending.action]}
                    </button>
                    <button
                      disabled={isWorking}
                      onClick={() => setPending(null)}
                      className="rounded px-2 py-0.5 text-zinc-400 hover:text-white disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
