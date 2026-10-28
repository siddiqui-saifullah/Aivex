import { useEffect, useState } from "react";
import { Bug, ChevronLeft, ChevronRight, Flag, Loader2, MessageSquare, User, FolderGit2 } from "lucide-react";
import {
  getAdminIssues,
  getAdminReports,
  resolveAdminReport,
  updateAdminIssue,
  type AdminAbuseReport,
  type AdminIssue,
  type ListPage,
  type ReportAction,
} from "../../services/admin.service";
import { useToast } from "../../context/toast.context";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { timeAgo } from "../../utils/timeAgo";

type Section = "abuse" | "issues";

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  hate: "Hate speech",
  sexual: "Sexual content",
  violence: "Violence / self-harm",
  impersonation: "Impersonation",
  other: "Other",
};

const ACTION_LABELS: Record<string, string> = {
  dismissed: "Dismissed",
  "no-action": "Reviewed, no action",
  "content-removed": "Message removed",
  "user-suspended": "User suspended",
};

const SEVERITY_TONE: Record<string, string> = {
  low: "bg-zinc-500/15 text-zinc-300",
  medium: "bg-sky-500/15 text-sky-300",
  high: "bg-amber-500/15 text-amber-300",
  critical: "bg-red-500/15 text-red-300",
};

const Pager = ({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-sm text-zinc-400">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page" className="rounded-md p-1.5 hover:bg-white/5 disabled:opacity-30">
        <ChevronLeft size={16} />
      </button>
      Page {page} of {pages}
      <button disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page" className="rounded-md p-1.5 hover:bg-white/5 disabled:opacity-30">
        <ChevronRight size={16} />
      </button>
    </div>
  );
};

const TargetIcon = ({ type }: { type: AdminAbuseReport["targetType"] }) => {
  const Icon = type === "message" ? MessageSquare : type === "project" ? FolderGit2 : User;
  return <Icon size={14} className="text-zinc-400" />;
};

/* -------------------------------------------------------------------------- */
/* ABUSE REPORTS                                                              */
/* -------------------------------------------------------------------------- */
const AbuseReportCard = ({ report, onDone }: { report: AdminAbuseReport; onDone: () => void }) => {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<ReportAction | null>(null);
  const who = report.targetUser;

  const act = async (action: ReportAction) => {
    if (action === "user-suspended" && !window.confirm(`Suspend @${who?.username}? They are signed out everywhere and can't sign in until you lift it (Users table).`)) return;
    setBusy(action);
    try {
      const { closed } = await resolveAdminReport(report._id, action, note.trim() || undefined);
      toast.success(`${ACTION_LABELS[action]}${closed > 1 ? ` · ${closed} reports closed` : ""}`);
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not update the report"));
      setBusy(null);
    }
  };

  const what =
    report.targetType === "message"
      ? `Message from @${report.snapshot.username ?? who?.username ?? "?"}`
      : report.targetType === "project"
        ? `Project “${report.snapshot.name ?? "?"}” (owner @${who?.username ?? "?"})`
        : `User @${report.snapshot.username ?? who?.username ?? "?"}`;

  return (
    <li className="rounded-2xl border border-white/10 bg-zinc-950 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <TargetIcon type={report.targetType} />
        <span className="font-medium text-zinc-100">{what}</span>
        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">{REASON_LABELS[report.reason] ?? report.reason}</span>
        {report.reportsAgainstUser > 1 && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
            {report.reportsAgainstUser} reports against this person
          </span>
        )}
        {who?.suspendedAt && <span className="rounded-full bg-zinc-700/50 px-2 py-0.5 text-xs text-zinc-300">suspended</span>}
        <span className="ml-auto text-xs text-zinc-500">
          by @{report.reporter?.username ?? "deleted"} · {timeAgo(report.createdAt)}
        </span>
      </div>
      {report.snapshot.text && (
        <blockquote className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border-l-2 border-red-500/40 bg-black/40 px-3 py-2 text-sm text-zinc-300">
          {report.snapshot.text}
        </blockquote>
      )}
      {report.details && <p className="mt-2 text-sm text-zinc-400">“{report.details}”</p>}

      {report.status === "open" ? (
        <div className="mt-3 space-y-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional, kept with the report)"
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            {report.targetType === "message" && (
              <button onClick={() => act("content-removed")} disabled={!!busy} className="rounded-lg bg-red-500/15 px-3 py-1.5 text-sm text-red-200 hover:bg-red-500/25 disabled:opacity-50">
                {busy === "content-removed" ? "Removing…" : "Remove message"}
              </button>
            )}
            {who && !who.suspendedAt && (
              <button onClick={() => act("user-suspended")} disabled={!!busy} className="rounded-lg bg-red-500/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50">
                {busy === "user-suspended" ? "Suspending…" : `Suspend @${who.username}`}
              </button>
            )}
            <button onClick={() => act("no-action")} disabled={!!busy} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50">
              Reviewed, no action
            </button>
            <button onClick={() => act("dismissed")} disabled={!!busy} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-white/5 hover:text-zinc-300 disabled:opacity-50">
              Dismiss
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">
          {ACTION_LABELS[report.action ?? ""] ?? "Closed"}
          {report.resolvedAt && ` · ${timeAgo(report.resolvedAt)}`}
          {report.adminNote && ` · “${report.adminNote}”`}
        </p>
      )}
    </li>
  );
};

