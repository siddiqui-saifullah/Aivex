import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock, Search } from "lucide-react";
import { ModalShell } from "../classroom/ClassModals";
import { GithubIcon } from "../../assets/fileIcons";
import { connectGitHub, getGitHubStatus, importGitHubRepo, listGitHubRepos, type GitHubRepo, type GitHubStatus } from "../../services/github.service";
import { useToast } from "../../context/toast.context";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { timeAgo } from "../../utils/timeAgo";

/** Dashboard: open one of the user's GitHub repositories as a new project. */
const ImportRepoModal = ({ onClose }: { onClose: () => void }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getGitHubStatus()
      .then((s) => {
        setStatus(s);
        if (s.connected) return listGitHubRepos().then(setRepos);
      })
      .catch((err) => setError(getErrorMessage(err, "Could not load GitHub")));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^https?:\/\/github\.com\//, "");
    return (repos ?? []).filter((r) => r.fullName.toLowerCase().includes(q)).slice(0, 60);
  }, [repos, query]);

  const open = async (repo: string) => {
    setImporting(repo);
    setError("");
    try {
      const res = await importGitHubRepo(repo);
      toast.success(`Imported ${res.files} files${res.skipped ? ` (${res.skipped} binary or large files skipped)` : ""}`);
      navigate(`/projects/${res.projectId}`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not import the repository"));
      setImporting(null);
    }
  };

  return (
    <ModalShell title="Import from GitHub" subtitle="Open a repository as a new project. You can pull and push it later." icon={<GithubIcon size={20} />} onClose={onClose}>
      {!status ? (
        error ? <p className="text-sm text-red-400">{error}</p> : <div className="flex h-24 items-center justify-center text-zinc-500"><Loader2 className="animate-spin" /></div>
      ) : !status.available ? (
        <p className="text-sm text-zinc-400">GitHub isn't set up on this server yet.</p>
      ) : !status.connected ? (
        <button onClick={() => connectGitHub("/dashboard?import=github")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200">
          <GithubIcon size={16} /> Connect GitHub
        </button>
      ) : (
        <div>
          <label className="relative block">
            <span className="sr-only">Search repositories</span>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your repositories"
              className="w-full rounded-xl border border-white/10 bg-zinc-900 py-2 pl-8 pr-3 text-sm text-white placeholder-zinc-500 focus:border-teal-500/50 focus:outline-none" />
          </label>
          <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
            {!repos ? (
              <li className="flex justify-center py-6 text-zinc-500"><Loader2 size={18} className="animate-spin" /></li>
            ) : shown.length === 0 ? (
              <li className="py-6 text-center text-sm text-zinc-500">No repositories found</li>
            ) : shown.map((r) => (
              <li key={r.fullName}>
                <button onClick={() => open(r.fullName)} disabled={importing !== null}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/5 disabled:opacity-60">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-sm text-zinc-100">
                      {r.fullName} {r.private && <Lock size={12} className="shrink-0 text-zinc-500" />}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">{r.description || `Updated ${timeAgo(r.updatedAt)}`}</span>
                  </span>
                  {importing === r.fullName ? <Loader2 size={16} className="shrink-0 animate-spin text-teal-300" /> : <span className="shrink-0 text-xs text-teal-300">Import</span>}
                </button>
              </li>
            ))}
          </ul>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>
      )}
    </ModalShell>
  );
};

export default ImportRepoModal;
