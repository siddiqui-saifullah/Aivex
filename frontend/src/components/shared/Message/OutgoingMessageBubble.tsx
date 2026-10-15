import { Trash2 } from "lucide-react";
import type { BubblePosition, BubbleProps } from "./types";

const OutgoingMessageBubble = ({
  text,
  timestamp,
  position = "single",
  onDelete,
}: BubbleProps) => {
  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  // Bubble shape by group position
  const radiusMap: Record<BubblePosition, string> = {
    single: "rounded-2xl rounded-br-sm",
    start: "rounded-2xl rounded-br-sm",
    middle: "rounded-2xl rounded-tr-sm rounded-br-sm",
    end: "rounded-2xl rounded-tr-sm",
  };

  return (
    <div className="group/row flex w-full items-center justify-end gap-1 pr-2">
      {onDelete && (
        <button
          onClick={onDelete}
          className="opacity-0 group-hover/row:opacity-100 focus:opacity-100 p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition"
          title="Delete message"
          aria-label="Delete message"
        >
          <Trash2 size={13} />
        </button>
      )}
      <div
        className={`
          group relative
          max-w-[78%] sm:max-w-[65%]
          px-4 py-2.5
          text-sm leading-snug
          bg-[#00aeb0] text-black
          break-words whitespace-pre-wrap
          overflow-hidden
          ${radiusMap[position]}
        `}
      >
        {/* Message text */}
        <span>{text}</span>

        {/* WhatsApp-style time */}
        {formattedTime && (
          <span
            className="
              ml-2 inline-block
              text-[11px]
              text-black/70
              opacity-0 group-hover:opacity-100
              transition-opacity duration-150
              translate-y-[3px]
              select-none
            "
          >
            {formattedTime}
          </span>
        )}
      </div>
    </div>
  );
};

export default OutgoingMessageBubble;
