import { useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Circle, Loader2, Minus } from "lucide-react";
import type { RunStepStatus } from "../../config/webContainer";
import { RUN_STEP_LABELS, type RunStep } from "../../utils/runSteps";
import type { OutputLine } from "./OutputPanel";

interface RunLoaderProps {
  steps: RunStep[];
  startedAt: number;
  /** Raw container output, hidden behind "Show logs". */
  logs: OutputLine[];
  /** Errors thrown inside the preview page. */
  previewErrors: string[];
}

const StepIcon = ({ status }: { status: RunStepStatus }) => {
  switch (status) {
    case "done":
      return <Check size={13} className="text-emerald-400" />;
    case "active":
      return <Loader2 size={13} className="text-teal-300 animate-spin" />;
    case "error":
      return <AlertTriangle size={13} className="text-red-400" />;
    case "skipped":
      return <Minus size={13} className="text-zinc-500" />;
    default:
      return <Circle size={9} className="text-zinc-700" />;
  }
};

/**
 * Friendly progress for running a Node project: one line per stage with a
 * live progress line, instead of the raw npm / container output.
 */
const RunLoader = ({ steps, startedAt, logs, previewErrors }: RunLoaderProps) => {
  const [now, setNow] = useState(() => Date.now());
  const [showLogs, setShowLogs] = useState(false);

  const isRunning = steps.some((s) => s.status === "active");
  const failed = steps.find((s) => s.status === "error");
  const finished = steps.filter((s) => s.status === "done" || s.status === "skipped").length;
  const progress = Math.round((finished / steps.length) * 100);

  // Tick the elapsed timer only while something is in progress
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [isRunning]);

  // `now` ticks while running and holds its last value once finished
  const elapsed = Math.max(0, Math.round((now - startedAt) / 1000));
  // Last lines that look like errors, to explain a failure without opening the logs
  const errorTail = failed
    ? logs.filter((l) => l.text.trim()).slice(-6)
    : [];

  return (
    <div className="space-y-2 font-sans">
      {/* Progress line */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            failed ? "bg-red-500" : finished === steps.length ? "bg-emerald-400" : "bg-teal-400"
          } ${isRunning ? "animate-pulse" : ""}`}
          style={{ width: `${failed ? 100 : Math.max(progress, isRunning ? 8 : 0)}%` }}
        />
      </div>

      <ol className="space-y-1">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-xs">
            <span className="w-4 flex justify-center shrink-0">
              <StepIcon status={step.status} />
            </span>
            <span
              className={
                step.status === "pending"
                  ? "text-zinc-600"
                  : step.status === "error"
                    ? "text-red-300"
                    : step.status === "active"
                      ? "text-white"
                      : "text-zinc-400"
              }
            >
              {RUN_STEP_LABELS[step.id]}
            </span>
            {step.detail && (
              <span className="truncate text-zinc-600 font-mono text-[11px]">· {step.detail}</span>
            )}
          </li>
        ))}
      </ol>

      <p className="text-[11px] text-zinc-600">
        {failed ? "Stopped" : isRunning ? "Working" : "Done"} · {elapsed}s
      </p>

      {failed && errorTail.length > 0 && (
        <pre className="rounded-md border border-red-500/20 bg-red-500/5 p-2 text-[11px] leading-relaxed text-red-200 whitespace-pre-wrap break-all font-mono">
          {errorTail.map((l) => l.text).join("\n")}
        </pre>
      )}

      {previewErrors.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-200 space-y-1">
          <p className="font-medium">Your app threw an error in the preview (this is why it looks blank):</p>
          {previewErrors.slice(-3).map((err, i) => (
            <p key={i} className="font-mono break-all">{err}</p>
          ))}
        </div>
      )}

      {logs.length > 0 && (
        <div>
          <button
            onClick={() => setShowLogs((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
          >
            {showLogs ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {showLogs ? "Hide logs" : `Show logs (${logs.length} lines)`}
          </button>
          {showLogs && (
            <div className="mt-1 max-h-40 overflow-auto rounded-md bg-black/50 p-2 font-mono text-[11px] leading-relaxed">
              {logs.map((line) => (
                <div
                  key={line.id}
                  className={`whitespace-pre-wrap break-all ${line.kind === "stderr" ? "text-red-400" : "text-zinc-300"}`}
                >
                  {line.text || " "}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RunLoader;
