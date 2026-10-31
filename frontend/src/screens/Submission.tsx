import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileCode2, Loader2, Lock } from "lucide-react";
import SubmissionBadge from "../components/classroom/SubmissionBadge";
import { getSubmission, reviewSubmission } from "../services/assignment.service";
import { useToast } from "../context/toast.context";
import { getErrorMessage } from "../utils/getErrorMessage";
import type { SubmissionDetails } from "../types";

const HIDDEN_FILES = /(^|\/)\.aivex$/;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** One hand-in: its frozen files, its versions, and the teacher's review. */
const Submission = () => {
  const { classroomId = "", assignmentId = "", submissionId = "" } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<SubmissionDetails | null>(null);
  const [error, setError] = useState("");
  const [activeFile, setActiveFile] = useState("");

  useEffect(() => {
    let alive = true;
    getSubmission(submissionId)
      .then((s) => {
        if (!alive) return;
        setData(s);
        const files = Object.keys(s.files).filter((f) => !HIDDEN_FILES.test(f)).sort();
        setActiveFile((current) => (current && files.includes(current) ? current : files[0] ?? ""));
      })
      .catch((err) => alive && setError(getErrorMessage(err, "Could not load the submission")));
    return () => {
      alive = false;
    };
  }, [submissionId]);

  useEffect(() => {
    if (data) document.title = `${data.assignmentTitle} · v${data.version} · Aivex`;
  }, [data]);

  const files = useMemo(
    () => Object.keys(data?.files ?? {}).filter((f) => !HIDDEN_FILES.test(f)).sort(),
    [data],
  );
  const back = `/classes/${classroomId}/assignments/${assignmentId}`;

  if (error) {
    return (
      <div className="min-h-dvh bg-black px-6 py-16 text-center">
        <p className="text-red-400">{error}</p>
        <Link to={back} className="mt-4 inline-block text-sm text-teal-300 hover:underline">Back to the assignment</Link>
      </div>
    );
  }
  // Also while switching to another version
  if (!data || data._id !== submissionId) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center gap-2 text-zinc-500">
        <Loader2 size={18} className="animate-spin" /> Loading submission…
      </div>
    );
  }

  const studentName = data.studentInfo.name || data.studentInfo.username || "Student";
  const code = data.files[activeFile] ?? "";
  const lines = code.split("\n");

  return (
    <div className="min-h-dvh bg-black text-zinc-100">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Link to={back} className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={15} /> {data.assignmentTitle}
        </Link>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-white">
              {data.role === "teacher" ? studentName : "Your submission"}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
              <SubmissionBadge status={data.status} marks={data.marks} maxMarks={data.maxMarks} />
              <span>Version {data.version} · submitted {formatTime(data.createdAt)}</span>
              {data.role === "teacher" && data.studentInfo.username && <span>@{data.studentInfo.username}</span>}
            </p>
          </div>
          {data.versions.length > 1 && (
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              Version
              <select
                value={data._id}
                onChange={(e) => navigate(`${back}/submissions/${e.target.value}`)}
                className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 focus:border-teal-500/50 focus:outline-none"
              >
                {data.versions.map((v) => (
                  <option key={v._id} value={v._id}>
                    v{v.version} · {formatTime(v.createdAt)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Frozen files */}
          <section className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-xs text-zinc-500">
              <Lock size={12} /> Files as handed in. Later changes to the project don't affect this copy.
            </div>
            {files.length === 0 ? (
              <p className="p-6 text-sm text-zinc-500">This submission has no files.</p>
            ) : (
              <div className="flex min-h-[420px] flex-col md:flex-row">
                <ul className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 p-2 md:w-52 md:flex-col md:overflow-visible md:border-b-0 md:border-r">
                  {files.map((f) => (
                    <li key={f}>
                      <button
                        onClick={() => setActiveFile(f)}
                        className={`flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2 py-1.5 text-left text-xs ${
                          f === activeFile ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                        }`}
                        title={f}
                      >
                        <FileCode2 size={13} className="shrink-0" />
                        <span className="truncate">{f}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="min-w-0 flex-1 overflow-auto">
                  <pre className="py-3 text-[13px] leading-6">
                    <code>
                      {lines.map((line, i) => (
                        <div key={i} className="flex">
                          <span className="w-12 shrink-0 select-none pr-4 text-right text-zinc-600">{i + 1}</span>
                          <span className="whitespace-pre pr-4 text-zinc-200">{line || " "}</span>
                        </div>
                      ))}
                    </code>
                  </pre>
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            {data.note && (
              <div className="rounded-xl border border-white/10 bg-zinc-950 p-4">
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Note from {data.role === "teacher" ? studentName : "you"}</h2>
                <p className="whitespace-pre-wrap break-words text-sm text-zinc-200">{data.note}</p>
              </div>
            )}
            {data.role === "teacher" ? (
              <ReviewForm data={data} onSaved={(s) => setData({ ...data, ...s })} />
            ) : (
              <div className="rounded-xl border border-white/10 bg-zinc-950 p-4">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Teacher's feedback</h2>
                {data.status === "submitted" ? (
                  <p className="text-sm text-zinc-500">Not reviewed yet. You'll get a notification when it is.</p>
                ) : (
                  <>
                    {data.marks != null && data.maxMarks && (
                      <p className="mb-2 text-2xl font-semibold tabular-nums text-white">
                        {data.marks}<span className="text-base text-zinc-500">/{data.maxMarks}</span>
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm text-zinc-200">{data.feedback || "No written feedback."}</p>
                    {data.status === "revision-requested" && (
                      <p className="mt-3 text-xs text-amber-300">Make the changes in your project, then submit again from the assignment card.</p>
                    )}
                  </>
                )}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
};

const ReviewForm = ({ data, onSaved }: { data: SubmissionDetails; onSaved: (s: Partial<SubmissionDetails>) => void }) => {
  const toast = useToast();
  const [feedback, setFeedback] = useState(data.feedback ?? "");
  const [marks, setMarks] = useState(data.marks != null ? String(data.marks) : "");
  const [saving, setSaving] = useState<"reviewed" | "revision-requested" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setFeedback(data.feedback ?? "");
    setMarks(data.marks != null ? String(data.marks) : "");
    setError("");
  }, [data._id, data.feedback, data.marks]);

  const save = async (status: "reviewed" | "revision-requested", e?: FormEvent) => {
    e?.preventDefault();
    if (status === "revision-requested" && !feedback.trim()) {
      setError("Tell the student what to change");
      return;
    }
    const value = marks.trim() === "" ? null : Number(marks);
    if (value !== null && (Number.isNaN(value) || value < 0 || (data.maxMarks != null && value > data.maxMarks))) {
      setError(`Marks must be between 0 and ${data.maxMarks}`);
      return;
    }
    setSaving(status);
    setError("");
    try {
      const saved = await reviewSubmission(data._id, { status, feedback: feedback.trim(), marks: data.maxMarks ? value : undefined });
      onSaved(saved);
      toast.success(status === "reviewed" ? "Review sent to the student" : "Asked the student for changes");
    } catch (err) {
      setError(getErrorMessage(err, "Could not save the review"));
    } finally {
      setSaving(null);
    }
  };

  return (
    <form onSubmit={(e) => save("reviewed", e)} className="rounded-xl border border-white/10 bg-zinc-950 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Review</h2>
      {data.maxMarks != null && (
        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-zinc-400">Marks (out of {data.maxMarks})</span>
          <input
            type="number"
            min={0}
            max={data.maxMarks}
            step="0.5"
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            aria-label="Marks"
            className="w-28 rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white focus:border-teal-500/60 focus:outline-none"
          />
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-xs text-zinc-400">Feedback</span>
        <textarea
          value={feedback}
          onChange={(e) => {
            setFeedback(e.target.value);
            setError("");
          }}
          rows={6}
          maxLength={5000}
          aria-label="Feedback"
          placeholder="What works, what to improve, which lines to look at…"
          className="w-full resize-y rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-teal-500/60 focus:outline-none"
        />
      </label>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="submit"
          disabled={saving !== null}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
        >
          {saving === "reviewed" && <Loader2 size={14} className="animate-spin" />}
          Mark as reviewed
        </button>
        <button
          type="button"
          onClick={() => save("revision-requested")}
          disabled={saving !== null}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 px-3 py-2 text-sm text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
        >
          {saving === "revision-requested" && <Loader2 size={14} className="animate-spin" />}
          Request changes
        </button>
      </div>
      {data.reviewedAt && (
        <p className="mt-3 text-[11px] text-zinc-500">Last reviewed {formatTime(data.reviewedAt)}</p>
      )}
    </form>
  );
};

export default Submission;
