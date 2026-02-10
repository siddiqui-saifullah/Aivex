import MarkdownRenderer from "./MarkdownRenderer";
import IncomingMessageBubble from "./Message/IncomingMessageBubble";
import OutgoingMessageBubble from "./Message/OutgoingMessageBubble";

const Message = ({
  username,
  text,
  type = "incoming", // incoming | outgoing | system
  timestamp,
  isStreaming = false,
  showUsername = true,
  isTyping = false,
  isAI,
}) => {
  /* ---------------- System Message ---------------- */
  if (type === "system") {
    return <div className="my-3 text-center text-xs text-zinc-500">{text}</div>;
  }

  if (type === "outgoing") {
    return (
      <OutgoingMessageBubble
        text={text}
        timestamp={timestamp}
        isTyping={isTyping}
        isStreaming={isStreaming}
        isAI={isAI}
      />
    );
  }

  return (
    <IncomingMessageBubble
      username={username}
      text={text}
      timestamp={timestamp}
      showUsername={showUsername}
      isTyping={isTyping}
      isStreaming={isStreaming}
    />
  );
};

export default Message;
