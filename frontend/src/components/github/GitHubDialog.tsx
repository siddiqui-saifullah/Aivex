import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink, Loader2, Lock, Search, Unlink } from "lucide-react";
import { ModalShell, labelClass } from "../classroom/ClassModals";
import { GithubIcon } from "../../assets/fileIcons";
import {
  connectGitHub,
  getGitHubStatus,
  getProjectGitHub,
  listGitHubRepos,
  pullFromGitHub,
  pushToGitHub,
  unlinkGitHub,
  type GitHubRepo,
  type GitHubStatus,
  type ProjectGitHubStatus,
} from "../../services/github.service";
import { useToast } from "../../context/toast.context";
import { getErrorMessage, getErrorStatus } from "../../utils/getErrorMessage";
import { timeAgo } from "../../utils/timeAgo";

const input =
  "w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-teal-500/50 focus:outline-none";

/** A repository name GitHub accepts, from the project's name. */
const repoNameFor = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "aivex-project";

/**
 * Push the project to GitHub (a new or existing repository), pull the latest
 * commit back, or connect GitHub first.
 */
const GitHubDialog = ({ projectId, projectName, onClose, beforePush, onPulled }: {
  projectId: string;
  projectName: string;
  onClose: () => void;
  /** Save unsaved editor changes first; false stops the push. */
  beforePush: () => Promise<boolean>;
  /** The project's files after a pull. */
  onPulled: (files: Record<string, string>) => void;
}) => {
  const toast = useToast();
  const [account, setAccount] = useState<GitHubStatus | null>(null);
  const [sync, setSync] = useState<ProjectGitHubStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"push" | "pull" | "connect" | "unlink" | null>(null);
  /** The server refused because the other side changed: offer to do it anyway. */
  const [conflict, setConflict] = useState<{ action: "push" | "pull"; message: string } | null>(null);

  const [mode, setMode] = useState<"new" | "existing">("new");
  const [repoName, setRepoName] = useState(() => repoNameFor(projectName));
  const [isPrivate, setIsPrivate] = useState(true);
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState("");
  const [message, setMessage] = useState("");

  const load = () => {
    Promise.all([getGitHubStatus(), getProjectGitHub(projectId)])
      .then(([a, s]) => {
        setAccount(a);
        setSync(s);
      })
      .catch((err) => setError(getErrorMessage(err, "Could not load GitHub")));
  };
  useEffect(load, [projectId]);

  useEffect(() => {
    if (mode !== "existing" || repos || !account?.connected) return;
    listGitHubRepos().then(setRepos).catch((err) => setError(getErrorMessage(err, "Could not load your repositories")));
  }, [mode, repos, account?.connected]);

  const shown = useMemo(
    () => (repos ?? []).filter((r) => r.fullName.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 50),
    [repos, query],
  );

  const push = async (force = false, e?: FormEvent) => {
    e?.preventDefault();
    setError("");
    setConflict(null);
    if (!sync?.link && mode === "existing" && !picked) {
      setError("Choose a repository");
      return;
    }
    setBusy("push");
    try {
      if (!(await beforePush())) return;
      const res = await pushToGitHub(projectId, {
        message: message.trim() || undefined,
        force,
        ...(sync?.link ? {} : mode === "new" ? { create: { name: repoName.trim(), private: isPrivate } } : { repo: picked }),
      });
      toast.success(res.changed ? `Pushed to ${res.repo}` : `${res.repo} is already up to date`);
      setMessage("");
      load();
    } catch (err) {
      if (getErrorStatus(err) === 409 && sync?.link) setConflict({ action: "push", message: getErrorMessage(err, "") });
      else setError(getErrorMessage(err, "Could not push to GitHub"));
    } finally {
      setBusy(null);
    }
  };

  const pull = async (force = false) => {
    setError("");
    setConflict(null);
    setBusy("pull");
    try {
      const res = await pullFromGitHub(projectId, force);
      if (res.changed && res.files) {
        onPulled(res.files);
        toast.success(`Pulled the latest from ${sync?.link?.repo}${res.skipped ? ` (${res.skipped} binary or large files skipped)` : ""}`);
      } else toast.info("Already up to date with GitHub");
      load();
    } catch (err) {
      if (getErrorStatus(err) === 409) setConflict({ action: "pull", message: getErrorMessage(err, "") });
      else setError(getErrorMessage(err, "Could not pull from GitHub"));
    } finally {
      setBusy(null);
    }
  };

  const connect = async () => {
    setBusy("connect");
    try {
      await connectGitHub(`/projects/${projectId}`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not connect GitHub"));
      setBusy(null);
    }
  };

  const unlink = async () => {
    setBusy("unlink");
    try {
      await unlinkGitHub(projectId);
      toast.info("This project no longer syncs with GitHub (the repository is unchanged)");
      load();
    } catch (err) {
      setError(getErrorMessage(err, "Could not unlink"));
    } finally {
      setBusy(null);
    }
  };

  const link = sync?.link;

  return (
    <ModalShell
      title="GitHub"
      subtitle={link ? "Push your changes or pull the latest commit." : "Save this project to a GitHub repository."}
      icon={<GithubIcon size={20} />}
      onClose={onClose}
    >
      {!account || !sync ? (
        error ? <p className="text-sm text-red-400">{error}</p> : <div className="flex h-24 items-center justify-center text-zinc-500"><Loader2 className="animate-spin" /></div>
      ) : !account.available ? (
        <p className="text-sm text-zinc-400">GitHub isn't set up on this server yet.</p>
      ) : !account.connected ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">
            Connect your GitHub account to push projects to your repositories (public or private) and pull changes back.
          </p>
          <button onClick={connect} disabled={busy === "connect"} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-60">
            {busy === "connect" ? <Loader2 size={16} className="animate-spin" /> : <GithubIcon size={16} />} Connect GitHub
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      ) : (
        <form onSubmit={(e) => push(false, e)} className="space-y-4">
          <p className="text-xs text-zinc-500">Connected as <span className="text-zinc-300">@{account.login}</span></p>

          {link ? (
            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <a href={`https://github.com/${link.repo}/tree/${link.branch}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-white hover:underline">
                {link.repo} <span className="text-zinc-500">· {link.branch}</span> <ExternalLink size={13} className="text-zinc-500" />
              </a>
              <p className="mt-1 text-xs text-zinc-500">Last synced {timeAgo(link.syncedAt)} · commit {link.lastCommit.slice(0, 7)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                <span className={`rounded-full px-2 py-0.5 ${sync.localChanges ? "bg-teal-500/15 text-teal-200" : "bg-white/5 text-zinc-400"}`}>
                  {sync.localChanges ? "Changes to push" : "Nothing new to push"}
                </span>
                {sync.remoteChanges && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200">New commits on GitHub</span>}
              </div>
            </div>
          ) : (
            <>
              <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 p-1 text-sm">
                {(["new", "existing"] as const).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                    className={`rounded-lg py-1.5 ${mode === m ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>
                    {m === "new" ? "New repository" : "Existing repository"}
                  </button>
                ))}
              </div>
              {mode === "new" ? (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="gh-name" className={labelClass}>Repository name</label>
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0 text-sm text-zinc-500">{account.login} /</span>
                      <input id="gh-name" value={repoName} onChange={(e) => setRepoName(e.target.value)} maxLength={100} className={input} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="accent-teal-500" />
                    <Lock size={13} className="text-zinc-500" /> Private repository
                  </label>
                </div>
              ) : (
                <div>
                  <label className="relative block">
                    <span className="sr-only">Search repositories</span>
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your repositories" className={`${input} pl-8`} />
                  </label>
                  <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto" role="listbox" aria-label="Repositories">
                    {!repos ? (
                      <li className="flex justify-center py-4 text-zinc-500"><Loader2 size={16} className="animate-spin" /></li>
                    ) : shown.length === 0 ? (
                      <li className="py-3 text-center text-xs text-zinc-500">No repositories found</li>
                    ) : shown.map((r) => (
                      <li key={r.fullName}>
                        <button type="button" role="option" aria-selected={picked === r.fullName} onClick={() => setPicked(r.fullName)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${picked === r.fullName ? "bg-teal-500/15 text-white" : "text-zinc-300 hover:bg-white/5"}`}>
                          <span className="min-w-0 flex-1 truncate">{r.fullName}</span>
                          {r.private && <Lock size={12} className="shrink-0 text-zinc-500" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[11px] text-amber-300/80">The repository's files will be replaced with this project's (its history stays).</p>
                </div>
              )}
            </>
          )}

          <div>
            <label htmlFor="gh-message" className={labelClass}>Commit message</label>
            <input id="gh-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} placeholder="Update from Aivex" className={input} />
          </div>

          {conflict && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              <p>{conflict.message}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {conflict.action === "push" && (
                  <button type="button" onClick={() => pull(false)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200">Pull first</button>
                )}
                <button type="button" onClick={() => (conflict.action === "push" ? push(true) : pull(true))}
                  className="rounded-lg border border-amber-400/40 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/10">
                  {conflict.action === "push" ? "Push anyway (replace GitHub's files)" : "Pull anyway (replace my changes)"}
                </button>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={busy !== null} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-teal-400 disabled:opacity-60">
              {busy === "push" ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpFromLine size={16} />}
              {link ? "Push" : mode === "new" ? "Create & push" : "Push"}
            </button>
            {link && (
              <button type="button" onClick={() => pull(false)} disabled={busy !== null} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-zinc-100 hover:border-white/30 disabled:opacity-60">
                {busy === "pull" ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />} Pull
              </button>
            )}
          </div>
          {link && (
            <button type="button" onClick={unlink} disabled={busy !== null} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
              <Unlink size={12} /> Stop syncing this project
            </button>
          )}
        </form>
      )}
    </ModalShell>
  );
};

export default GitHubDialog;
