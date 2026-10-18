import { useEffect, useRef } from "react";
import ProjectMembers from "./ProjectMembers";
import ProjectActions from "./ProjectActions";
import AiMemoryPanel from "./AiMemoryPanel";
import { STACK_FORMATTER } from "../../constants/options";
import type { ProjectDetails, User } from "../../types";

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectDetails | null;
  isOwner: boolean;
  onAddMember: () => void;
  onDelete: () => void;
  onLeave: () => void;
  onTransferOwnership?: (member: User) => Promise<void>;
  onRemoveMember?: (member: User) => Promise<void>;
  onCancelInvite?: (user: User) => Promise<void>;
  onSaveMemory?: (memory: string) => Promise<boolean>;
  currentUserId?: string;
  invitePermissionError?: boolean;
  deletePermissionError?: boolean;
}

const SidePanel = ({
  isOpen,
  onClose,
  project,
  isOwner,
  onAddMember,
  onDelete,
  onLeave,
  onTransferOwnership,
  onRemoveMember,
  onCancelInvite,
  onSaveMemory,
  currentUserId,
  invitePermissionError,
  deletePermissionError,
}: SidePanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape or a click outside the panel (the toggle button handles itself)
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (panelRef.current?.contains(target)) return;
      if (target.closest("[data-sidepanel-toggle]")) return;
      // Modals opened from the panel (invite, delete) render outside it
      if (target.closest("[role=dialog], .fixed")) return;
      onClose();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [isOpen, onClose]);

  return (
    <div
      ref={panelRef}
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={`
        absolute top-14 bottom-0 left-0 z-30 w-full
        bg-zinc-900 border-r border-white/10
        shadow-2xl shadow-black/60
        transition-transform duration-200 ease-out
        flex flex-col
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <p className="text-sm font-semibold text-white truncate">
          {project?.name}
        </p>
        {project?.stack && (
          <p className="text-xs text-zinc-400">
            Stack: {STACK_FORMATTER[project.stack] ?? project.stack}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col h-[calc(100%-3.5rem)] px-4 py-3 overflow-y-auto">
        {/* Members */}
        <ProjectMembers
          project={project}
          isOwner={isOwner}
          onAddMember={onAddMember}
          onTransferOwnership={onTransferOwnership}
          onRemoveMember={onRemoveMember}
          onCancelInvite={onCancelInvite}
          currentUserId={currentUserId}
          invitePermissionError={invitePermissionError}
        />

        {/* AI memory (remounts when someone else updates it) */}
        {onSaveMemory && (
          <AiMemoryPanel
            key={project?.aiMemory ?? ""}
            memory={project?.aiMemory ?? ""}
            onSave={onSaveMemory}
          />
        )}

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
