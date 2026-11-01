import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { GithubIcon } from "../../assets/fileIcons";
import { connectGitHub, disconnectGitHub, getGitHubStatus, type GitHubStatus } from "../../services/github.service";
import { useToast } from "../../context/toast.context";
import { getErrorMessage } from "../../utils/getErrorMessage";

/** Settings → Account: connect or disconnect GitHub (for pushing projects). */
const GitHubSettingsCard = () => {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getGitHubStatus().then(setStatus).catch(() => undefined);
  }, []);

  // Back from GitHub
  useEffect(() => {
    const result = params.get("github");
    if (!result) return;
    if (result === "connected") toast.success("GitHub connected");
    else if (result === "error") toast.error(params.get("message") || "GitHub didn't connect. Try again.");
    else if (result === "cancelled") toast.info("GitHub wasn't connected");
    setParams({}, { replace: true });
  }, [params, setParams, toast]);

  if (!status?.available) return null;

  const connect = async () => {
    setBusy(true);
    try {
      await connectGitHub("/settings/account");
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not connect GitHub"));
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await disconnectGitHub();
      setStatus({ ...status, connected: false, login: "", connectedAt: null });
      toast.info("GitHub disconnected");
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not disconnect GitHub"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-white"><GithubIcon size={22} /></span>
          <div>
            <h2 className="text-base font-semibold text-white">GitHub</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {status.connected
                ? <>Connected as <span className="text-zinc-200">@{status.login}</span>. Push projects to your repositories, pull changes and import repositories.</>
                : "Push your projects to GitHub repositories (public or private), pull changes back and import repositories."}
            </p>
          </div>
        </div>
        <button
          onClick={status.connected ? disconnect : connect}
          disabled={busy}
          className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
            status.connected ? "border border-white/15 text-zinc-200 hover:border-red-500/40 hover:text-red-300" : "bg-white text-black hover:bg-zinc-200"
          }`}
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {status.connected ? "Disconnect" : "Connect GitHub"}
        </button>
      </div>
    </section>
  );
};

export default GitHubSettingsCard;
