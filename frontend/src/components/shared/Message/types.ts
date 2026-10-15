import type { FlatFileTree, Timestamp } from "../../../types";

/** Where a bubble sits inside a run of grouped messages. */
export type BubblePosition = "single" | "start" | "middle" | "end";

export interface BubbleProps {
  text: string;
  timestamp?: Timestamp;
  isTyping?: boolean;
  isStreaming?: boolean;
  isAI?: boolean;
  position?: BubblePosition;
  /** Files generated with an AI message. */
  files?: FlatFileTree | null;
  /** Load `files` into the editor. */
  onApplyFiles?: () => void;
  /** Delete this message (only offered for your own saved messages). */
  onDelete?: () => void;
}
