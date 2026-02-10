const OutgoingMessageBubble = ({
  text,
  timestamp,
  position = "single", // 👈 NEW
}) => {
  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  // Bubble shape by group position
  const radiusMap = {
    single: "rounded-2xl rounded-br-sm",
    start: "rounded-2xl rounded-br-sm",
    middle: "rounded-2xl rounded-tr-sm rounded-br-sm",
    end: "rounded-2xl rounded-tr-sm",
  };

  return (
    <div className="flex w-full justify-end pr-2">
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
