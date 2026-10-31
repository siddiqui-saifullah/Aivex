import { useEffect, useState, type FormEvent } from "react";
import { ClipboardList } from "lucide-react";
import Button from "../ui/Button";
import { ModalShell, labelClass } from "./ClassModals";
import { getProjects } from "../../services/project.service";
import { useUser } from "../../context/user.context";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { AI_POLICY_LABELS, toLocalInput } from "../../utils/dueDate";
import type { AssignmentInput } from "../../services/assignment.service";
import type { AiPolicy, Project, ProjectAssignment } from "../../types";

const POLICIES: AiPolicy[] = ["allowed", "hints", "disabled"];

const inputClass =
  "w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-teal-500/50 focus:outline-none";

/** Create an assignment, or edit one (`initial`). Starter code is chosen on create only. */
const AssignmentModal = ({ initial, onClose, onSave }: {
  initial?: ProjectAssignment;
  onClose: () => void;
  onSave: (input: AssignmentInput) => Promise<void>;
}) => {
  const { user } = useUser();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [due, setDue] = useState(toLocalInput(initial?.dueAt));
  const [aiPolicy, setAiPolicy] = useState<AiPolicy>(initial?.aiPolicy ?? "hints");
  const [templateId, setTemplateId] = useState("");
  const [templates, setTemplates] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // The teacher's own personal projects can be copied as starter code
  useEffect(() => {
    if (initial) return;
    let alive = true;
    getProjects()
      .then((all) => {
        if (!alive) return;
        setTemplates(all.filter((p) => !p.classroom && (p.ownerId ?? "") === String(user?._id ?? "")));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [initial, user?._id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) {
      setError("Give the assignment a title (e.g. “Loops: print 1 to 10”)");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onSave({
        title: title.trim(),
        instructions,
        dueAt: due ? new Date(due).toISOString() : null,
        aiPolicy,
        ...(initial ? {} : { templateProjectId: templateId || undefined }),
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not save the assignment"));
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title={initial ? "Edit assignment" : "New assignment"}
      subtitle={initial ? "Students see changes right away." : "Each student who starts it gets their own copy of the starter code."}
      icon={<ClipboardList size={20} />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="max-h-[70dvh] space-y-4 overflow-y-auto pr-1">
        <div>
          <label htmlFor="assignment-title" className={labelClass}>Title</label>
          <input
            id="assignment-title"
            autoFocus
            value={title}
            maxLength={100}
            onChange={(e) => {
              setTitle(e.target.value);
              setError("");
            }}
            placeholder="e.g. Loops: print 1 to 10"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="assignment-instructions" className={labelClass}>Instructions</label>
          <textarea
            id="assignment-instructions"
            value={instructions}
            maxLength={10000}
            rows={5}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="What should students build? Add the expected output or rules."
            className={`${inputClass} resize-y`}
          />
        </div>

        <div>
          <label htmlFor="assignment-due" className={labelClass}>Due date (optional)</label>
          <input
            id="assignment-due"
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className={`${inputClass} [color-scheme:dark]`}
          />
        </div>

        <fieldset>
          <legend className={labelClass}>Vex AI for students</legend>
          <div className="space-y-2">
            {POLICIES.map((policy) => (
              <label
                key={policy}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
                  aiPolicy === policy ? "border-teal-500/50 bg-teal-500/10" : "border-white/10 hover:border-white/20"
                }`}
              >
                <input
                  type="radio"
                  name="ai-policy"
                  value={policy}
                  checked={aiPolicy === policy}
                  onChange={() => setAiPolicy(policy)}
                  className="mt-1 accent-teal-500"
                />
                <span>
                  <span className="block text-sm font-medium text-zinc-100">{AI_POLICY_LABELS[policy].label}</span>
                  <span className="block text-xs text-zinc-500">{AI_POLICY_LABELS[policy].hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {!initial && (
          <div>
            <label htmlFor="assignment-template" className={labelClass}>Starter code</label>
            <select
              id="assignment-template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className={inputClass}
            >
              <option value="">The class's starter code</option>
              {templates.map((p) => (
                <option key={p._id} value={p._id}>Copy my project: {p.name}</option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button type="submit" variant="primary" fullWidth loading={loading}>
          {initial ? "Save changes" : "Create assignment"}
        </Button>
      </form>
    </ModalShell>
  );
};

export default AssignmentModal;
