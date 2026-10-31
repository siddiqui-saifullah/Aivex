import { useEffect, useRef, useState } from "react";
import { LifeBuoy, Loader2 } from "lucide-react";
import { requestHelp, resolveHelpRequest } from "../../services/classroom.service";
import { useToast } from "../../context/toast.context";
import { getErrorMessage } from "../../utils/getErrorMessage";

/** Student: ask the class teacher to come and help in this project, or withdraw the request. */
const HelpButton = ({ projectId, request, onChanged }: {
  projectId: string;
  request: { _id: string; createdAt: string } | null | undefined;
  onChanged: () => void;
}) => {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const ask = async () => {
    setBusy(true);
    try {
      await requestHelp(projectId, message.trim());
      toast.success("Your teacher has been asked for help");
      setOpen(false);
      setMessage("");
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not ask for help"));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!request) return;
    setBusy(true);
    try {
      await resolveHelpRequest(request._id);
      toast.info("Help request withdrawn");
      setOpen(false);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not withdraw the request"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={request ? "Waiting for your teacher" : "Ask your teacher for help"}
        className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
          request ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/20" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
        }`}
      >
        <LifeBuoy size={15} />
        <span className="hidden lg:inline">{request ? "Help requested" : "Ask teacher"}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-white/10 bg-zinc-950 p-3 shadow-xl shadow-black/50">
          {request ? (
            <>
              <p className="text-sm font-medium text-zinc-100">Your teacher has been asked</p>
              <p className="mt-1 text-xs text-zinc-500">They can open this project and help you live, here or in the chat.</p>
              <button
                onClick={withdraw}
                disabled={busy}
                className="mt-3 w-full rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-white/20 disabled:opacity-60"
              >
                {busy ? <Loader2 size={13} className="mx-auto animate-spin" /> : "I don't need help anymore"}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-zinc-100">Ask your teacher for help</p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                rows={3}
                autoFocus
                aria-label="What do you need help with?"
                placeholder="What are you stuck on? (optional)"
                className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-black px-2.5 py-2 text-xs text-white placeholder-zinc-600 focus:border-teal-500/50 focus:outline-none"
              />
              <button
                onClick={ask}
                disabled={busy}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-teal-400 disabled:opacity-60"
              >
                {busy && <Loader2 size={13} className="animate-spin" />} Ask for help
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default HelpButton;