/* -------------------------------------------------------------------------- */
/* BUG REPORTS                                                                */
/* -------------------------------------------------------------------------- */
const IssueCard = ({ issue, onDone }: { issue: AdminIssue; onDone: () => void }) => {
  const toast = useToast();
  const [reply, setReply] = useState(issue.adminReply ?? "");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const save = async (status?: AdminIssue["status"]) => {
    setBusy(true);
    try {
      await updateAdminIssue(issue._id, { status, reply: reply.trim() || undefined });
      toast.success(status ? `Marked ${status}; the reporter was told` : "Reply sent");
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not update the issue"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-2xl border border-white/10 bg-zinc-950 p-4">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-center gap-2 text-left text-sm">
        <span className={`rounded-full px-2 py-0.5 text-xs ${SEVERITY_TONE[issue.severity] ?? ""}`}>{issue.severity}</span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-300">{issue.type}</span>
        <span className="font-medium text-zinc-100">{issue.title}</span>
        <span className="ml-auto text-xs text-zinc-500">
          {issue.status} · @{issue.reportedBy?.username ?? "deleted"} · {timeAgo(issue.createdAt)}
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="whitespace-pre-wrap text-sm text-zinc-300">{issue.description}</p>
          <p className="text-xs text-zinc-500">
            {issue.project ? `In project “${issue.project.name}”` : "Not in a project"}
            {issue.reportedBy?.email && ` · ${issue.reportedBy.email}`}
            {issue.context?.userAgent && ` · ${issue.context.userAgent}`}
          </p>
          {(issue.context?.stack || issue.context?.runtimeLogs) && (
            <pre className="max-h-48 overflow-auto rounded-xl bg-black/50 p-3 text-xs text-zinc-400">
              {[issue.context?.stack, issue.context?.runtimeLogs].filter(Boolean).join("\n\n")}
            </pre>
          )}
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            placeholder="Reply to the reporter (they get a notification)"
            className="w-full resize-none rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            {issue.status !== "acknowledged" && (
              <button onClick={() => save("acknowledged")} disabled={busy} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50">
                Acknowledge
              </button>
            )}
            {issue.status !== "resolved" && (
              <button onClick={() => save("resolved")} disabled={busy} className="rounded-lg bg-teal-500/90 px-3 py-1.5 text-sm font-medium text-black hover:bg-teal-400 disabled:opacity-50">
                Mark resolved
              </button>
            )}
            {issue.status !== "closed" && (
              <button onClick={() => save("closed")} disabled={busy} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-white/5 hover:text-zinc-300 disabled:opacity-50">
                Close
              </button>
            )}
            <button onClick={() => save()} disabled={busy || !reply.trim()} className="rounded-lg px-3 py-1.5 text-sm text-teal-300 hover:bg-white/5 disabled:opacity-40">
              Send reply only
            </button>
          </div>
        </div>
      )}
    </li>
  );
};

/** Admin: abuse reports to moderate and bug reports to answer. */
const ModerationPanel = ({ onChanged }: { onChanged?: () => void }) => {
  const [section, setSection] = useState<Section>("abuse");
  const [status, setStatus] = useState("open");
  const [page, setPage] = useState(1);
  const [reports, setReports] = useState<ListPage<AdminAbuseReport> | null>(null);
  const [issues, setIssues] = useState<ListPage<AdminIssue> | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    const request =
      section === "abuse"
        ? getAdminReports({ status, page }).then((r) => alive && setReports(r))
        : getAdminIssues({ status: status === "all" ? undefined : status, page }).then((r) => alive && setIssues(r));
    request.catch(() => undefined).finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [section, status, page, reloadKey]);

  const done = () => {
    setReloadKey((k) => k + 1);
    onChanged?.();
  };

  const switchSection = (next: Section) => {
    if (next === section) return;
    setSection(next);
    setStatus("open");
    setPage(1);
    setLoading(true);
  };

  const statuses = section === "abuse" ? ["open", "closed", "all"] : ["open", "acknowledged", "resolved", "closed", "all"];
  const data = section === "abuse" ? reports : issues;

  return (
    <section className="mt-8" aria-labelledby="moderation-heading">
      <h2 id="moderation-heading" className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-300">
        Reports
      </h2>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg border border-white/10 p-1" role="tablist">
          <button
            role="tab"
            aria-selected={section === "abuse"}
            onClick={() => switchSection("abuse")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${section === "abuse" ? "bg-red-500/15 text-red-200" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            <Flag size={14} /> Abuse {reports ? `(${reports.open} open)` : ""}
          </button>
          <button
            role="tab"
            aria-selected={section === "issues"}
            onClick={() => switchSection("issues")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${section === "issues" ? "bg-teal-500/15 text-teal-200" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            <Bug size={14} /> Bugs & feedback {issues ? `(${issues.open} open)` : ""}
          </button>
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
            setLoading(true);
          }}
          aria-label="Status"
          className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm capitalize text-zinc-200 focus:outline-none"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 py-10 text-sm text-zinc-500">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : data.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">
          {status === "open" ? "Nothing waiting. Nice." : "Nothing here"}
        </p>
      ) : (
        <ul className="space-y-3">
          {section === "abuse"
            ? (data.items as AdminAbuseReport[]).map((r) => <AbuseReportCard key={r._id} report={r} onDone={done} />)
            : (data.items as AdminIssue[]).map((i) => <IssueCard key={i._id} issue={i} onDone={done} />)}
        </ul>
      )}
      {data && <Pager page={page} total={data.total} pageSize={data.pageSize} onPage={(p) => { setPage(p); setLoading(true); }} />}
    </section>
  );
};

export default ModerationPanel;
