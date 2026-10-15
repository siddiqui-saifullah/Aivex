import MessageGroup from "../shared/MessageGroup";
import ChatInput from "../shared/ChatTextarea";
import { useEffect, useRef, useMemo, type ComponentProps } from "react";
import { groupMessages } from "../../utils/messageGrouping";
import AiProgressIndicator from "./AiProgressIndicator";
import type { ChatMessage, FlatFileTree } from "../../types";

interface MessageAreaProps {
  messages?: ChatMessage[];
  message: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  onTyping?: (isTyping: boolean) => void;
  typingUsers?: Record<string, string>;
  isAiThinking?: boolean;
  onDeleteMessage?: (id: string) => void;
  onApplyFiles?: (files: FlatFileTree) => void;
  /** Mentions, AI mode and prompt enhancer for the input. */
  inputProps?: Pick<
    ComponentProps<typeof ChatInput>,
    "mentionables" | "aiMode" | "onToggleAiMode" | "onEnhance"
  >;
}

/* -------------------------------------------------------------------------- */
/* MESSAGE AREA                                                               */
/* -------------------------------------------------------------------------- */

const MessageArea = ({
  messages = [],
  message,
  onMessageChange,
  onSend,
  onTyping,
  typingUsers = {},
  isAiThinking = false,
  onDeleteMessage,
  onApplyFiles,
  inputProps,
}: MessageAreaProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  const groupedMessages = useMemo(() => {
    return groupMessages(messages);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [groupedMessages, typingUsers, isAiThinking]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* -------------------- MESSAGE LIST -------------------- */}
      <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto no-scrollbar pt-2">
        {/* Existing Messages */}
        {groupedMessages.length > 0 ? (
          groupedMessages.map((group) => (
            <MessageGroup
              key={group.groupId}
              groupId={group.groupId}
              username={group.username}
              messages={group.messages}
              type={group.type}
              isAI={group.isAI}
              onDeleteMessage={onDeleteMessage}
              onApplyFiles={onApplyFiles}
            />
          ))
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-500">
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        )}

        {/* Human Typing Indicators */}
        {Object.entries(typingUsers).map(([userId, username]) => (
          <MessageGroup
            key={`typing-${userId}`}
            groupId={`typing-${userId}`}
            username={username}
            messages={[]}
            type="incoming"
            isTyping={true}
          />
        ))}

        {/* AI Thinking Indicator */}
        {isAiThinking ? <AiProgressIndicator key="ai-indicator" /> : null}

        <div ref={bottomRef} />
      </div>

      {/* -------------------- INPUT AREA -------------------- */}
      <div className="shrink-0 flex items-end gap-2 p-3">
        <ChatInput
          value={message}
          onChange={onMessageChange}
          onSend={onSend}
          onTyping={onTyping}
          placeholder="Message, or type @ to mention Vex AI"
          {...inputProps}
        />
      </div>
    </div>
  );
};

export default MessageArea;
