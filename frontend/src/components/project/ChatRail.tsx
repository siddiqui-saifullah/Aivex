import { Bot, MessageSquare, PanelLeftOpen } from "lucide-react";
import { colorFor } from "../../utils/userColor";
import type { User } from "../../types";

interface ChatRailProps {
  unread: number;
  isAiThinking: boolean;
  /** Someone in the project is typing. */
  isTyping: boolean;
  members: User[];
  currentUserId?: string;
  onExpand: () => void;
}

/** The chat when collapsed: a slim rail that still shows what's going on. */
const ChatRail = ({
  unread,
  isAiThinking,
  isTyping,
  members,
  currentUserId,
  onExpand,
}: ChatRailProps) => {
  const others = members.filter((m) => m._id !== currentUserId);
  const shown = others.slice(0, 4);

  return (
    <div className="hidden md:flex h-full w-12 flex-col items-center gap-2 py-2">
      <button
        onClick={onExpand}
        title="Show chat (Ctrl+B)"
        aria-label="Show chat"
        className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
      >
        <PanelLeftOpen size={18} />
      </button>

      <button
        onClick={onExpand}
        title={
          unread ? `${unread} new message${unread === 1 ? "" : "s"}` : "Chat"
        }
        aria-label={unread ? `Chat, ${unread} new messages` : "Chat"}
        className="relative rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
      >
        <MessageSquare size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-500 px-1 text-[10px] font-bold leading-none text-black">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
        {unread === 0 && isTyping && (
          <span className="absolute right-1 top-1 h-2 w-2 animate-pulse rounded-full bg-zinc-300" />
        )}
      </button>

      {isAiThinking && (
        <div
          title="Vex AI is working…"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-300"
        >
          <Bot size={16} className="animate-pulse" />
        </div>
      )}

      <div className="mt-auto flex flex-col items-center gap-1.5 pb-1">
        {shown.map((m) => (
          <div
            key={m._id}
            title={m.name || m.username}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-black"
            style={{ backgroundColor: colorFor(m.username || m.name || "") }}
          >
            {(m.name || m.username || "?").charAt(0).toUpperCase()}
          </div>
        ))}
        {others.length > shown.length && (
          <span className="text-[10px] text-zinc-500">
            +{others.length - shown.length}
          </span>
        )}
      </div>
    </div>
  );
};

export default ChatRail;
