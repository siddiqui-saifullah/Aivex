import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FolderGit2,
  GraduationCap,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import ColumnChart from "../components/admin/ColumnChart";
import ModerationPanel from "../components/admin/ModerationPanel";
import { useToast } from "../context/toast.context";
import { getErrorMessage } from "../utils/getErrorMessage";
import {
  checkIsAdmin,
  getAdminOverview,
  getAdminProjects,
  getAdminUsers,
  setUserSuspension,
  type AdminOverview,
  type AdminProject,
  type AdminUser,
  type Page,
} from "../services/admin.service";
import { timeAgo } from "../utils/timeAgo";
import { STACK_FORMATTER } from "../constants/options";
import NotFound from "./NotFound";

const REFRESH_MS = 60_000;

const exact = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "");

/** Relative time with the exact time on hover; "—" when never recorded. */
const When = ({ iso, never = "—" }: { iso: string | null; never?: string }) =>
  iso ? (
    <time dateTime={iso} title={exact(iso)} className="whitespace-nowrap">
      {timeAgo(iso)}
    </time>
  ) : (
    <span className="text-zinc-600">{never}</span>
  );

const Stat = ({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: number; hint?: string }) => (
  <div className="rounded-2xl border border-white/10 bg-zinc-950 p-4">
    <p className="flex items-center gap-1.5 text-xs text-zinc-400">
      <Icon size={13} className="text-teal-400" /> {label}
    </p>
    <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value.toLocaleString()}</p>
    {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
  </div>
);

type Tab = "users" | "projects";

const USER_SORTS = [
  { id: "active", label: "Last active" },
  { id: "login", label: "Last login" },
  { id: "joined", label: "Newest" },
  { id: "name", label: "Username" },
];
const PROJECT_SORTS = [
  { id: "opened", label: "Last opened" },
  { id: "edited", label: "Last edited" },
  { id: "created", label: "Newest" },
  { id: "name", label: "Name" },
];

