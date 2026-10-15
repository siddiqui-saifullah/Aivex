import IncomingMessageBubble from "./Message/IncomingMessageBubble";
import OutgoingMessageBubble from "./Message/OutgoingMessageBubble";
import type { BubblePosition } from "./Message/types";
import type { MessageType, Timestamp } from "../../types";

interface MessageProps {
  username?: string;
  text: string;
  type?: MessageType;
  timestamp?: Timestamp;
  isStreaming?: boolean;
  showUsername?: boolean;
  isTyping?: boolean;
  isAI?: boolean;
  position?: BubblePosition;
}

const Message = ({
  username,
  text,
  type = "incoming", // incoming | outgoing | system
  timestamp,
  isStreaming = false,
  showUsername = true,
  isTyping = false,
  isAI,
  position = "single",
}: MessageProps) => {
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
        position={position}
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
      isAI={isAI}
      position={position}
    />
  );
};

export default Message;
