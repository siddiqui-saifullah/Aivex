import { Trash2 } from "lucide-react";
import MentionText from "../MentionText";
import type { BubblePosition, BubbleProps } from "./types";

const OutgoingMessageBubble = ({
  text,
  timestamp,
  position = "single",
  onDelete,
}: BubbleProps) => {
  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;
  // The last bubble of a group always shows its time (no hover on phones)
  const isLastInGroup = position === "end" || position === "single";

  const radiusMap: Record<BubblePosition, string> = {
    single: "rounded-2xl rounded-tr-md",
    start: "rounded-2xl rounded-tr-md rounded-br-md",
    middle: "rounded-2xl rounded-r-md",
    end: "rounded-2xl rounded-tr-md",
  };

  return (
    <div className="group/row flex w-full items-center justify-end gap-1 pl-10 pr-2">
      {onDelete && (
        <button
          onClick={onDelete}
          className="shrink-0 rounded p-1 text-zinc-500 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 focus:opacity-100 group-hover/row:opacity-100"
          title="Delete message"
          aria-label="Delete message"
        >
          <Trash2 size={13} />
        </button>
      )}
      <div
        className={`
          group relative min-w-0 max-w-[88%]
          px-3.5 py-2
          text-[14px] leading-[1.5]
          bg-teal-700 text-white shadow-sm shadow-black/30
          wrap-break-word whitespace-pre-wrap
          ${radiusMap[position]}
        `}
      >
        <MentionText text={text ?? ""} tone="outgoing" />

        {formattedTime && (
          <span
            className={`float-right ml-3 mt-1 select-none text-[11px] leading-4 text-teal-100/75 ${
              isLastInGroup ? "" : "opacity-0 transition-opacity group-hover:opacity-100"
            }`}
          >
            {formattedTime}
          </span>
        )}
      </div>
    </div>
  );
};

export default OutgoingMessageBubble;
