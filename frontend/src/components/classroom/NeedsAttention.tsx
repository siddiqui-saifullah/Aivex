import { Link } from "react-router-dom";
import { ClipboardCheck, ExternalLink, LifeBuoy } from "lucide-react";
import { timeAgo } from "../../utils/timeAgo";
import type { AssignmentSummary, HelpRequestItem } from "../../types";

/** Teacher's to-do for a class: students waiting for help, and hand-ins waiting for review. */
const NeedsAttention = ({ classroomId, help, assignments, now, onResolve }: {
  classroomId: string;
  help: HelpRequestItem[];
  assignments: AssignmentSummary[];
  now: number;
  onResolve: (request: HelpRequestItem) => void;
}) => {
  const toReview = assignments.filter((a) => (a.toReview ?? 0) > 0);
  if (help.length === 0 && toReview.length === 0) return null;

  return (
    <section className="mb-10 rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-4 sm:p-5" aria-labelledby="attention-heading">
      <h2 id="attention-heading" className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-200">
        Needs your attention
      </h2>
      <ul className="space-y-2">
        {help.map((r) => {
          const name = r.student.name || r.student.username || "A student";
          return (
            <li key={r._id} className="flex flex-col gap-3 rounded-xl border border-white/5 bg-zinc-950/80 p-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <LifeBuoy size={18} className="mt-0.5 shrink-0 text-amber-300" />
                <div className="min-w-0">
                  <p className="text-sm text-zinc-100">
                    <span className="font-medium">{name}</span> needs help
                    {r.assignmentTitle && <span className="text-zinc-400"> with {r.assignmentTitle}</span>}
                    <span className="text-zinc-500"> · {timeAgo(r.createdAt, now)}</span>
                  </p>
                  {r.message && <p className="mt-0.5 line-clamp-2 text-sm text-zinc-400">“{r.message}”</p>}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  to={`/projects/${r.projectId}`}
                  className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-zinc-200"
                >
                  Open project <ExternalLink size={12} />
                </Link>
                <button
                  onClick={() => onResolve(r)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-white/20"
                >
                  Resolved
                </button>
              </div>
            </li>
          );
        })}
        {toReview.map((a) => (
          <li key={a._id}>
            <Link
              to={`/classes/${classroomId}/assignments/${a._id}`}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-zinc-950/80 p-3 hover:border-sky-500/30"
            >
              <ClipboardCheck size={18} className="shrink-0 text-sky-300" />
              <p className="min-w-0 flex-1 text-sm text-zinc-100">
                <span className="font-medium">{a.toReview}</span> {a.toReview === 1 ? "submission" : "submissions"} to review in{" "}
                <span className="font-medium">{a.title}</span>
              </p>
              <span className="shrink-0 text-xs text-sky-300">Review →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default NeedsAttention;
