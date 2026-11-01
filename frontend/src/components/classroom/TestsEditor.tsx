import { ChevronDown, EyeOff, FlaskConical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { DraftTest } from "./draftTest";
import { draftTest } from "./draftTest";

const field =
  "w-full rounded-lg border border-white/10 bg-black px-3 py-2 font-mono text-xs text-white placeholder-zinc-600 focus:border-teal-500/50 focus:outline-none";

/** Test cases for auto-grading: input on stdin, the exact output expected. */
const TestsEditor = ({ tests, onChange }: { tests: DraftTest[]; onChange: (tests: DraftTest[]) => void }) => {
  const [open, setOpen] = useState<string | null>(null);
  const update = (key: string, patch: Partial<DraftTest>) => onChange(tests.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const total = tests.reduce((n, t) => n + (Number(t.points) || 0), 0);

  const add = () => {
    const t = draftTest({ name: `Test ${tests.length + 1}` });
    onChange([...tests, t]);
    setOpen(t.key);
  };

  return (
    <fieldset className="rounded-xl border border-white/10 p-3">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-medium text-zinc-200">
        <FlaskConical size={14} className="text-teal-300" /> Auto-grading tests (optional)
      </legend>
      <p className="mb-3 text-xs text-zinc-500">
        Each test gives the program some input and checks what it prints. Students can run the visible ones while they work;
        hidden tests are only used for grading. {tests.length > 0 && <span className="text-zinc-300">Total: {total} points.</span>}
      </p>
      <ul className="space-y-2">
        {tests.map((t, i) => {
          const expanded = open === t.key;
          return (
            <li key={t.key} className="rounded-lg border border-white/10 bg-zinc-950">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => setOpen(expanded ? null : t.key)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <ChevronDown size={14} className={`shrink-0 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  <span className="truncate text-sm text-zinc-200">{t.name || `Test ${i + 1}`}</span>
                  {t.hidden && <EyeOff size={12} className="shrink-0 text-zinc-500" aria-label="Hidden" />}
                  <span className="shrink-0 text-xs text-zinc-500">{t.points} pt{Number(t.points) === 1 ? "" : "s"}</span>
                  {!t.expected.trim() && <span className="shrink-0 text-xs text-amber-300">needs output</span>}
                </button>
                <button type="button" onClick={() => onChange(tests.filter((x) => x.key !== t.key))} aria-label={`Remove ${t.name || `test ${i + 1}`}`} className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
              {expanded && (
                <div className="space-y-2 border-t border-white/10 p-3">
                  <div className="grid grid-cols-[1fr_5rem] gap-2">
                    <label className="text-[11px] text-zinc-500">Name
                      <input value={t.name} maxLength={80} onChange={(e) => update(t.key, { name: e.target.value })} className={`${field} mt-1 font-sans`} />
                    </label>
                    <label className="text-[11px] text-zinc-500">Points
                      <input type="number" min={1} max={100} value={t.points} onChange={(e) => update(t.key, { points: Number(e.target.value) })} className={`${field} mt-1`} />
                    </label>
                  </div>
                  <label className="block text-[11px] text-zinc-500">Input (what the student's program reads)
                    <textarea rows={2} value={t.input} maxLength={10000} onChange={(e) => update(t.key, { input: e.target.value })} placeholder="e.g. 2 3" className={`${field} mt-1 resize-y`} />
                  </label>
                  <label className="block text-[11px] text-zinc-500">Expected output
                    <textarea rows={2} value={t.expected} maxLength={10000} onChange={(e) => update(t.key, { expected: e.target.value })} placeholder="e.g. 5" className={`${field} mt-1 resize-y`} />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-300">
                    <input type="checkbox" checked={t.hidden} onChange={(e) => update(t.key, { hidden: e.target.checked })} className="accent-teal-500" />
                    Hidden from students (used only for grading)
                  </label>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={add} disabled={tests.length >= 30} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs text-zinc-300 hover:border-teal-500/40 hover:text-white disabled:opacity-40">
        <Plus size={13} /> Add a test
      </button>
      <p className="mt-2 text-[11px] text-zinc-600">Spaces at the end of lines and blank lines at the end don't matter; everything else must match.</p>
    </fieldset>
  );
};

export default TestsEditor;
