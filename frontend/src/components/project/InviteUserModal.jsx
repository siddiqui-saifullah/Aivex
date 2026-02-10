import { useState } from "react";
import { X, UserSearch, Check } from "lucide-react";
import UserTile from "../shared/UserTile";
import InputField from "../ui/InputField";
import Button from "../ui/Button";
import { useUserSearch } from "../../hooks/useSearchUsers";
import { useUserSelection } from "../../hooks/useUserSelection";
import { addUserToProject } from "../../services/project.service";

const MAX_SELECTION = 10;

const InviteUserModal = ({ isOpen, onClose, onSelectUser, projectId }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const { users, loading, error: searchError } = useUserSearch(searchQuery);
  const {
    selectedUserIds,
    toggleUser,
    clearSelection,
    error: selectionError,
  } = useUserSelection(MAX_SELECTION);

  const handleInvite = async () => {
    const selectedUsers = users.filter((u) =>
      selectedUserIds.includes(u._id)
    );

    try {
      setIsInviting(true);
      setInviteError("");

      // Call API to add users to project
      await addUserToProject(projectId, selectedUserIds);

      // Callback with selected users for UI update
      onSelectUser(selectedUsers);
      clearModal();
    } catch (error) {
      console.error("Failed to add users:", error);
      setInviteError(
        error.response?.data?.message || "Failed to add members. Please try again."
      );
    } finally {
      setIsInviting(false);
    }
  };

  const clearModal = () => {
    setSearchQuery("");
    clearSelection();
    setInviteError("");
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-100 flex items-center justify-center transition-all ${
        isOpen ? "bg-black/50" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="bg-zinc-900 w-96 max-h-[80vh] rounded-lg border border-white/10 flex flex-col">

        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between">
          <div>
            <h2 className="text-white font-semibold">Add Members</h2>
            <p className="text-xs text-zinc-500">
              {selectedUserIds.length}/{MAX_SELECTION} selected
            </p>
          </div>
          <button onClick={clearModal} disabled={isInviting}>
            <X className="text-zinc-400 hover:text-white" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-white/10 space-y-2">
          <InputField
            theme="dark"
            icon={<UserSearch size={18} />}
            placeholder="Search by name or username"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isInviting}
          />

          {(searchError || selectionError || inviteError) && (
            <p className="text-xs text-red-400 px-1">
              {searchError || selectionError || inviteError}
            </p>
          )}
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && (
            <p className="text-zinc-500 text-sm text-center">
              Searching…
            </p>
          )}

          {!loading && users.length === 0 && (
            <p className="text-zinc-500 text-sm text-center mt-10">
              No users found
            </p>
          )}

          {users.map((user) => (
            <div
              key={user._id}
              onClick={() => !isInviting && toggleUser(user._id)}
              className="relative cursor-pointer"
            >
              <UserTile
                user={user}
                isActive={selectedUserIds.includes(user._id)}
              />
              {selectedUserIds.includes(user._id) && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-teal-500 p-1 rounded-full">
                  <Check size={14} className="text-white" />
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex gap-2">
          <Button
            variant="ghost"
            onClick={clearModal}
            disabled={isInviting}
            className="flex-1 text-zinc-300"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleInvite}
            loading={isInviting}
            disabled={!selectedUserIds.length || isInviting}
            className="flex-1"
          >
            Add ({selectedUserIds.length})
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InviteUserModal;
