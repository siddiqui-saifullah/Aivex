import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  GraduationCap,
  Link2,
  Loader2,
  Maximize2,
  Search,
  Trash2,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { classInviteLink, deleteClassroom, getClassroom, removeStudent, updateClassroom } from "../services/classroom.service";
import AiToggle from "../components/classroom/AiToggle";
import AssignmentList from "../components/classroom/AssignmentList";
import { getAssignments } from "../services/assignment.service";
import { useToast } from "../context/toast.context";
import { getErrorMessage } from "../utils/getErrorMessage";
import { plural } from "../utils/plural";
import { STACK_FORMATTER } from "../constants/options";
import { colorFor } from "../utils/userColor";
import { timeAgo } from "../utils/timeAgo";
import type { AssignmentSummary, ClassroomDetails, ClassroomStudent } from "../types";

const REFRESH_MS = 5000;

const initials = (name: string) =>
  name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

/**
 * A class. Teacher: join code, assignments and every student's project with
 * live presence. Student: the class's assignments and their class project.
 */
const Classroom = () => {
  const { classroomId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState<ClassroomDetails | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [savingAi, setSavingAi] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  // Live roster and assignments: refresh while the tab is visible
  useEffect(() => {
    let alive = true;
    const load = () =>
      Promise.all([getClassroom(classroomId), getAssignments(classroomId)])
        .then(([details, list]) => {
          if (!alive) return;
          setData(details);
          setAssignments(list);
          setNow(Date.now());
        })
        .catch((err) => alive && setError(getErrorMessage(err, "Could not load the class")));
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [classroomId, reloadKey]);

  useEffect(() => {
    if (data) document.title = `${data.name} · Aivex`;
  }, [data]);

  const students = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.students ?? [])
      .filter((s) => !q || `${s.name} ${s.username}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.online) - Number(a.online) || (a.name ?? "").localeCompare(b.name ?? ""));
  }, [data, query]);
  const onlineCount = data?.students?.filter((s) => s.online).length ?? 0;

  const copy = async (what: "code" | "link") => {
    if (!data?.code) return;
    try {
      await navigator.clipboard.writeText(what === "code" ? data.code : classInviteLink(data.code));
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };

  const handleToggleAi = async (aiEnabled: boolean) => {
    if (!data) return;
    setSavingAi(true);
    setData({ ...data, aiEnabled }); // optimistic
    try {
      await updateClassroom(data._id, { aiEnabled });
      toast.success(aiEnabled ? "Vex AI is on for students" : "Vex AI is off for students");
    } catch (err) {
      setData((d) => (d ? { ...d, aiEnabled: !aiEnabled } : d));
      toast.error(getErrorMessage(err, "Could not update the class"));
    } finally {
      setSavingAi(false);
    }
  };

  const handleRemove = async (s: ClassroomStudent) => {
    if (!data) return;
    const name = s.name || s.username || "this student";
    if (!window.confirm(`Remove ${name} from “${data.name}”? They keep their project as a personal one, and you can no longer open it.`)) return;
    try {
      await removeStudent(data._id, String(s.userId));
      setData((d) =>
        d ? { ...d, studentCount: d.studentCount - 1, students: d.students?.filter((x) => x.userId !== s.userId) } : d,
      );
      toast.success(`${name} removed from the class`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not remove the student"));
    }
  };

  const handleDelete = async () => {
    if (!data) return;
    if (!window.confirm(`Delete “${data.name}”? Students keep their projects as personal ones, and you can no longer open them.`)) return;
    try {
      await deleteClassroom(data._id);
      toast.success("Class deleted");
      navigate("/dashboard");
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not delete the class"));
    }
  };

  if (error) {
    return (
      <div className="min-h-dvh bg-black px-6 py-16 text-center">
        <p className="text-red-400">{error}</p>
        <Link to="/dashboard" className="mt-4 inline-block text-sm text-teal-300 hover:underline">Back to dashboard</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center gap-2 text-zinc-500">
        <Loader2 size={18} className="animate-spin" /> Loading class…
      </div>
    );
  }

  if (data.role === "student") {
    return (
      <div className="min-h-dvh bg-black text-zinc-100">
        <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
          <Link to="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300">
            <ArrowLeft size={15} /> Dashboard
          </Link>
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-300">
                <GraduationCap size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{data.name}</h1>
                <p className="mt-1 text-sm text-zinc-400">
                  Teacher: {data.teacher.name || data.teacher.username}
                  {data.aiEnabled === false && " · Vex AI is off in this class"}
                </p>
              </div>
            </div>
            {data.projectId && (
              <Link
                to={`/projects/${data.projectId}`}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:border-teal-500/40"
              >
                My class project <ExternalLink size={14} />
              </Link>
            )}
          </div>
          <AssignmentList
            classroomId={data._id}
            role="student"
            assignments={assignments}
            now={now}
            onChanged={() => setReloadKey((k) => k + 1)}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-black text-zinc-100">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <Link to="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={15} /> Dashboard
        </Link>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-300">
              <GraduationCap size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{data.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
                <span className="flex items-center gap-1.5"><Users size={14} /> {plural(data.studentCount, "student")}</span>
                <span className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${onlineCount ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                  {onlineCount} online now
                </span>
                <span>{STACK_FORMATTER[data.stack] ?? data.stack}</span>
              </p>
            </div>
          </div>

          {/* Join code */}
          <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-4 sm:min-w-[22rem]">
            <p className="text-xs uppercase tracking-wider text-zinc-400">Students join with</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="font-mono text-3xl font-bold tracking-[0.25em] text-teal-200">{data.code}</span>
              <div className="flex gap-1">
                <button onClick={() => copy("code")} title="Copy code" aria-label="Copy code" className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white">
                  {copied === "code" ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
                <button onClick={() => copy("link")} title="Copy invite link" aria-label="Copy invite link" className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white">
                  {copied === "link" ? <Check size={16} className="text-emerald-400" /> : <Link2 size={16} />}
                </button>
                <button onClick={() => setPresenting(true)} title="Show on projector" aria-label="Show code full screen" className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white">
                  <Maximize2 size={16} />
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              or open <span className="text-zinc-300">{classInviteLink(data.code ?? "").replace(/^https?:\/\//, "")}</span>
            </p>
          </div>
        </div>

        <div className="mb-8 max-w-xl">
          <AiToggle enabled={data.aiEnabled !== false} onChange={handleToggleAi} busy={savingAi} />
        </div>

        <AssignmentList
          classroomId={data._id}
          role="teacher"
          assignments={assignments}
          now={now}
          onChanged={() => setReloadKey((k) => k + 1)}
        />

        {/* Roster */}
        <div className="mb-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">Students</h2>
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
          <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
            <p className="font-medium text-zinc-200">No students yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Share the code <span className="font-mono text-teal-300">{data.code}</span> or the invite link. Each student
              gets their own copy of the starter code, and you can open any of them to help live.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {students.map((s) => (
              <StudentCard key={s.userId} student={s} now={now} onRemove={() => handleRemove(s)} />
            ))}
            {students.length === 0 && <p className="text-sm text-zinc-500">No students match “{query}”.</p>}
          </div>
        )}

        <div className="mt-12 border-t border-white/5 pt-6">
          <button onClick={handleDelete} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-red-400">
            <Trash2 size={14} /> Delete class
          </button>
        </div>
      </main>

      {/* Projector view */}
      {presenting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-black px-6 text-center animate-fade-in">
          <button onClick={() => setPresenting(false)} aria-label="Close" className="absolute right-6 top-6 rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white">
            <X size={24} />
          </button>
          <p className="text-xl text-zinc-400 sm:text-2xl">Join <span className="text-white">{data.name}</span> on</p>
          <p className="text-2xl font-semibold text-teal-300 sm:text-4xl">{window.location.host}/join</p>
          <p className="font-mono text-6xl font-bold tracking-[0.3em] text-white sm:text-9xl">{data.code}</p>
          <p className="text-zinc-500">{plural(data.studentCount, "student")} joined</p>
        </div>
      )}
    </div>
  );
};

const StudentCard = ({ student: s, now, onRemove }: { student: ClassroomStudent; now: number; onRemove: () => void }) => {
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
          {s.online ? <span className="text-emerald-400">Coding now</span> : `Last saved ${timeAgo(s.lastActive, now)}`}
          {s.username && <> · @{s.username}</>}
        </p>
      </div>
      <Link
        to={`/projects/${s.projectId}`}
        title={`Open ${name}'s project`}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-teal-500/40 hover:text-white"
      >
        Open <ExternalLink size={12} />
      </Link>
      <button
        onClick={onRemove}
        title={`Remove ${name} from the class`}
        aria-label={`Remove ${name} from the class`}
        className="shrink-0 rounded-lg p-1.5 text-zinc-600 hover:bg-white/5 hover:text-red-400"
      >
        <UserMinus size={14} />
      </button>
    </div>
  );
};

export default Classroom;
