import { useState } from "react";
import { Bot, Check, Copy, FileCode2 } from "lucide-react";
import MarkdownRenderer from "../MarkdownRenderer";
import MentionText from "../MentionText";
import type { BubblePosition, BubbleProps } from "./types";

interface IncomingMessageBubbleProps extends BubbleProps {
  username?: string;
  showUsername?: boolean;
}

const IncomingMessageBubble = ({
  username,
  text,
  timestamp,
  showUsername,
  isTyping,
  isStreaming,
  isAI,
  position = "single",
  files,
  onApplyFiles,
}: IncomingMessageBubbleProps) => {
  const fileCount = files ? Object.keys(files).length : 0;
  const [copied, setCopied] = useState(false);

  const copyText = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  // Bubble shape based on group position
  const radiusMap: Record<BubblePosition, string> = {
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
          min-w-[3.5rem] ${isAI ? "max-w-[92%] bg-zinc-900 border border-teal-500/15" : "max-w-[85%] bg-zinc-800/90"}
          text-white
          overflow-hidden wrap-break-word
          ${radiusMap[position]}
        `}
      >
        {/* Username — only at group start */}
        {showUsername && (
          <div className={`mb-1 flex items-center gap-1.5 text-[11px] font-medium ${isAI ? "text-teal-300" : "text-zinc-400"}`}>
            {isAI && <Bot size={12} />}
            {isAI ? "Vex AI" : username || "Unknown"}
          </div>
        )}

        {isAI && text && !isStreaming && (
          <button
            onClick={copyText}
            title={copied ? "Copied" : "Copy reply"}
            aria-label="Copy reply"
            className="absolute right-1.5 top-1.5 rounded p-1 text-zinc-500 opacity-0 transition hover:bg-white/10 hover:text-zinc-200 focus:opacity-100 group-hover:opacity-100"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          </button>
        )}

        {/* Content */}
        <div>
          {isAI && text ? (
            <MarkdownRenderer content={text} />
          ) : (
            <span className="whitespace-pre-wrap">
              <MentionText text={text ?? ""} tone="incoming" />
            </span>
          )}

          {/* Generated files */}
          {fileCount > 0 && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-300">
              <FileCode2 size={14} className="text-teal-400 shrink-0" />
              <span className="flex-1">
                {fileCount} file{fileCount === 1 ? "" : "s"} generated
              </span>
              {onApplyFiles && (
                <button
                  onClick={onApplyFiles}
                  className="rounded px-2 py-0.5 font-medium text-teal-300 hover:bg-teal-500/10 transition"
                >
                  Apply
                </button>
              )}
            </div>
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
