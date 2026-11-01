import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, ClipboardPaste, Loader2, ScanSearch, X } from "lucide-react";
import {
  compareSubmissions,
  getSimilarity,
  type CompareSide,
  type SimilarityReport,
  type SimilarityStudent,
} from "../../services/assignment.service";
import { getErrorMessage } from "../../utils/getErrorMessage";

const tone = (score: number) =>
  score >= 85 ? "bg-red-500/15 text-red-300 border-red-500/30" : score >= 65 ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-zinc-500/15 text-zinc-300 border-white/10";

/** Coding-journey hints next to a name: one big paste, or code written by Vex. */
const Signals = ({ s, base }: { s: SimilarityStudent; base: string }) => (
  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
    {s.journey.biggestSave >= 25 && (
      <span className="flex items-center gap-1 text-amber-300/90" title="The most lines added in a single save">
        <ClipboardPaste size={11} /> +{s.journey.biggestSave} lines in one save
      </span>
    )}
    {s.journey.aiEdits > 0 && (
      <span className="flex items-center gap-1" title="Times Vex wrote code into the project">
        <Bot size={11} /> Vex wrote code {s.journey.aiEdits}×
      </span>
    )}
    <Link to={`${base}/journey/${s.studentId}`} className="text-teal-300 hover:underline">Journey</Link>
  </span>
);

const Side = ({ side }: { side: CompareSide }) => (
  <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-white/10">
    <p className="border-b border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
      {side.student?.name ?? "Student"} <span className="text-zinc-500">@{side.student?.username} · v{side.version}</span>
    </p>
    <div className="max-h-[60dvh] overflow-auto">
      {side.files.map((f) => {
        const matched = new Set(f.matched);
        return (
          <div key={f.path}>
            <p className="sticky top-0 border-b border-white/5 bg-zinc-950 px-3 py-1 text-[11px] text-zinc-500">{f.path}</p>
            <pre className="py-1 text-[12px] leading-5">
              {f.content.split("\n").map((line, i) => (
                <div key={i} className={`flex ${matched.has(i + 1) ? "bg-red-500/15" : ""}`}>
                  <span className="w-10 shrink-0 select-none pr-3 text-right text-zinc-600">{i + 1}</span>
                  <span className="whitespace-pre pr-3 text-zinc-200">{line || " "}</span>
                </div>
              ))}
            </pre>
          </div>
        );
      })}
    </div>
  </div>
);

const CompareModal = ({ assignmentId, a, b, score, onClose }: { assignmentId: string; a: string; b: string; score: number; onClose: () => void }) => {
  const [data, setData] = useState<{ a: CompareSide; b: CompareSide } | null>(null);
  const [error, setError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    compareSubmissions(assignmentId, a, b).then(setData).catch((err) => setError(getErrorMessage(err, "Could not compare")));
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [assignmentId, a, b, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Compare submissions" onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-6xl flex-col rounded-2xl border border-white/10 bg-zinc-950 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-300">
            <span className={`mr-2 rounded-full border px-2 py-0.5 text-xs font-semibold ${tone(score)}`}>{score}% similar</span>
            Highlighted lines appear in both (names and spacing ignored).
          </p>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"><X size={18} /></button>
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : !data ? (
          <div className="flex h-60 items-center justify-center text-zinc-500"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="flex min-h-0 flex-col gap-3 lg:flex-row"><Side side={data.a} /><Side side={data.b} /></div>
        )}
      </div>
    </div>
  );
};

/**
 * Teacher: find students whose submissions share a lot of code, even with
 * renamed variables or new comments, and compare them side by side.
 */
const CopyCheck = ({ assignmentId, base, submitted }: { assignmentId: string; base: string; submitted: number }) => {
  const [report, setReport] = useState<SimilarityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [comparing, setComparing] = useState<{ a: string; b: string; score: number } | null>(null);

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await getSimilarity(assignmentId));
    } catch (err) {
      setError(getErrorMessage(err, "Could not check the submissions"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-zinc-950 p-5" aria-labelledby="copy-check">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ScanSearch size={18} className="mt-0.5 shrink-0 text-teal-300" />
          <div>
            <h2 id="copy-check" className="text-sm font-semibold text-zinc-100">Copy check</h2>
            <p className="text-xs text-zinc-400">Compares everyone's latest submission. Renamed variables, comments and spacing don't hide copied code; the starter code is ignored.</p>
          </div>
        </div>
        <button
          onClick={run}
          disabled={loading || submitted < 2}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-zinc-100 hover:border-teal-500/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {report ? "Check again" : submitted < 2 ? "Needs 2 submissions" : "Check for copying"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {report && (
        <div className="mt-4">
          <p className="mb-3 text-xs text-zinc-500">
            {report.compared} submissions compared{report.skipped ? ` · ${report.skipped} too short to judge` : ""}.
            {" "}A high score is a reason to look, not proof: talk to the students and check their coding journeys.
          </p>
          {report.pairs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-zinc-400">No submissions look alike. 👍</p>
          ) : (
            <ul className="space-y-2">
              {report.pairs.map((p) => (
                <li key={`${p.a.submissionId}-${p.b.submissionId}`} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/40 p-3 sm:flex-row sm:items-center">
                  <span className={`w-fit shrink-0 rounded-full border px-2.5 py-0.5 text-sm font-semibold tabular-nums ${tone(p.score)}`}>{p.score}%</span>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    {[p.a, p.b].map((s) => (
                      <div key={s.submissionId} className="min-w-0">
                        <p className="truncate text-sm text-zinc-100">{s.name} <span className="text-zinc-500">@{s.username}</span></p>
                        <Signals s={s} base={base} />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setComparing({ a: p.a.submissionId, b: p.b.submissionId, score: p.score })}
                    className="shrink-0 rounded-md border border-white/15 px-3 py-1.5 text-xs text-zinc-200 hover:border-teal-500/40"
                  >
                    Compare
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {comparing && <CompareModal assignmentId={assignmentId} {...comparing} onClose={() => setComparing(null)} />}
    </section>
  );
};

export default CopyCheck;
