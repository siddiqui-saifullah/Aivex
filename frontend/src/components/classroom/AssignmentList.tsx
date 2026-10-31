import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ClipboardList, Loader2, Plus } from "lucide-react";
import AssignmentModal from "./AssignmentModal";
import SubmissionBadge from "./SubmissionBadge";
import { createAssignment, startAssignment } from "../../services/assignment.service";
import { useToast } from "../../context/toast.context";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { AI_POLICY_LABELS, describeDue } from "../../utils/dueDate";
import type { AssignmentSummary, ClassroomRole } from "../../types";

/** A class's assignments: the teacher creates them and sees progress; students start or continue them. */
const AssignmentList = ({ classroomId, role, assignments, now, onChanged }: {
  classroomId: string;
  role: ClassroomRole;
  assignments: AssignmentSummary[];
  now: number;
  onChanged: () => void;
}) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const open = async (a: AssignmentSummary) => {
    if (a.projectId) {
      navigate(`/projects/${a.projectId}`);
      return;
    }
    setOpening(a._id);
    try {
      const { projectId } = await startAssignment(a._id);
      navigate(`/projects/${projectId}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not start the assignment"));
      setOpening(null);
    }
  };

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">Assignments</h2>
        {role === "teacher" && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-medium text-black hover:bg-teal-400"
          >
            <Plus size={15} /> New assignment
          </button>
        )}
      </div>

      {assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
          <ClipboardList size={22} className="mx-auto mb-2 text-zinc-600" />
          <p className="font-medium text-zinc-200">No assignments yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            {role === "teacher"
              ? "Give the class something to build: instructions, starter code, a due date and how much Vex AI may help."
              : "Your teacher hasn't posted any assignments. You can keep practising in your class project."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {assignments.map((a) => {
            const due = describeDue(a.dueAt, now);
            const meta = (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                {due ? (
                  <span className={due.overdue ? "text-red-400" : due.soon ? "text-amber-300" : ""} title={due.when}>
                    {due.label}
                  </span>
                ) : (
                  <span>No due date</span>
                )}
                <span title={AI_POLICY_LABELS[a.aiPolicy].hint}>{AI_POLICY_LABELS[a.aiPolicy].label}</span>
                {role === "teacher" && <span>{a.started ?? 0}/{a.studentCount ?? 0} started</span>}
                {role === "teacher" && (a.submitted ?? 0) > 0 && <span>{a.submitted} submitted</span>}
                {role === "teacher" && (a.toReview ?? 0) > 0 && <span className="font-medium text-sky-300">{a.toReview} to review</span>}
                {role === "student" && a.submission && <SubmissionBadge status={a.submission.status} version={a.submission.version} />}
              </div>
            );

            return (
              <li key={a._id}>
                {role === "teacher" ? (
                  <Link
                    to={`/classes/${classroomId}/assignments/${a._id}`}
                    className="group flex items-center gap-3 rounded-xl border border-white/5 bg-zinc-900/50 p-4 hover:border-teal-500/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-100">{a.title}</p>
                      {meta}
                    </div>
                    <ArrowRight size={16} className="shrink-0 text-zinc-600 group-hover:text-teal-300" />
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-zinc-900/50 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-100">{a.title}</p>
                      {meta}
                    </div>
                    <button
                      onClick={() => open(a)}
                      disabled={opening === a._id}
                      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
                        a.projectId
                          ? "border border-white/10 text-zinc-200 hover:border-teal-500/40"
                          : "bg-teal-500 text-black hover:bg-teal-400"
                      }`}
                    >
                      {opening === a._id && <Loader2 size={14} className="animate-spin" />}
                      {a.projectId ? "Continue" : "Start"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <AssignmentModal
          onClose={() => setCreating(false)}
          onSave={async (input) => {
            const created = await createAssignment(classroomId, input);
            toast.success(`“${created.title}” posted to the class`);
            onChanged();
          }}
        />
      )}
    </section>
  );
};

export default AssignmentList;
