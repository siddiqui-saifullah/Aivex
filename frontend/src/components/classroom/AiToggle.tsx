import { Bot, Loader2 } from "lucide-react";

/** Switch for whether students may use Vex AI in a class. */
const AiToggle = ({ enabled, onChange, busy = false, compact = false }: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  busy?: boolean;
  /** Inside a form: no card border. */
  compact?: boolean;
}) => (
  <div
    className={`flex items-center gap-3 ${
      compact ? "" : "rounded-2xl border border-white/10 bg-zinc-900/60 p-4"
    }`}
  >
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
        enabled ? "bg-teal-500/15 text-teal-300" : "bg-zinc-800 text-zinc-500"
      }`}
    >
      <Bot size={18} />
    </div>
    <div className="min-w-0 flex-1">
      <p id="ai-toggle-label" className="text-sm font-medium text-zinc-100">
        Vex AI for students
      </p>
      <p className="text-xs text-zinc-500">
        {enabled
          ? "Students can ask the AI for help in their projects."
          : "Off: students can't use the AI in this class. You still can."}
      </p>
    </div>
    {busy && <Loader2 size={14} className="animate-spin text-zinc-500" />}
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-labelledby="ai-toggle-label"
      disabled={busy}
      onClick={() => onChange(!enabled)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 disabled:opacity-60 ${
        enabled ? "bg-teal-500" : "bg-zinc-700"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-5" : ""
        }`}
      />
    </button>
  </div>
);

export default AiToggle;