/** Site owner's view of how Aivex is used. Only admins (ADMIN_EMAILS on the server) can open it. */
const Admin = () => {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("users");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("active");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Page<AdminUser> | Page<AdminProject> | null>(null);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    checkIsAdmin().then((ok) => alive && setAllowed(ok));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    const load = () =>
      getAdminOverview()
        .then((o) => alive && setOverview(o))
        .catch(() => undefined)
        .finally(() => alive && setRefreshing(false));
    load();
    const id = setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [allowed, reloadKey]);

  // Debounced search
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    const params = { q: search || undefined, sort, page };
    const request = tab === "users" ? getAdminUsers(params) : getAdminProjects(params);
    request
      .then((r) => alive && setRows(r))
      .catch(() => undefined)
      .finally(() => alive && setRowsLoading(false));
    return () => {
      alive = false;
    };
  }, [allowed, tab, search, sort, page, reloadKey]);

  const switchTab = (next: Tab) => {
    if (next === tab) return;
    setTab(next);
    setSort(next === "users" ? "active" : "opened");
    setPage(1);
    setRows(null);
    setRowsLoading(true);
  };

  if (allowed === false) return <NotFound />;
  if (allowed === null || !overview) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center gap-2 text-zinc-500">
        <Loader2 size={18} className="animate-spin" /> Loading usage…
      </div>
    );
  }

  const { totals, active, series } = overview;
  const maxStack = Math.max(1, ...overview.stacks.map((s) => s.count));
  const pages = rows ? Math.max(1, Math.ceil(rows.total / rows.pageSize)) : 1;

  return (
    <div className="min-h-dvh bg-black text-zinc-100">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Link to="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={15} /> Dashboard
        </Link>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
              <ShieldCheck size={22} className="text-teal-400" /> Aivex usage
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {overview.lastActivity ? (
                <>
                  Last activity: <span className="text-zinc-200">@{overview.lastActivity.username}</span>{" "}
                  <When iso={overview.lastActivity.at} />
                </>
              ) : (
                "No activity recorded yet"
              )}
              <span className="text-zinc-600"> · only visible to admins</span>
            </p>
          </div>
          <button
            onClick={() => {
              setRefreshing(true);
              setReloadKey((k) => k + 1);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {/* Headline numbers */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat icon={Activity} label="Active today" value={active.today} hint={`${active.last7d} in 7 days`} />
          <Stat icon={Activity} label="Active in 30 days" value={active.last30d} hint={`of ${totals.users} users`} />
          <Stat icon={Users} label="Total users" value={totals.users} />
          <Stat icon={FolderGit2} label="Total projects" value={totals.projects} />
          <Stat icon={GraduationCap} label="Classes" value={totals.classrooms} />
          <Stat icon={MessageSquare} label="AI replies" value={totals.aiReplies} hint={`${totals.messages.toLocaleString()} chat messages`} />
        </div>

        <ModerationPanel onChanged={() => setReloadKey((k) => k + 1)} />

        {/* Last 30 days */}
        <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-zinc-300">Last 30 days</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <ColumnChart title="Daily active users" data={series.activeUsers} total={`${active.last30d} people`} />
          <ColumnChart title="New sign-ups" data={series.signups} />
          <ColumnChart title="Projects created" data={series.projectsCreated} />
          <ColumnChart title="Vex AI replies" data={series.aiReplies} />
        </div>

        {/* Stacks */}
        {overview.stacks.length > 0 && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-zinc-950 p-4">
            <p className="mb-3 text-sm font-medium text-zinc-200">Projects by stack</p>
            <ul className="space-y-2">
              {overview.stacks.map((s) => (
                <li key={s.stack} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-sm">
                  <span className="truncate text-zinc-400">{STACK_FORMATTER[s.stack] ?? s.stack}</span>
                  <span className="h-2.5 rounded-r-[4px] bg-teal-500/80" style={{ width: `${(s.count / maxStack) * 100}%` }} />
                  <span className="text-right tabular-nums text-zinc-300">{s.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* People & projects */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-lg border border-white/10 p-1" role="tablist">
            {(["users", "projects"] as Tab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => switchTab(t)}
                className={`rounded-md px-3 py-1.5 text-sm capitalize ${
                  tab === t ? "bg-teal-500/15 text-teal-200" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t} ({t === "users" ? totals.users : totals.projects})
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <label className="relative block flex-1 sm:w-64">
              <span className="sr-only">Search</span>
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tab === "users" ? "Name, username or email" : "Project name"}
                className="w-full rounded-lg border border-white/10 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-teal-500/50 focus:outline-none"
              />
            </label>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              aria-label="Sort by"
              className="rounded-lg border border-white/10 bg-zinc-900 px-2 text-sm text-zinc-200 focus:outline-none"
            >
              {(tab === "users" ? USER_SORTS : PROJECT_SORTS).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
          {!rows || rowsLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          ) : rows.items.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">Nothing found</p>
          ) : tab === "users" ? (
            <UsersTable users={rows.items as AdminUser[]} onChanged={() => setReloadKey((k) => k + 1)} />
          ) : (
            <ProjectsTable projects={rows.items as AdminProject[]} />
          )}
        </div>

        {rows && pages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm text-zinc-400">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
              className="rounded-md p-1.5 hover:bg-white/5 disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            Page {page} of {pages}
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
              className="rounded-md p-1.5 hover:bg-white/5 disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

const th = "px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 whitespace-nowrap";
const td = "px-4 py-3 align-top text-zinc-300";

/** Suspend (after abuse) or let back in. */
const SuspendButton = ({ user, onChanged }: { user: AdminUser; onChanged: () => void }) => {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    const suspend = !user.suspendedAt;
    const reason = suspend ? window.prompt(`Suspend @${user.username}? They are signed out everywhere. Reason (kept for admins):`) : "";
    if (suspend && reason === null) return;
    if (!suspend && !window.confirm(`Let @${user.username} sign in again?`)) return;
    setBusy(true);
    try {
      await setUserSuspension(user._id, suspend, reason || undefined);
      toast.success(suspend ? `@${user.username} suspended` : `@${user.username} can sign in again`);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not update the account"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={user.suspendedAt ? user.suspendedReason || "Suspended" : "Suspend this account"}
      className={`rounded-md px-2 py-1 text-xs disabled:opacity-50 ${
        user.suspendedAt ? "bg-red-500/15 text-red-300 hover:bg-red-500/25" : "text-zinc-500 hover:bg-white/5 hover:text-red-300"
      }`}
    >
      {user.suspendedAt ? "Suspended · lift" : "Suspend"}
    </button>
  );
};

const UsersTable = ({ users, onChanged }: { users: AdminUser[]; onChanged: () => void }) => (
  <table className="w-full min-w-[60rem] text-sm">
    <thead className="border-b border-white/10 bg-zinc-950">
      <tr>
        <th className={th}>User</th>
        <th className={th}>Last active</th>
        <th className={th}>Last login</th>
        <th className={`${th} text-right`}>Logins</th>
        <th className={`${th} text-right`}>Projects</th>
        <th className={th}>Last opened project</th>
        <th className={th}>Joined</th>
        <th className={th}>Account</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-white/5">
      {users.map((u) => (
        <tr key={u._id} className="hover:bg-white/2">
          <td className={td}>
            <p className="font-medium text-zinc-100">{u.name}</p>
            <p className="text-xs text-zinc-500">
              @{u.username} · {u.email}
            </p>
          </td>
          <td className={td}>
            <When iso={u.lastActiveAt} never="Not since tracking began" />
          </td>
          <td className={td}>
            <When iso={u.lastLoginAt} />
          </td>
          <td className={`${td} text-right tabular-nums`}>{u.loginCount}</td>
          <td className={`${td} text-right tabular-nums`} title={`${u.projectsOwned} owned · ${u.projectsShared} shared with them`}>
            {u.projectsOwned + u.projectsShared}
            <span className="block text-xs text-zinc-500">
              {u.projectsOwned} own · {u.projectsShared} shared
            </span>
          </td>
          <td className={td}>
            {u.lastProject ? (
              <>
                <p className="max-w-56 truncate text-zinc-200">{u.lastProject.name}</p>
                <p className="text-xs text-zinc-500">
                  <When iso={u.lastProject.at} />
                </p>
              </>
            ) : (
              <span className="text-zinc-600">—</span>
            )}
          </td>
          <td className={td}>
            <When iso={u.createdAt} />
          </td>
          <td className={td}>
            <SuspendButton user={u} onChanged={onChanged} />
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

const ProjectsTable = ({ projects }: { projects: AdminProject[] }) => (
  <table className="w-full min-w-[60rem] text-sm">
    <thead className="border-b border-white/10 bg-zinc-950">
      <tr>
        <th className={th}>Project</th>
        <th className={th}>Owner</th>
        <th className={`${th} text-right`}>Members</th>
        <th className={`${th} text-right`}>Messages</th>
        <th className={`${th} text-right`}>Opens</th>
        <th className={th}>Last opened</th>
        <th className={th}>Last edited</th>
        <th className={th}>Created</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-white/5">
      {projects.map((p) => (
        <tr key={p._id} className="hover:bg-white/2">
          <td className={td}>
            <p className="max-w-64 truncate font-medium text-zinc-100">{p.name}</p>
            <p className="text-xs text-zinc-500">
              {STACK_FORMATTER[p.stack] ?? p.stack}
              {p.isClassProject && " · class"}
            </p>
          </td>
          <td className={td}>{p.owner ? `@${p.owner}` : "—"}</td>
          <td className={`${td} text-right tabular-nums`}>
            {p.members}
            {p.pendingInvites > 0 && <span className="block text-xs text-amber-300/80">+{p.pendingInvites} invited</span>}
          </td>
          <td className={`${td} text-right tabular-nums`}>{p.messages}</td>
          <td className={`${td} text-right tabular-nums`}>{p.openCount}</td>
          <td className={td}>
            <When iso={p.lastOpenedAt} />
            {p.lastOpenedBy && <span className="block text-xs text-zinc-500">by @{p.lastOpenedBy}</span>}
          </td>
          <td className={td}>
            <When iso={p.lastEditedAt} />
          </td>
          <td className={td}>
            <When iso={p.createdAt} />
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

export default Admin;
