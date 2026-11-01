import { useState } from "react";
import { FlaskConical, Loader2, RefreshCw } from "lucide-react";
import TestResults, { type TestRow } from "./TestResults";
import { recordTestRuns } from "../../services/assignment.service";
import { runTests } from "../../utils/testRunner";
import { useToast } from "../../context/toast.context";
import { getErrorMessage } from "../../utils/getErrorMessage";
import type { SubmissionDetails, SubmissionTests } from "../../types";

const formatTime = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * Auto-grading on a submission. The teacher runs every test (hidden ones
 * too) in their browser; the server scores the outputs. Students see their
 * results, without the details of hidden tests.
 */
const SubmissionTestsPanel = ({ data, onGraded }: { data: SubmissionDetails; onGraded: (tests: SubmissionTests) => void }) => {
  const toast = useToast();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const isTeacher = data.role === "teacher";
  const cases = data.testCases?.tests ?? [];
  if (!cases.length && !data.tests) return null;

  const run = async () => {
    setProgress({ done: 0, total: cases.length });
    try {
      const runs = await runTests(data.files, data.stack, cases, (done, total) => setProgress({ done, total }));
      onGraded(await recordTestRuns(data._id, runs));
      toast.success("Tests finished");
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not run the tests"));
    } finally {
      setProgress(null);
    }
  };

  const tests = data.tests;
  const rows: TestRow[] = tests
    ? tests.results.map((r) => {
      const c = cases.find((x) => x._id === r.test);
      return {
        key: r.test,
        name: r.name,
        points: r.points,
        hidden: r.hidden,
        outcome: r.outcome,
        ...(c ? { input: c.input, expected: c.expected } : {}),
        ...(isTeacher || !r.hidden ? { output: r.output } : {}),
      };
    })
    : [];

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          <FlaskConical size={13} className="text-teal-300" /> Auto-grading
        </h2>
        {isTeacher && cases.length > 0 && (
          <button
            onClick={run}
            disabled={!!progress}
            className="flex items-center gap-1.5 rounded-md border border-teal-500/40 px-2 py-1 text-xs font-medium text-teal-200 hover:bg-teal-500/10 disabled:opacity-60"
          >
            {progress ? <Loader2 size={12} className="animate-spin" /> : tests ? <RefreshCw size={12} /> : <FlaskConical size={12} />}
            {progress ? `Running ${Math.min(progress.done + 1, progress.total)}/${progress.total}` : tests ? "Run again" : "Run tests"}
          </button>
        )}
      </div>
      {tests ? (
        <>
          <p className="text-2xl font-semibold tabular-nums text-white">
            {tests.score}<span className="text-base text-zinc-500">/{tests.total} pts</span>
          </p>
          <p className="mb-3 text-xs text-zinc-500">
            {tests.results.filter((r) => r.passed).length} of {tests.results.length} tests passed ·{" "}
            {tests.by === "server" ? "graded automatically" : "run by the teacher"} {formatTime(tests.ranAt)}
          </p>
          <TestResults rows={rows} compact />
        </>
      ) : (
        <p className="text-sm text-zinc-500">
          {isTeacher
            ? `${cases.length} test${cases.length === 1 ? "" : "s"} ready. Run them to score this submission.`
            : "Not graded yet."}
        </p>
      )}
    </div>
  );
};

export default SubmissionTestsPanel;
