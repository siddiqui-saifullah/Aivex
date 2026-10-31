import { useState } from "react";
import { Bot, Check, Copy, FileCode2, Flag } from "lucide-react";
import MarkdownRenderer from "../MarkdownRenderer";
import MentionText from "../MentionText";
import { colorFor } from "../../../utils/userColor";
import type { BubblePosition, BubbleProps } from "./types";

interface IncomingMessageBubbleProps extends BubbleProps {
  username?: string;
  showUsername?: boolean;
  /** Report this message to the Aivex team (people's messages only). */
  onReport?: () => void;
}

const TypingDots = () => (
  <span className="inline-flex items-center gap-1 py-1" aria-label="typing">
    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.3s]" />
    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.15s]" />
    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" />
  </span>
);

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
  onReport,
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
    ? new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";
  // The last bubble of a group always shows its time (no hover on phones)
  const isLastInGroup = position === "end" || position === "single";

  const name = isAI ? "Vex AI" : username || "Unknown";
  const accent = isAI ? "#5eead4" : colorFor(name);

  const radiusMap: Record<BubblePosition, string> = {
    single: "rounded-2xl rounded-tl-md",
    start: "rounded-2xl rounded-tl-md rounded-bl-md",
    middle: "rounded-2xl rounded-l-md",
    end: "rounded-2xl rounded-tl-md",
  };

  return (
    <div className="flex w-full items-start gap-2 pl-2 pr-4">
      {/* Avatar on the first message of a group, a spacer after */}
      <div className="w-7 shrink-0">
        {showUsername && (
          isAI ? (
            <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/30">
              <Bot size={15} />
            </div>
          ) : (
            <div
              className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-black"
              style={{ backgroundColor: accent }}
              aria-hidden
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )
        )}
      </div>

      <div
        className={`
          group relative min-w-0 px-3.5 py-2
          text-[14px] leading-[1.5] text-zinc-100
          ${isAI ? "w-full max-w-full bg-zinc-900 ring-1 ring-teal-500/20" : "max-w-[88%] bg-zinc-800"}
          overflow-hidden wrap-break-word
          ${radiusMap[position]}
        `}
      >
        {showUsername && (
          <div className="mb-0.5 text-[12px] font-semibold" style={{ color: accent }}>
            {name}
          </div>
        )}

        {isAI && text && !isStreaming && (
          <button
            onClick={copyText}
            title={copied ? "Copied" : "Copy reply"}
            aria-label="Copy reply"
            className="absolute right-1.5 top-1.5 rounded-md p-1 text-zinc-500 opacity-0 transition hover:bg-white/10 hover:text-zinc-200 focus:opacity-100 group-hover:opacity-100"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
        )}

        {onReport && !isTyping && (
          <button
            onClick={onReport}
            title="Report message"
            aria-label="Report message"
            className="absolute right-1.5 top-1.5 rounded-md p-1 text-zinc-500 opacity-0 transition hover:bg-white/10 hover:text-red-300 focus:opacity-100 group-hover:opacity-100"
          >
            <Flag size={12} />
          </button>
        )}

        {isTyping ? (
          <TypingDots />
        ) : isAI && text ? (
          <MarkdownRenderer content={text} />
        ) : (
          <span className="whitespace-pre-wrap">
            <MentionText text={text ?? ""} tone="incoming" />
          </span>
        )}

        {isStreaming && <TypingDots />}

        {/* Generated files */}
        {fileCount > 0 && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-zinc-200">
            <FileCode2 size={14} className="shrink-0 text-teal-400" />
            <span className="flex-1">
              {fileCount} file{fileCount === 1 ? "" : "s"} updated
            </span>
            {onApplyFiles && (
              <button
                onClick={onApplyFiles}
                className="rounded px-2 py-0.5 font-medium text-teal-300 transition hover:bg-teal-500/10"
              >
                Apply
              </button>
            )}
          </div>
        )}

        {timestamp && !isTyping && (
          <span
            className={`float-right ml-3 mt-1 select-none text-[11px] leading-4 text-zinc-400 ${
              isLastInGroup ? "" : "opacity-0 transition-opacity group-hover:opacity-100"
            }`}
          >
            {formattedTime}
          </span>
        )}
      </div>
    </div>
  );
};

export default IncomingMessageBubble;
