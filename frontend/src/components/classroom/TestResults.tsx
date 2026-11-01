import { CheckCircle2, ChevronDown, EyeOff, XCircle } from "lucide-react";
import { useState } from "react";
import { OUTCOME_LABELS } from "../../utils/testRunner";
import type { TestOutcome } from "../../types";

export interface TestRow {
  key: string;
  name: string;
  points: number;
  hidden: boolean;
  outcome: TestOutcome;
  /** Shown when expanded (never for hidden tests on the student side). */
  input?: string;
  expected?: string;
  output?: string;
}

const Block = ({ label, text }: { label: string; text: string }) => (
  <div className="min-w-0">
    <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-white/10 bg-black p-2 font-mono text-[11px] text-zinc-200">{text || <span className="text-zinc-600">(nothing)</span>}</pre>
  </div>
);

const Row = ({ row, compact }: { row: TestRow; compact?: boolean }) => {
  const [open, setOpen] = useState(false);
  const passed = row.outcome === "passed";
  const details = row.input !== undefined || row.expected !== undefined || (row.output !== undefined && row.output !== "");
  return (
    <li className="rounded-md border border-white/10 bg-black/40">
      <button
        type="button"
        onClick={() => details && setOpen((o) => !o)}
        aria-expanded={details ? open : undefined}
        className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left ${details ? "hover:bg-white/[0.03]" : "cursor-default"}`}
      >
        {passed ? <CheckCircle2 size={14} className="shrink-0 text-teal-400" /> : <XCircle size={14} className="shrink-0 text-red-400" />}
        <span className={`min-w-0 flex-1 truncate ${compact ? "text-xs" : "text-sm"} text-zinc-200`}>{row.name}</span>
        {row.hidden && <EyeOff size={12} className="shrink-0 text-zinc-500" aria-label="Hidden test" />}
        <span className={`shrink-0 text-[11px] ${passed ? "text-teal-300" : "text-red-300"}`}>{OUTCOME_LABELS[row.outcome]}</span>
        <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-zinc-500">{passed ? row.points : 0}/{row.points}</span>
        {details && <ChevronDown size={13} className={`shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      {open && details && (
        <div className={`grid gap-2 border-t border-white/10 p-2.5 ${compact ? "" : "sm:grid-cols-3"}`}>
          {row.input !== undefined && <Block label="Input" text={row.input} />}
          {row.expected !== undefined && <Block label="Expected" text={row.expected} />}
          {row.output !== undefined && <Block label={row.outcome === "compile-error" ? "Compiler" : "Got"} text={row.output} />}
        </div>
      )}
    </li>
  );
};

/** Pass/fail per test with points; click a test to see input, expected and actual output. */
const TestResults = ({ rows, compact = false }: { rows: TestRow[]; compact?: boolean }) => (
  <ul className="space-y-1.5">
    {rows.map((r) => <Row key={r.key} row={r} compact={compact} />)}
  </ul>
);

export default TestResults;
