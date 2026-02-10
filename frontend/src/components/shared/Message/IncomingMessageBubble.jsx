const IncomingMessageBubble = ({
  username,
  text,
  timestamp,
  showUsername,
  isTyping,
  isStreaming,
  isAI,
  position = "single", // 👈 NEW
}) => {
  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  // Bubble shape based on group position
  const radiusMap = {
    single: "rounded-2xl rounded-bl-sm",
    start: "rounded-2xl rounded-bl-sm",
    middle: "rounded-2xl rounded-tl-sm rounded-bl-sm",
    end: "rounded-2xl rounded-tl-sm",
  };

  return (
    <div className="flex w-full justify-start pl-2">
      <div
        className={`
          group relative px-4 py-2.5
          text-sm leading-snug
          min-w-[3.5rem] max-w-[78%] sm:max-w-[65%]
          bg-zinc-800/90 text-white
          overflow-hidden wrap-break-word
          ${radiusMap[position]}
        `}
      >
        {/* Username — only at group start */}
        {showUsername && (
          <div className="mb-1 text-[11px] font-medium text-zinc-400">
            {username || "Unknown"}
          </div>
        )}

        {/* Content */}
        <div>
          {isAI && typeof text === "object" && text.text ? (
            <MarkdownRenderer content={text.text} />
          ) : (
            <span>{text}</span>
          )}

          {/* Typing / Streaming */}
          {(isTyping || isStreaming) && (
            <span className="inline-flex items-center ml-2">
              <span className="flex gap-1">
                <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
                <span className="w-1 h-1 rounded-full bg-current animate-pulse delay-150" />
                <span className="w-1 h-1 rounded-full bg-current animate-pulse delay-300" />
              </span>
            </span>
          )}

          {/* Time — WhatsApp style */}
          {timestamp && (
            <span
              className="
                ml-2 inline-block
                text-[11px] text-zinc-500
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
    </div>
  );
};

export default IncomingMessageBubble;
