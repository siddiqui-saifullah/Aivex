import { Link } from "react-router-dom";
import { Bot, BotOff, Lightbulb, MessageSquare } from "lucide-react";
import type { AiUsage } from "../../services/ai.service";
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
  /** The class teacher turned the AI off: plain team chat only. */
  aiDisabled?: boolean;
  /** Assignment rule: Vex explains and hints, but doesn't write code. */
  aiHintsOnly?: boolean;
  /** Today's Vex allowance; nothing is shown when unlimited. */
  aiUsage?: AiUsage | null;
  /** Mentions, AI mode and prompt enhancer for the input. */
  inputProps?: Pick<
    ComponentProps<typeof ChatInput>,
    "mentionables" | "aiMode" | "onToggleAiMode" | "onEnhance" | "aiContext"
  >;
}

/* -------------------------------------------------------------------------- */
/* MESSAGE AREA                                                               */
/* -------------------------------------------------------------------------- */

const STARTER_PROMPTS = [
  "Build a responsive landing page with HTML, CSS and JS",
  "Explain how this project works",
  "Find and fix bugs in the open file",
];

/** On a hints-only assignment: ways to ask for help without asking for the answer. */
const HINT_PROMPTS = [
  "Explain what this assignment is asking",
  "Give me a hint for the next step",
  "Why doesn't my code work?",
];

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
  aiDisabled = false,
  aiHintsOnly = false,
  aiUsage = null,
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
      <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto no-scrollbar pt-3 pb-2">
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
        ) : aiDisabled ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-400">
              <MessageSquare size={22} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-200">Chat with your class</p>
              <p className="text-xs text-zinc-500">Your teacher turned off Vex AI here.</p>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-300">
              <Bot size={22} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-200">
                {aiHintsOnly ? "Stuck? Ask Vex for a hint" : "Ask Vex AI or chat with your team"}
              </p>
              <p className="text-xs text-zinc-500">Start with @Vex, or turn on AI mode with the bot button.</p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-2">
              {(aiHintsOnly ? HINT_PROMPTS : STARTER_PROMPTS).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => onMessageChange(`@Vex ${prompt}`)}
                  className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-left text-xs text-zinc-300 transition hover:border-teal-500/40 hover:text-white"
                >
                  {prompt}
                </button>
              ))}
            </div>
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
      {aiDisabled && groupedMessages.length > 0 && (
        <div className="mx-3 flex items-center gap-2 rounded-lg border border-white/5 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400">
          <BotOff size={13} className="shrink-0" /> Your teacher turned off Vex AI here
        </div>
      )}
      {aiHintsOnly && !aiDisabled && (
        <div className="mx-3 flex items-center gap-2 rounded-lg border border-teal-500/15 bg-teal-500/5 px-3 py-1.5 text-xs text-teal-200/80">
          <Lightbulb size={13} className="shrink-0" /> Hints only: Vex explains and guides, but won't write the code for you
        </div>
      )}
      {!aiDisabled && aiUsage?.limit != null && (
        <p
          className={`mx-3 -mb-1 text-[11px] ${aiUsage.remaining === 0 ? "text-amber-300" : "text-zinc-500"}`}
          title={`Resets at ${new Date(aiUsage.resetsAt).toLocaleString()}`}
        >
          {aiUsage.remaining === 0
            ? `Daily Vex limit reached · resets at ${new Date(aiUsage.resetsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : `${aiUsage.remaining} of ${aiUsage.limit} Vex questions left today`}
          {aiUsage.plan !== "premium" && (aiUsage.remaining ?? 0) <= 1 && (
            <>
              {" · "}
              <Link to="/settings/billing" className="font-medium text-teal-300 hover:underline">Get more</Link>
            </>
          )}
        </p>
      )}
      <div className="shrink-0 flex items-end gap-2 p-3">
        <ChatInput
          value={message}
          onChange={onMessageChange}
          onSend={onSend}
          onTyping={onTyping}
          placeholder={aiDisabled ? "Message your class…" : aiHintsOnly ? "Ask @Vex for a hint…" : "Message, or type @ to mention Vex AI"}
          {...inputProps}
        />
      </div>
    </div>
  );
};

export default MessageArea;
