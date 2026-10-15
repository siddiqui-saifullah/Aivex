import Message from "./Message";
import type { BubblePosition } from "./Message/types";
import type { GroupedMessageItem } from "../../utils/messageGrouping";
import type { FlatFileTree, MessageType } from "../../types";

interface MessageGroupProps {
  groupId: string;
  username?: string;
  messages?: GroupedMessageItem[];
  type?: MessageType;
  isAI?: boolean;
  isTyping?: boolean;
  /** Offered on outgoing messages that have a server id. */
  onDeleteMessage?: (id: string) => void;
  onApplyFiles?: (files: FlatFileTree) => void;
}

const MessageGroup = ({
  groupId,
  username,
  messages = [],
  type = "incoming",
  isAI = false,
  isTyping = false,
  onDeleteMessage,
  onApplyFiles,
}: MessageGroupProps) => {
  if (!isTyping && messages.length === 0) return null;

  const getPosition = (idx: number, total: number): BubblePosition => {
    if (total === 1) return "single";
    if (idx === 0) return "start";
    if (idx === total - 1) return "end";
    return "middle";
  };

  const getSpacing = (position: BubblePosition) => {
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
              username={username}
              text={msg.text}
              type={type}
              timestamp={msg.timestamp}
              isStreaming={msg.isStreaming}
              showUsername={idx === 0 && !isTyping}
              isAI={isAI}
              position={position}
              files={msg.files}
              onApplyFiles={
                msg.files && onApplyFiles
                  ? () => onApplyFiles(msg.files!)
                  : undefined
              }
              onDelete={
                msg.id && onDeleteMessage && type === "outgoing"
                  ? () => onDeleteMessage(msg.id!)
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
};

export default MessageGroup;
