import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, ClipboardList, ExternalLink, Loader2, Pencil, Search, Trash2 } from "lucide-react";
import AssignmentModal from "../components/classroom/AssignmentModal";
import { deleteAssignment, getAssignment, startAssignment, updateAssignment } from "../services/assignment.service";
import { useToast } from "../context/toast.context";
import { getErrorMessage } from "../utils/getErrorMessage";
import { AI_POLICY_LABELS, describeDue } from "../utils/dueDate";
import { colorFor } from "../utils/userColor";
import { timeAgo } from "../utils/timeAgo";
import type { AssignmentDetails, AssignmentStudent } from "../types";

const REFRESH_MS = 5000;

const initials = (name: string) =>
  name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

/** One assignment. Teacher: every student's work, edit and delete. Student: instructions and Start/Continue. */
const Assignment = () => {
  const { classroomId = "", assignmentId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState<AssignmentDetails | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getAssignment(assignmentId)
        .then((details) => {
          if (!alive) return;
          setData(details);
          setNow(Date.now());
        })
        .catch((err) => alive && setError(getErrorMessage(err, "Could not load the assignment")));
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [assignmentId, reloadKey]);

  useEffect(() => {
    if (data) document.title = `${data.title} · Aivex`;
  }, [data]);

  const students = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.students ?? [])
      .filter((s) => !q || `${s.name} ${s.username}`.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          Number(b.online) - Number(a.online) ||
          Number(Boolean(b.projectId)) - Number(Boolean(a.projectId)) ||
          (a.name ?? "").localeCompare(b.name ?? ""),
      );
  }, [data, query]);

  const handleStart = async () => {
    if (!data) return;
    if (data.projectId) {
      navigate(`/projects/${data.projectId}`);
      return;
    }
    setStarting(true);
    try {
      const { projectId } = await startAssignment(data._id);
      navigate(`/projects/${projectId}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not start the assignment"));
      setStarting(false);
    }
  };

  const handleDelete = async () => {
    if (!data) return;
    if (!window.confirm(`Delete “${data.title}”? Students keep their work as personal projects, and you can no longer open it.`)) return;
    try {
      await deleteAssignment(data._id);
      toast.success("Assignment deleted");
      navigate(`/classes/${classroomId}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not delete the assignment"));
    }
  };

  if (error) {
    return (
      <div className="min-h-dvh bg-black px-6 py-16 text-center">
        <p className="text-red-400">{error}</p>
        <Link to={`/classes/${classroomId}`} className="mt-4 inline-block text-sm text-teal-300 hover:underline">Back to the class</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center gap-2 text-zinc-500">
        <Loader2 size={18} className="animate-spin" /> Loading assignment…
      </div>
    );
  }

  const due = describeDue(data.dueAt, now);
  const rule = AI_POLICY_LABELS[data.aiPolicy];
  const startedCount = data.students?.filter((s) => s.projectId).length ?? 0;

  return (
    <div className="min-h-dvh bg-black text-zinc-100">
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        <Link to={`/classes/${classroomId}`} className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={15} /> {data.classroomName}
        </Link>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-300">
              <ClipboardList size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-bold text-white">{data.title}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
                {due ? (
                  <span className={`flex items-center gap-1.5 ${due.overdue ? "text-red-400" : due.soon ? "text-amber-300" : ""}`}>
                    <CalendarClock size={14} /> {due.label} · {due.when}
                  </span>
                ) : (
                  <span>No due date</span>
                )}
                <span title={rule.hint}>{rule.label}</span>
                {data.role === "teacher" && <span>{startedCount}/{data.students?.length ?? 0} started</span>}
              </p>
            </div>
          </div>

          {data.role === "teacher" ? (
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-200 hover:border-teal-500/40"
              >
                <Pencil size={14} /> Edit
              </button>
              <button
                onClick={handleDelete}
                aria-label="Delete assignment"
                title="Delete assignment"
                className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:border-red-500/40 hover:text-red-400"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleStart}
              disabled={starting}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-black hover:bg-teal-400 disabled:opacity-60"
            >
              {starting && <Loader2 size={14} className="animate-spin" />}
              {data.projectId ? "Continue in the editor" : "Start assignment"}
            </button>
          )}
        </div>

        <section className="mb-8 rounded-2xl border border-white/5 bg-zinc-900/40 p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Instructions</h2>
          {data.instructions ? (
            <p className="whitespace-pre-wrap break-words leading-relaxed text-zinc-200">{data.instructions}</p>
          ) : (
            <p className="text-sm text-zinc-500">No instructions.</p>
          )}
          <p className="mt-4 text-xs text-zinc-500">{rule.hint}</p>
        </section>

        {data.role === "teacher" && (
          <section>
            <div className="mb-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">Students' work</h2>
              {(data.students?.length ?? 0) > 0 && (
                <label className="relative block">
                  <span className="sr-only">Search students</span>
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search students"
                    className="w-full sm:w-64 rounded-lg border border-white/10 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-teal-500/50 focus:outline-none"
                  />
                </label>
              )}
            </div>
            {(data.students?.length ?? 0) === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center text-sm text-zinc-500">
                No students in the class yet.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {students.map((s) => (
                  <WorkCard key={s.userId} student={s} now={now} />
                ))}
                {students.length === 0 && <p className="text-sm text-zinc-500">No students match “{query}”.</p>}
              </div>
            )}
          </section>
        )}
      </main>

      {editing && (
        <AssignmentModal
          initial={data}
          onClose={() => setEditing(false)}
          onSave={async (input) => {
            await updateAssignment(data._id, input);
            toast.success("Assignment updated");
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
};

const WorkCard = ({ student: s, now }: { student: AssignmentStudent; now: number }) => {
  const name = s.name || s.username || "Student";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-zinc-900/50 p-4">
      <div className="relative shrink-0">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-black"
          style={{ backgroundColor: colorFor(String(s.userId)) }}
        >
          {initials(name)}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-zinc-950 ${s.online ? "bg-emerald-400" : "bg-zinc-600"}`}
          title={s.online ? "Online" : "Offline"}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-100">{name}</p>
        <p className="truncate text-xs text-zinc-500">
          {!s.projectId ? (
            "Not started"
          ) : s.online ? (
            <span className="text-emerald-400">Working on it now</span>
          ) : (
            `Last saved ${timeAgo(s.lastActive ?? "", now)}`
          )}
          {s.username && <> · @{s.username}</>}
        </p>
      </div>
      {s.projectId && (
        <Link
          to={`/projects/${s.projectId}`}
          title={`Open ${name}'s work`}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-teal-500/40 hover:text-white"
        >
          Open <ExternalLink size={12} />
        </Link>
      )}
    </div>
  );
};

export default Assignment;
