import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ChevronDown, ClipboardList } from "lucide-react";
import type { ProjectAssignment } from "../../types";
import { AI_POLICY_LABELS, describeDue } from "../../utils/dueDate";

const storageKey = (id: string) => `assignment-card:${id}`;

/** The assignment a student's project is for: title, due date, AI rule and instructions. */
const AssignmentCard = ({ assignment, isTeacher }: { assignment: ProjectAssignment; isTeacher: boolean }) => {
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
