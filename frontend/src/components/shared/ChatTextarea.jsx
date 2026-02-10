import { useEffect, useRef } from "react";
import { Send } from "lucide-react";

/**
 * ChatInput Component
 * Text input for sending messages with @mention support
 * 
 * Features:
 * - Auto-grow textarea (ChatGPT-like)
 * - Smart @mention suggestion with Tab completion
 * - Enter to send (Shift+Enter for newline)
 * - Typing indicator emission
 * 
 * Props:
 * - value: string - Current input text
 * - onChange: function - Callback on text change
 * - onSend: function - Callback on send
 * - onTyping: function - Callback when user starts typing
 * - placeholder: string - Input placeholder
 * - maxHeight: number - Max textarea height in px
 * - disabled: boolean - Disable input
 */
const ChatInput = ({
  value,
  onChange,
  onSend,
  onTyping,
  placeholder = "Type a message…",
  maxHeight = 128,
  disabled = false,
}) => {
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-grow (ChatGPT behavior)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  }, [value, maxHeight]);

  /**
   * Handle text change and emit typing indicator
   */
  const handleTextChange = (text) => {
    onChange(text);

    // Emit typing indicator
    if (onTyping && text.trim()) {
      onTyping?.(true);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        onTyping?.(false);
      }, 2000);
    }
  };

  /**
   * Handle keyboard events
   * - Enter: Send message
   */
  const handleKeyDown = (e) => {
    // Handle Enter to send
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onTyping?.(false); // Stop typing indicator when sending
        onSend?.();
      }
    }
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="relative w-full">
      <div
        className="
          flex items-end gap-2
          bg-zinc-900/60 border border-white/10
          rounded-xl px-3 py-2
          focus-within:border-teal-500/50
          transition-colors w-full
        "
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="
            flex-1 resize-none bg-transparent
            text-sm text-white placeholder-zinc-500
            focus:outline-none
            overflow-y-auto max-h-32
            no-scrollbar
          "
        />

        <button
          onClick={() => canSend && onSend?.()}
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
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
