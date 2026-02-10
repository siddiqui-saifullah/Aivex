import Message from "./Message";

const MessageGroup = ({
  groupId,
  username,
  messages = [],
  type = "incoming",
  isAI = false,
  isTyping = false,
}) => {
  if (!isTyping && messages.length === 0) return null;

  const getPosition = (idx, total) => {
    if (total === 1) return "single";
    if (idx === 0) return "start";
    if (idx === total - 1) return "end";
    return "middle";
  };

  const getSpacing = (position) => {
    switch (position) {
      case "middle":
        return "mt-[2px]";
      case "end":
        return "mt-1";
      default:
        return "mt-0";
    }
  };

  return (
    <div className="flex flex-col">
      {isTyping && (
        <div className="mt-1">
          <Message
            username={username}
            text=""
            type={type}
            isTyping
            showUsername
            isAI={isAI}
            position="end"
          />
        </div>
      )}

      {messages.map((msg, idx) => {
        const position = getPosition(idx, messages.length);

        return (
          <div
            key={msg.id || `${groupId}-${idx}`}
            className={getSpacing(position)}
          >
            <Message
              messageId={msg.id || `${groupId}-${idx}`}
              username={username}
              text={msg.text}
              fileTree={msg.fileTree}
              type={type}
              timestamp={msg.timestamp}
              isError={msg.isError}
              isStreaming={msg.isStreaming}
              showUsername={idx === 0 && !isTyping}
              isAI={isAI}
              position={position}
            />
          </div>
        );
      })}
    </div>
  );
};

export default MessageGroup;
