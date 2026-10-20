import { useState, type FormEvent, type ReactNode } from "react";
import { GraduationCap, KeyRound, X } from "lucide-react";
import Button from "../ui/Button";
import { TECH_STACKS, type TechStack } from "../../constants/options";
import { getErrorMessage } from "../../utils/getErrorMessage";
import type { Project } from "../../types";
import AiToggle from "./AiToggle";

const ModalShell = ({ title, subtitle, icon, onClose, children }: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
    <div className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl p-6 animate-pop-in">
      <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-white">
        <X size={18} />
      </button>
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-300">{icon}</div>
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="text-sm text-zinc-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  </div>
);

const labelClass = "block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider";

/* -------------------------------------------------------------------------- */
/* CREATE CLASS                                                               */
/* -------------------------------------------------------------------------- */
export const CreateClassModal = ({ onClose, onCreate, templates }: {
  onClose: () => void;
  onCreate: (data: { name: string; stack: string; templateProjectId?: string; aiEnabled: boolean }) => Promise<void>;
  /** The teacher's own projects that can be copied to every student. */
  templates: Project[];
}) => {
  const [name, setName] = useState("");
  const [stack, setStack] = useState<TechStack>("C");
  const [templateId, setTemplateId] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Give the class a name (e.g. “CS101 Lab — Section A”)");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onCreate({ name: trimmed, stack, templateProjectId: templateId || undefined, aiEnabled });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not create the class"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title="Create a class"
      subtitle="Students join with a code and each gets their own copy of the starter code."
      icon={<GraduationCap size={20} />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="class-name" className={labelClass}>Class name</label>
          <input
            id="class-name"
            autoFocus
            value={name}
            maxLength={60}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder="e.g. C Programming Lab — Batch A"
            className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-teal-500/50 focus:outline-none"
          />
        </div>

        <div>
          <span className={labelClass}>Starter code</span>
          {!templateId && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
              {TECH_STACKS.map((tech) => (
                <button
                  key={tech}
                  type="button"
                  onClick={() => setStack(tech)}
                  aria-pressed={stack === tech}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    stack === tech
                      ? "bg-teal-500/10 border-teal-500/50 text-teal-400"
                      : "bg-zinc-900/50 border-white/5 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {tech}
                </button>
              ))}
            </div>
          )}
          {templates.length > 0 && (
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              aria-label="Copy starter code from one of your projects"
              className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-200 focus:border-teal-500/50 focus:outline-none"
            >
              <option value="">…or copy one of my projects as the assignment</option>
              {templates.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        <AiToggle enabled={aiEnabled} onChange={setAiEnabled} compact />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button type="submit" variant="primary" fullWidth loading={loading}>
          Create class
        </Button>
      </form>
    </ModalShell>
  );
};

/* -------------------------------------------------------------------------- */
/* JOIN CLASS                                                                 */
/* -------------------------------------------------------------------------- */
export const JoinClassModal = ({ onClose, onJoin }: {
  onClose: () => void;
  onJoin: (code: string) => Promise<void>;
}) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError("Class codes have 6 characters");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onJoin(code);
    } catch (err) {
      setError(getErrorMessage(err, "Could not join the class"));
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title="Join a class"
      subtitle="Enter the code your teacher shared. You'll get your own copy of the assignment."
      icon={<KeyRound size={20} />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        <input
          autoFocus
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
            setError("");
          }}
          placeholder="ABC123"
          aria-label="Class code"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-4 text-center font-mono text-3xl tracking-[0.4em] text-white placeholder-zinc-700 focus:border-teal-500/50 focus:outline-none"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" variant="primary" fullWidth loading={loading} disabled={code.length !== 6}>
          Join class
        </Button>
      </form>
    </ModalShell>
  );
};
