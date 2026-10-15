import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Bot, FileCode2, Loader2, Send, Sparkles, X } from "lucide-react";

export interface Mentionable {
  id: string;
  /** Inserted after "@", e.g. "Vex" or a username. */
  handle: string;
  label: string;
  isAI?: boolean;
}

/**
 * ChatInput Component
 * Text input for sending messages with @mention support
 *
 * Features:
 * - Auto-grow textarea (ChatGPT-like)
 * - @mention suggestions (AI + project members), picked with ↑ ↓ Tab / Enter
 * - AI mode: every message is sent to the AI without typing @Vex
 * - Prompt enhancer: rewrites a rough request into a precise one
 * - Enter to send (Shift+Enter for newline), typing indicator emission
 */
interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend?: () => void;
  onTyping?: (isTyping: boolean) => void;
  placeholder?: string;
  maxHeight?: number;
  disabled?: boolean;
  mentionables?: Mentionable[];
  aiMode?: boolean;
  onToggleAiMode?: () => void;
  /** Returns the improved prompt. */
  onEnhance?: (text: string) => Promise<string>;
  /** Editor context sent with AI messages (open file / selection), shown as a chip. */
  aiContext?: { label: string; onRemove: () => void } | null;
}

/** The "@query" being typed right before the cursor, if any. */
const getMentionQuery = (text: string, cursor: number) => {
  const before = text.slice(0, cursor);
  const match = /(^|\s)@([\w-]*)$/.exec(before);
  return match ? { query: match[2], start: cursor - match[2].length - 1 } : null;
};

