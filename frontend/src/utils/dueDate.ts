import type { AiPolicy } from "../types";
import { plural } from "./plural";

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** "Due tomorrow 5:00 PM", "Due in 3 days", "Overdue by 2 hours"... */
export const describeDue = (dueAt: string | null | undefined, now = Date.now()) => {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  const diff = due.getTime() - now;
  const when = due.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  if (diff < 0) {
    const late = -diff;
    const ago = late < HOUR ? `${Math.max(1, Math.round(late / 60_000))} min` : late < DAY ? `${Math.round(late / HOUR)} h` : `${Math.round(late / DAY)} d`;
    return { overdue: true, soon: false, label: `Overdue by ${ago}`, when };
  }
  const label = diff < HOUR
    ? `Due in ${Math.max(1, Math.round(diff / 60_000))} min`
    : diff < DAY
      ? `Due in ${Math.round(diff / HOUR)} h`
      : `Due in ${plural(Math.round(diff / DAY), "day")}`;
  return { overdue: false, soon: diff < DAY, label, when };
};

export const AI_POLICY_LABELS: Record<AiPolicy, { label: string; hint: string }> = {
  allowed: { label: "AI allowed", hint: "Students can use Vex AI as usual." },
  hints: { label: "Hints only", hint: "Vex explains and guides, but never writes code into the project." },
  disabled: { label: "No AI", hint: "Students can't use Vex AI on this assignment." },
};

/** <input type="datetime-local"> value for a date, in local time. */
export const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
