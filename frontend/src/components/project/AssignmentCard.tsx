import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ChevronDown, ClipboardList, Loader2, Send } from "lucide-react";
import SubmissionBadge from "../classroom/SubmissionBadge";
import { getAssignment } from "../../services/assignment.service";
import type { ProjectAssignment, SubmissionSummary } from "../../types";
import { AI_POLICY_LABELS, describeDue } from "../../utils/dueDate";

const storageKey = (id: string) => `assignment-card:${id}`;

/**
 * The assignment a student's project is for: title, due date, AI rule and
 * instructions. The student hands their work in from here.
 */
const AssignmentCard = ({ assignment, isTeacher, onSubmit }: {
  assignment: ProjectAssignment;
  isTeacher: boolean;
  /** Student: save and hand in the project. */
  onSubmit?: (note: string) => Promise<boolean>;
}) => {
  const [latest, setLatest] = useState<SubmissionSummary | null>(null);
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const loadLatest = useCallback(() => {
    if (isTeacher) return;
    getAssignment(assignment._id)
      .then((a) => setLatest(a.submissions?.[0] ?? null))
      .catch(() => undefined);
  }, [assignment._id, isTeacher]);
  useEffect(loadLatest, [loadLatest]);

  const submit = async () => {
    if (!onSubmit) return;
    setSending(true);
    const ok = await onSubmit(note.trim());
    setSending(false);
    if (ok) {
      setComposing(false);
      setNote("");
      loadLatest();
    }
  };

  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(storageKey(assignment._id)) !== "closed";
    } catch {
      return true;
    }
  });
  const due = describeDue(assignment.dueAt);
  const rule = AI_POLICY_LABELS[assignment.aiPolicy];

  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(storageKey(assignment._id), o ? "closed" : "open");
      } catch {
        // Private mode: just don't remember
      }
      return !o;
    });
  };

  return (
    <div className="shrink-0 border-b border-white/10 bg-teal-500/[0.03]">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.02]"
      >
        <ClipboardList size={15} className="shrink-0 text-teal-300" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{assignment.title}</span>
        {due && (
          <span className={`shrink-0 text-[11px] ${due.overdue ? "text-red-400" : due.soon ? "text-amber-300" : "text-zinc-500"}`}>
            {due.label}
          </span>
        )}
        <ChevronDown size={15} className={`shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
            {due && (
              <span className="flex items-center gap-1">
                <CalendarClock size={12} /> {due.when}
              </span>
            )}
            <span title={rule.hint}>{rule.label}</span>
            <Link
              to={isTeacher ? `/classes/${assignment.classroom}/assignments/${assignment._id}` : `/classes/${assignment.classroom}`}
              className="text-teal-300 hover:underline"
            >
              {isTeacher ? "All students' work" : "All assignments"}
            </Link>
          </div>
          {!isTeacher && (
            <div className="rounded-lg border border-white/10 bg-black/40 p-2.5">
              {latest && (
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  <SubmissionBadge status={latest.status} version={latest.version} />
                  <Link
                    to={`/classes/${assignment.classroom}/assignments/${assignment._id}/submissions/${latest._id}`}
                    className="text-teal-300 hover:underline"
                  >
                    {latest.status === "submitted" ? "View" : "See feedback"}
                  </Link>
                </div>
              )}
              {latest?.status === "revision-requested" && latest.feedback && (
                <p className="mb-2 line-clamp-3 text-xs text-amber-200/90">“{latest.feedback}”</p>
              )}
              {composing ? (
                <div className="space-y-2">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={1000}
                    rows={2}
                    autoFocus
                    aria-label="Note for your teacher"
                    placeholder="Note for your teacher (optional)"
                    className="w-full resize-none rounded-md border border-white/10 bg-black px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-teal-500/50 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setComposing(false)} className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200">
                      Cancel
                    </button>
                    <button
                      onClick={submit}
                      disabled={sending}
                      className="flex items-center gap-1.5 rounded-md bg-teal-500 px-2.5 py-1 text-xs font-medium text-black hover:bg-teal-400 disabled:opacity-60"
                    >
                      {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      {latest ? "Submit again" : "Submit"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setComposing(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md bg-teal-500 px-2.5 py-1.5 text-xs font-medium text-black hover:bg-teal-400"
                >
                  <Send size={12} /> {latest ? "Submit a new version" : "Submit assignment"}
                </button>
              )}
              <p className="mt-1.5 text-[10px] text-zinc-500">
                Your teacher gets a copy of your files as they are now. You can keep working afterwards. Your teacher can also see your{" "}
                <Link to={`/classes/${assignment.classroom}/assignments/${assignment._id}`} className="underline hover:text-zinc-300">coding journey</Link>
                {" "}(saves, runs and questions to Vex).
              </p>
            </div>
          )}
          {assignment.instructions ? (
            <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">
              {assignment.instructions}
            </p>
          ) : (
            <p className="text-xs text-zinc-500">No instructions.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AssignmentCard;
