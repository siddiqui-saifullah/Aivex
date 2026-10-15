import type { Timestamp } from "../../../types";

/** Where a bubble sits inside a run of grouped messages. */
export type BubblePosition = "single" | "start" | "middle" | "end";

export interface BubbleProps {
  text: string;
  timestamp?: Timestamp;
  isTyping?: boolean;
  isStreaming?: boolean;
  isAI?: boolean;
  position?: BubblePosition;
}
