import { Crown } from "lucide-react";

const UserTile = ({
  user,
  isOwner = false,
  isActive = false,
  onClick,
}) => {
  const initial = user?.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <div
      onClick={onClick}
      className={`
        group flex items-center justify-between gap-3
        px-2 sm:px-3 py-2 rounded-lg cursor-pointer
        border transition-all duration-200
        ${
          isActive
            ? "bg-teal-500/10 border-teal-500/40"
            : "bg-zinc-900/40 border-white/5 hover:border-teal-500/30 hover:bg-zinc-900"
        }
      `}
    >
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Avatar */}
        <div
          className="
            w-9 h-9 rounded-full overflow-hidden
            flex items-center justify-center
            bg-black border border-white/10
            text-teal-400 font-semibold text-sm
            shrink-0
          "
        >
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{initial}</span>
          )}
        </div>

        {/* Text */}
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-medium text-zinc-100 truncate">
            {user.name}
          </p>
          <p className="text-xs text-zinc-500 truncate">
            @{user.username}
          </p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Online indicator */}
        {user.isOnline !== undefined && (
          <span
            className={`
              w-2 h-2 rounded-full
              ${user.isOnline ? "bg-emerald-400" : "bg-zinc-600"}
            `}
            title={user.isOnline ? "Online" : "Offline"}
          />
        )}

        {/* Owner badge */}
        {isOwner && (
          <Crown size={14} className="text-yellow-400" />
        )}
      </div>
    </div>
  );
};

export default UserTile;
