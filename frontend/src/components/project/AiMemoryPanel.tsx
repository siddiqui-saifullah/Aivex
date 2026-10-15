import { useState } from "react";
import { Brain, Loader2 } from "lucide-react";

const MAX_MEMORY = 2000;

interface AiMemoryPanelProps {
  memory: string;
  /** Returns true when saved. */
  onSave: (memory: string) => Promise<boolean>;
}

/**
 * Long-term notes Vex AI keeps about the project (purpose, stack, user
 * preferences). The AI updates them itself; members can read, edit or clear.
 */
const AiMemoryPanel = ({ memory, onSave }: AiMemoryPanelProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(memory);
  const [isSaving, setIsSaving] = useState(false);

  const save = async (value: string) => {
    setIsSaving(true);
    const ok = await onSave(value);
    setIsSaving(false);
    if (ok) setIsEditing(false);
  };

  return (
    <section className="border-t border-white/10 pt-3 mt-3 mb-3 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <h4 className="flex items-center gap-1.5 text-xs uppercase text-zinc-500">
          <Brain size={13} className="text-teal-400" /> AI memory
        </h4>
        {!isEditing && (
          <button
            onClick={() => {
              setDraft(memory);
              setIsEditing(true);
            }}
            className="text-xs text-teal-400 hover:text-teal-300"
          >
            {memory ? "Edit" : "Add"}
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_MEMORY}
            rows={6}
            placeholder="e.g. Express + EJS app. Prefer Tailwind, keep code commented in English."
            className="w-full resize-none rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500/50"
          />
          <div className="flex items-center gap-2 text-xs">
            <button
              disabled={isSaving}
              onClick={() => save(draft)}
              className="flex items-center gap-1 rounded bg-teal-500 px-2 py-0.5 font-medium text-black hover:bg-teal-400 disabled:opacity-50"
            >
              {isSaving && <Loader2 size={11} className="animate-spin" />} Save
            </button>
            <button
              disabled={isSaving}
              onClick={() => save("")}
              className="rounded px-2 py-0.5 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              Clear
            </button>
            <button
              disabled={isSaving}
              onClick={() => setIsEditing(false)}
              className="rounded px-2 py-0.5 text-zinc-400 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <span className="ml-auto text-zinc-600">{draft.length}/{MAX_MEMORY}</span>
          </div>
        </div>
      ) : memory ? (
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-300 max-h-32 overflow-y-auto">
          {memory}
        </p>
      ) : (
        <p className="text-xs text-zinc-500">
          Vex will remember key facts about this project here as you chat.
        </p>
      )}
    </section>
  );
};

export default AiMemoryPanel;
