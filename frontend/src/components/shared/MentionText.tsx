import type { ReactNode } from "react";

// "@name" at the start or after whitespace (not emails like a@b.com)
const MENTION_RE = /(^|\s)(@[\w-]+)/g;

type Tone = "incoming" | "outgoing" | "input";

const TONE_CLASSES: Record<Tone, { ai: string; user: string }> = {
  // Padding would change text width, so the input overlay only uses colour
  input: { ai: "text-teal-300 bg-teal-500/15 rounded-sm", user: "text-sky-300 bg-sky-500/15 rounded-sm" },
  incoming: {
    ai: "rounded px-1 font-medium text-teal-300 bg-teal-500/15",
    user: "rounded px-1 font-medium text-sky-300 bg-sky-500/15",
  },
  outgoing: {
    ai: "rounded px-1 font-semibold bg-black/20",
    user: "rounded px-1 font-semibold bg-black/10 underline decoration-black/30 underline-offset-2",
  },
};

/** Text with @mentions highlighted (@Vex as the AI, everyone else as people). */
const MentionText = ({ text, tone }: { text: string; tone: Tone }) => {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION_RE)) {
    const start = (match.index ?? 0) + match[1].length;
    if (start > last) parts.push(text.slice(last, start));
    const handle = match[2];
    const isAi = handle.toLowerCase() === "@vex";
    parts.push(
      <span key={start} className={TONE_CLASSES[tone][isAi ? "ai" : "user"]}>
        {handle}
      </span>,
    );
    last = start + handle.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
};

export default MentionText;
