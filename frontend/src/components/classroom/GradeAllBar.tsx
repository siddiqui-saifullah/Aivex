import { useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { getSubmission, recordTestRuns } from "../../services/assignment.service";
import { runTests } from "../../utils/testRunner";
import { useToast } from "../../context/toast.context";
import type { AssignmentStudent } from "../../types";

/**
 * Teacher: the assignment's tests, and one button to grade every latest
 * submission that hasn't been graded yet (in this browser, one at a time).
 */
const GradeAllBar = ({ testCount, totalPoints, hiddenCount, students, onDone }: {
  testCount: number;
  totalPoints: number;
  hiddenCount: number;
  students: AssignmentStudent[];
  onDone: () => void;
}) => {
  const toast = useToast();
  const [progress, setProgress] = useState<{ done: number; total: number; name: string } | null>(null);
  const submitted = students.filter((s) => s.submission);
  const graded = submitted.filter((s) => s.submission?.tests);
  const waiting = submitted.filter((s) => !s.submission?.tests);

  const gradeAll = async (which: AssignmentStudent[]) => {
    let failed = 0;
    for (const [i, s] of which.entries()) {
      setProgress({ done: i, total: which.length, name: s.name ?? s.username ?? "student" });
      try {
        const sub = await getSubmission(s.submission!._id);
        const runs = await runTests(sub.files, sub.stack, sub.testCases.tests);
        await recordTestRuns(sub._id, runs);
      } catch {
        failed++;
      }
    }
    setProgress(null);
    onDone();
    if (failed) toast.error(`${failed} submission${failed === 1 ? "" : "s"} couldn't be graded`);
    else toast.success(`Graded ${which.length} submission${which.length === 1 ? "" : "s"}`);
  };

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-teal-500/20 bg-teal-500/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <FlaskConical size={18} className="mt-0.5 shrink-0 text-teal-300" />
        <div>
          <p className="text-sm font-medium text-zinc-100">
            {testCount} test{testCount === 1 ? "" : "s"} · {totalPoints} pts{hiddenCount ? ` · ${hiddenCount} hidden` : ""}
          </p>
          <p className="text-xs text-zinc-400">
            {progress
              ? `Grading ${progress.name} (${progress.done + 1} of ${progress.total})…`
              : `${graded.length} of ${submitted.length} submissions graded`}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        {graded.length > 0 && !progress && (
          <button onClick={() => gradeAll(submitted)} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:border-white/25">
            Re-run all
          </button>
        )}
        <button
          onClick={() => gradeAll(waiting)}
          disabled={!!progress || waiting.length === 0}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-medium text-black hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {progress && <Loader2 size={14} className="animate-spin" />}
          {waiting.length ? `Grade ${waiting.length} submission${waiting.length === 1 ? "" : "s"}` : "All graded"}
        </button>
      </div>
    </div>
  );
};

export default GradeAllBar;
