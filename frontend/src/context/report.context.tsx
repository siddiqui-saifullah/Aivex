import { createContext, useCallback, useContext, useState, type FormEvent, type ReactNode } from "react";
import { Flag, X } from "lucide-react";
import { reportAbuse, type ReportReason, type ReportTarget } from "../services/report.service";
import { getErrorMessage } from "../utils/getErrorMessage";
import { useToast } from "./toast.context";

interface ReportRequest {
  targetType: ReportTarget;
  targetId: string;
  /** Shown in the dialog: "@bob", "“My project”", "a message from @bob". */
  label: string;
}

const ReportContext = createContext<{ open: (request: ReportRequest) => void } | null>(null);

const REASONS: { id: ReportReason; label: string; hint: string }[] = [
  { id: "spam", label: "Spam", hint: "Ads, scams, repeated junk or unwanted invites" },
  { id: "harassment", label: "Harassment or bullying", hint: "Insults, threats or targeting someone" },
  { id: "hate", label: "Hate speech", hint: "Attacks on religion, caste, gender, race..." },
  { id: "sexual", label: "Sexual content", hint: "Nudity or sexual messages" },
  { id: "violence", label: "Violence or self-harm", hint: "Threats, or someone may be in danger" },
  { id: "impersonation", label: "Pretending to be someone", hint: "Fake teacher, staff or another user" },
  { id: "other", label: "Something else", hint: "Tell us what happened" },
];

const ReportDialog = ({ request, onClose }: { request: ReportRequest; onClose: () => void }) => {
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setSending(true);
    setError("");
    try {
      await reportAbuse({ targetType: request.targetType, targetId: request.targetId, reason, details: details.trim() });
      toast.success("Thanks. Our team will review your report");
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not send the report"));
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
              <Flag size={18} />
            </div>
            <div>
              <h2 id="report-title" className="font-semibold text-white">Report {request.label}</h2>
              <p className="text-xs text-zinc-500">Only the Aivex team sees reports. They won't know it was you.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm text-zinc-300">What's wrong?</legend>
          {REASONS.map((r) => (
            <label
              key={r.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
                reason === r.id ? "border-red-500/40 bg-red-500/5" : "border-white/5 hover:border-white/15"
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={r.id}
                checked={reason === r.id}
                onChange={() => setReason(r.id)}
                className="mt-1 accent-red-500"
              />
              <span>
                <span className="block text-sm text-zinc-100">{r.label}</span>
                <span className="block text-xs text-zinc-500">{r.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm text-zinc-300">
            Details {reason === "other" ? "" : <span className="text-zinc-500">(optional)</span>}
          </span>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
            rows={3}
            placeholder="What happened?"
            className="w-full resize-none rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-red-500/40 focus:outline-none"
          />
        </label>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-zinc-300 hover:bg-white/5">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!reason || sending || (reason === "other" && details.trim().length < 10)}
            className="flex-1 rounded-xl bg-red-500/90 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send report"}
          </button>
        </div>
      </form>
    </div>
  );
};

/** Lets any component open the "Report" dialog for a user, project or message. */
export function ReportProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ReportRequest | null>(null);
  const open = useCallback((r: ReportRequest) => setRequest(r), []);
  return (
    <ReportContext.Provider value={{ open }}>
      {children}
      {request && <ReportDialog key={`${request.targetType}:${request.targetId}`} request={request} onClose={() => setRequest(null)} />}
    </ReportContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useReport() {
  const context = useContext(ReportContext);
  if (!context) throw new Error("useReport must be used within ReportProvider");
  return context;
}
