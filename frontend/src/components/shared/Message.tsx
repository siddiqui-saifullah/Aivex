import IncomingMessageBubble from "./Message/IncomingMessageBubble";
import OutgoingMessageBubble from "./Message/OutgoingMessageBubble";
import type { BubblePosition } from "./Message/types";
import type { FlatFileTree, MessageType, Timestamp } from "../../types";

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
  files?: FlatFileTree | null;
  onApplyFiles?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
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
  files,
  onApplyFiles,
  onDelete,
  onReport,
}: MessageProps) => {
  /* ---------------- System Message ---------------- */
  if (type === "system") {
    return (
      <div className="my-3 flex justify-center">
        <span className="rounded-full bg-zinc-900 px-3 py-1 text-[11px] text-zinc-400 ring-1 ring-white/5">{text}</span>
      </div>
    );
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
        onDelete={onDelete}
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
      files={files}
      onApplyFiles={onApplyFiles}
      onReport={onReport}
    />
  );
};

export default Message;