const ChatInput = ({
  value,
  onChange,
  onSend,
  onTyping,
  placeholder = "Type a message…",
  maxHeight = 128,
  disabled = false,
  mentionables = [],
  aiMode = false,
  onToggleAiMode,
  onEnhance,
  aiContext,
}: ChatInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [isEnhancing, setIsEnhancing] = useState(false);
  // Previous text, so an enhancement can be undone with Ctrl+Z-like "Undo"
  const [beforeEnhance, setBeforeEnhance] = useState<string | null>(null);

  // Auto-grow (ChatGPT behavior)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  }, [value, maxHeight]);

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return mentionables
      .filter((m) => m.handle.toLowerCase().startsWith(q) || m.label.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mention, mentionables]);

  const insertMention = (item: Mentionable) => {
    if (!mention) return;
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? value.length;
    const next = `${value.slice(0, mention.start)}@${item.handle} ${value.slice(cursor)}`;
    onChange(next);
    setMention(null);

    const caret = mention.start + item.handle.length + 2;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  /**
   * Handle text change and emit typing indicator
   */
  const handleTextChange = (text: string, cursor: number) => {
    onChange(text);
    setBeforeEnhance(null);

    const nextMention = getMentionQuery(text, cursor);
    setMention(nextMention);
    if (nextMention?.query !== mention?.query) setHighlight(0);

    // Emit typing indicator
    if (onTyping && text.trim()) {
      onTyping(true);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }
  };

  const send = () => {
    if (!value.trim() || disabled) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    onTyping?.(false); // Stop typing indicator when sending
    setMention(null);
    setBeforeEnhance(null);
    onSend?.();
  };

  /**
   * Handle keyboard events
   * - Mention popup: ↑ ↓ to move, Enter/Tab to pick, Esc to close
   * - Enter: Send message
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        setHighlight((h) => (h + delta + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[highlight] ?? suggestions[0]);
        return;
      }
      if (e.key === "Escape") {
        setMention(null);
        return;
      }
    }

    // Handle Enter to send
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleEnhance = async () => {
    if (!onEnhance || !value.trim() || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const original = value;
      const improved = await onEnhance(value);
      if (improved && improved !== original) {
        setBeforeEnhance(original);
        onChange(improved);
      }
    } finally {
      setIsEnhancing(false);
      textareaRef.current?.focus();
    }
  };

  const canSend = value.trim().length > 0 && !disabled;
  // Show what the AI will see only when this message goes to the AI
  const isForAi = aiMode || /^\s*@vex\b/i.test(value);

  return (
    <div className="relative w-full">
      {/* Mention suggestions */}
      {suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Mention suggestions"
          className="absolute bottom-full left-0 mb-2 w-64 max-w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-xl shadow-black/50 z-20"
        >
          {suggestions.map((item, i) => (
            <li
              key={item.id}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(item);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer ${
                i === highlight ? "bg-teal-500/15 text-white" : "text-zinc-300"
              }`}
            >
              {item.isAI ? (
                <Bot size={15} className="text-teal-400 shrink-0" />
              ) : (
                <span className="w-[15px] h-[15px] rounded-full bg-zinc-700 text-[9px] flex items-center justify-center shrink-0">
                  {item.label.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="truncate">{item.label}</span>
              <span className="ml-auto text-xs text-zinc-500">@{item.handle}</span>
            </li>
          ))}
        </ul>
      )}

      {aiContext && isForAi && (
        <div className="mb-1.5 flex">
          <span
            className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[11px] text-teal-200"
            title="Sent to Vex AI with your message"
          >
            <FileCode2 size={12} className="shrink-0" />
            <span className="truncate">{aiContext.label}</span>
            <button
              type="button"
              onClick={aiContext.onRemove}
              aria-label="Don't send this context"
              className="text-teal-300/70 hover:text-white"
            >
              <X size={12} />
            </button>
          </span>
        </div>
      )}

      {beforeEnhance !== null && (
        <div className="mb-1.5 flex items-center gap-2 text-[11px] text-teal-300">
          <Sparkles size={12} /> Prompt enhanced
          <button
            onClick={() => {
              onChange(beforeEnhance);
              setBeforeEnhance(null);
            }}
            className="underline text-zinc-400 hover:text-zinc-200"
          >
            Undo
          </button>
        </div>
      )}

      <div
        className={`
          flex items-end gap-1.5
          bg-zinc-900/60 border rounded-xl px-2 py-2
          focus-within:border-teal-500/50
          transition-colors w-full
          ${aiMode ? "border-teal-500/40" : "border-white/10"}
        `}
      >
        {onToggleAiMode && (
          <button
            type="button"
            onClick={onToggleAiMode}
            aria-pressed={aiMode}
            title={aiMode ? "AI mode on: every message goes to Vex" : "AI mode off: mention @Vex to ask the AI"}
            className={`shrink-0 h-9 w-9 rounded-lg flex items-center justify-center transition ${
              aiMode ? "bg-teal-500/15 text-teal-300" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            }`}
          >
            <Bot size={18} />
          </button>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleTextChange(e.target.value, e.target.selectionStart)}
          onKeyDown={handleKeyDown}
          onBlur={() => setMention(null)}
          placeholder={aiMode ? "Ask Vex AI anything…" : placeholder}
          disabled={disabled || isEnhancing}
          rows={1}
          aria-label="Message"
          className="
            flex-1 resize-none bg-transparent py-1.5
            text-sm text-white placeholder-zinc-500
            focus:outline-none
            overflow-y-auto max-h-32
            no-scrollbar
          "
        />

        {onEnhance && (
          <button
            type="button"
            onClick={handleEnhance}
            disabled={!value.trim() || isEnhancing}
            title="Enhance prompt with AI"
            aria-label="Enhance prompt"
            className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center text-zinc-500 hover:text-teal-300 hover:bg-white/5 transition disabled:opacity-30 disabled:hover:bg-transparent"
          >
            {isEnhancing ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
          </button>
        )}

        <button
          onClick={send}
          disabled={!canSend}
          className={`
            shrink-0 h-9 w-9 rounded-xl
            flex items-center justify-center
            transition-all
            ${
              canSend
                ? "bg-teal-500 text-black hover:bg-teal-400"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            }
          `}
          title="Send"
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
