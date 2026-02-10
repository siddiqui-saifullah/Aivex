import MessageGroup from "../shared/MessageGroup";
import ChatInput from "../shared/ChatTextarea";
import { useEffect, useRef } from "react";
import { groupMessages } from "../../utils/messageGrouping";

/**
 * MessageArea Component
 * Displays list of messages and input field for chat
 * Supports real-time streaming AI responses with typing animation
 * Groups consecutive messages from same sender
 *
 * Props:
 * - messages: Array of message objects
 * - message: Current input value
 * - onMessageChange: Handler for input changes
 * - onSend: Handler for sending messages
 * - onTyping: Handler for typing indicator
 * - typingUsers: Object of users currently typing { userId: username }
 */
const MessageArea = ({
  messages,
  message,
  onMessageChange,
  onSend,
  onTyping,
  typingUsers = {},
}) => {
  const bottomRef = useRef(null);
  const groupedMessages = groupMessages(messages);
  console.log(messages);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages (ONLY scroll container) */}
      <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto  no-scrollbar pt-2">
        {groupedMessages.length > 0 ? (
          groupedMessages.map((group) => (
            <MessageGroup
              key={group.groupId}
              groupId={group.groupId}
              username={group.username}
              messages={group.messages}
              type={group.type}
              isAI={group.isAI}
            />
          ))
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-500">
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        )}

        {/* Typing indicators for all users currently typing */}
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

        {/* scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 flex items-end gap-2 p-3">
        <ChatInput
          value={message}
          onChange={onMessageChange}
          onSend={onSend}
          onTyping={onTyping}
          placeholder="Use @Vex to chat with Aivex AI"
        />
      </div>
    </div>
  );
};

export default MessageArea;
