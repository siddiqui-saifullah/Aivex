import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileCode2,
  LifeBuoy,
  Loader2,
  Lock,
  Play,
  Save,
  Send,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { getJourney, getJourneySnapshot } from "../services/assignment.service";
import { getErrorMessage } from "../utils/getErrorMessage";
import { plural } from "../utils/plural";
import type { FlatFileTree, Journey as JourneyData, JourneySnapshot, JourneyStep } from "../types";

const HIDDEN = /(^|\/)\.aivex$/;

const STEP: Record<JourneyStep["type"], { icon: LucideIcon; color: string; dot: string }> = {
  save: { icon: Save, color: "text-teal-300", dot: "bg-teal-400" },
  "ai-edit": { icon: Sparkles, color: "text-violet-300", dot: "bg-violet-400" },
  run: { icon: Play, color: "text-sky-300", dot: "bg-sky-400" },
  ai: { icon: Bot, color: "text-violet-300", dot: "bg-violet-400" },
  submit: { icon: Send, color: "text-emerald-300", dot: "bg-emerald-400" },
  help: { icon: LifeBuoy, color: "text-amber-300", dot: "bg-amber-400" },
};

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

const describe = (s: JourneyStep, studentName: string) => {
  const who = s.byTeacher ? "Teacher" : studentName;
  switch (s.type) {
    case "save":
      return { title: `${who} saved ${s.files.join(", ")}`, detail: `+${s.added} −${s.removed} lines` };
    case "ai-edit":
      return { title: `Vex changed ${s.files.join(", ")}`, detail: `+${s.added} −${s.removed} lines` };
    case "run":
      return s.ok
        ? { title: `${who} ran the program`, detail: "Finished without errors" }
        : { title: `${who} ran the program: error`, detail: s.message || "Failed" };
    case "ai":
      return { title: `${who} asked Vex`, detail: `“${s.message}”` };
    case "submit":
      return { title: `${who} submitted`, detail: s.message };
    case "help":
      return { title: `${who} asked the teacher for help`, detail: s.message ? `“${s.message}”` : "" };
  }
};

/** Which lines of `after` are new compared with `before` (longest common subsequence). */
const newLines = (before: string | undefined, after: string) => {
  const b = (before ?? "").split("\n");
  const a = after.split("\n");
  const fresh = new Set<number>();
  if (before === undefined) {
    a.forEach((_, i) => fresh.add(i));
    return fresh;
  }
  if (a.length * b.length > 4_000_000) return fresh;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < a.length) {
    if (j < b.length && a[i] === b[j]) {
      i++;
      j++;
    } else if (j < b.length && dp[i][j + 1] >= dp[i + 1][j]) {
      j++;
    } else {
      fresh.add(i);
      i++;
    }
  }
  return fresh;
};

const Stat = ({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string | number; sub?: string }) => (
  <div className="rounded-xl border border-white/10 bg-zinc-950 p-4">
    <p className="flex items-center gap-1.5 text-xs text-zinc-500">
      <Icon size={13} /> {label}
    </p>
    <p className="mt-1.5 text-2xl font-semibold tabular-nums text-white">{value}</p>
    {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
  </div>
);

/** How a student got to their solution: a timeline of saves, runs and AI help, with code replay. */
const Journey = () => {
  const { classroomId = "", assignmentId = "", studentId = "" } = useParams();
  const [data, setData] = useState<JourneyData | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<JourneySnapshot | null>(null);
  const [snapError, setSnapError] = useState("");
  const [file, setFile] = useState("");

  useEffect(() => {
    getJourney(assignmentId, studentId)
      .then((j) => {
        setData(j);
        const snaps = j.timeline.filter((s) => s.hasSnapshot);
        setSelected(snaps[snaps.length - 1]?._id ?? null);
      })
      .catch((err) => setError(getErrorMessage(err, "Could not load the journey")));
  }, [assignmentId, studentId]);

  useEffect(() => {
    if (data) document.title = `Coding journey · ${data.student.name ?? data.student.username} · Aivex`;
  }, [data]);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    getJourneySnapshot(assignmentId, studentId, selected)
      .then((s) => {
        if (!alive) return;
        setSnapshot(s);
        setSnapError("");
        const names = Object.keys(s.files).filter((f) => !HIDDEN.test(f)).sort();
        setFile((current) => (names.includes(current) ? current : names[0] ?? ""));
      })
      .catch((err) => alive && setSnapError(getErrorMessage(err, "Could not load this version")));
    return () => {
      alive = false;
    };
  }, [assignmentId, studentId, selected]);

  const snapshots = useMemo(() => data?.timeline.filter((s) => s.hasSnapshot) ?? [], [data]);
  const index = snapshots.findIndex((s) => s._id === selected);
  const back = `/classes/${classroomId}/assignments/${assignmentId}`;

  if (error) {
    return (
      <div className="min-h-dvh bg-black px-6 py-16 text-center">
        <p className="text-red-400">{error}</p>
        <Link to={back} className="mt-4 inline-block text-sm text-teal-300 hover:underline">Back to the assignment</Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center gap-2 text-zinc-500">
        <Loader2 size={18} className="animate-spin" /> Loading journey…
      </div>
    );
  }

  const name = data.student.name || data.student.username || "Student";
  const s = data.summary;
  const start = s.firstAt ? new Date(s.firstAt).getTime() : 0;
  const span = s.firstAt && s.lastAt ? Math.max(1, new Date(s.lastAt).getTime() - start) : 1;
  const files: FlatFileTree = snapshot?.files ?? {};
  const fileNames = Object.keys(files).filter((f) => !HIDDEN.test(f)).sort();
  const code = files[file] ?? "";
  const fresh = snapshot ? newLines(snapshot.previous?.[file], code) : new Set<number>();
  const showingCurrent = snapshot?._id === selected;

  // Group the timeline by day, newest first
  const byDay = new Map<string, JourneyStep[]>();
  for (const step of [...data.timeline].reverse()) {
    const d = day(step.at);
    byDay.set(d, [...(byDay.get(d) ?? []), step]);
  }

  return (
    <div className="min-h-dvh bg-black text-zinc-100">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Link to={back} className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={15} /> {data.assignment.title}
        </Link>

        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Coding journey</p>
          <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
            {data.viewer === "student" ? "How you worked on this" : `How ${name} got there`}
          </h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-500">
            <Lock size={13} /> Only {data.viewer === "student" ? "you and your teacher" : `${name} and you`} can see this.
          </p>
        </header>

        {data.timeline.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-zinc-500">
            Nothing yet. Saves, runs and questions to Vex on this assignment show up here.
          </p>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6" aria-label="Summary">
              <Stat icon={Clock} label="Time spent" value={s.minutes < 60 ? `${s.minutes} min` : `${(s.minutes / 60).toFixed(1)} h`} sub="Active, breaks left out" />
              <Stat icon={Save} label="Saves" value={s.saves} sub={`${plural(s.linesWritten, "line")} written`} />
              <Stat icon={Play} label="Runs" value={s.runs} sub={s.runs ? `${s.failedRuns} with errors` : undefined} />
              <Stat icon={Bot} label="Asked Vex" value={s.aiQuestions} sub={s.aiLines ? `Vex wrote ${plural(s.aiLines, "line")}` : "Vex wrote no code"} />
              <Stat icon={LifeBuoy} label="Asked for help" value={s.helpRequests} />
              <Stat icon={Send} label="Submitted" value={s.submissions} sub={s.submissions === 1 ? "version" : "versions"} />
            </section>

            {/* Activity strip */}
            <section className="mt-6 rounded-xl border border-white/10 bg-zinc-950 p-4" aria-label="Activity over time">
              <div className="relative h-8">
                <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
                {data.timeline.map((step) => (
                  <button
                    key={step._id}
                    title={`${describe(step, name).title} · ${time(step.at)}`}
                    onClick={() => step.hasSnapshot && setSelected(step._id)}
                    className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-zinc-950 ${STEP[step.type].dot} ${
                      step.type === "run" && step.ok === false ? "!bg-red-400" : ""
                    } ${step._id === selected ? "scale-150" : ""} ${step.hasSnapshot ? "cursor-pointer" : "cursor-default"}`}
                    style={{ left: `${((new Date(step.at).getTime() - start) / span) * 100}%` }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-zinc-500">
                <span>{s.firstAt && `${day(s.firstAt)} ${time(s.firstAt)}`}</span>
                <span className="hidden gap-3 sm:flex">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-teal-400" /> save</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400" /> run</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> error</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-400" /> Vex</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> submit</span>
                </span>
                <span>{s.lastAt && `${day(s.lastAt)} ${time(s.lastAt)}`}</span>
              </div>
            </section>

            <div className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
              {/* Timeline */}
              <section aria-label="Timeline" className="max-h-[640px] overflow-y-auto rounded-xl border border-white/10 bg-zinc-950 p-2">
                {[...byDay.entries()].map(([d, steps]) => (
                  <div key={d}>
                    <p className="sticky top-0 z-10 bg-zinc-950 px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{d}</p>
                    <ul>
                      {steps.map((step) => {
                        const { icon: Icon, color } = STEP[step.type];
                        const { title, detail } = describe(step, name);
                        const failed = step.type === "run" && step.ok === false;
                        return (
                          <li key={step._id}>
                            <button
                              onClick={() => step.hasSnapshot && setSelected(step._id)}
                              className={`flex w-full gap-3 rounded-lg px-2 py-2 text-left ${
                                step._id === selected ? "bg-white/10" : step.hasSnapshot ? "hover:bg-white/5" : "cursor-default"
                              }`}
                            >
                              <Icon size={15} className={`mt-0.5 shrink-0 ${failed ? "text-red-400" : color}`} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm text-zinc-200">{title}</span>
                                {detail && (
                                  <span className={`block truncate text-xs ${failed ? "text-red-300/80" : "text-zinc-500"}`}>{detail}</span>
                                )}
                              </span>
                              <span className="shrink-0 text-[11px] text-zinc-600">{time(step.at)}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </section>

              {/* Replay */}
              <section aria-label="Code replay" className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
                  <p className="text-sm text-zinc-300">
                    {snapshots.length === 0
                      ? "No code versions yet"
                      : showingCurrent && snapshot
                        ? <>Code at {time(snapshot.at)} · {day(snapshot.at)} <span className="text-zinc-500">({index + 1} of {snapshots.length})</span></>
                        : "Loading…"}
                  </p>
                  {snapshots.length > 1 && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => index > 0 && setSelected(snapshots[index - 1]._id)}
                        disabled={index <= 0}
                        aria-label="Earlier version"
                        className="rounded-md border border-white/10 p-1.5 text-zinc-300 hover:border-white/20 disabled:opacity-30"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <button
                        onClick={() => index < snapshots.length - 1 && setSelected(snapshots[index + 1]._id)}
                        disabled={index >= snapshots.length - 1}
                        aria-label="Later version"
                        className="rounded-md border border-white/10 p-1.5 text-zinc-300 hover:border-white/20 disabled:opacity-30"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  )}
                </div>
                {snapError ? (
                  <p className="p-6 text-sm text-red-400">{snapError}</p>
                ) : snapshot && showingCurrent ? (
                  <div className="flex min-h-[420px] flex-col md:flex-row">
                    <ul className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 p-2 md:w-44 md:flex-col md:border-b-0 md:border-r">
                      {fileNames.map((f) => (
                        <li key={f}>
                          <button
                            onClick={() => setFile(f)}
                            title={f}
                            className={`flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2 py-1.5 text-left text-xs ${
                              f === file ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5"
                            }`}
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
                          {code.split("\n").map((line, i) => (
                            <div key={i} className={`flex ${fresh.has(i) && snapshot.previous ? "bg-emerald-500/10" : ""}`}>
                              <span className={`w-12 shrink-0 select-none pr-4 text-right ${fresh.has(i) && snapshot.previous ? "text-emerald-400" : "text-zinc-600"}`}>
                                {i + 1}
                              </span>
                              <span className="whitespace-pre pr-4 text-zinc-200">{line || " "}</span>
                            </div>
                          ))}
                        </code>
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[420px] items-center justify-center text-sm text-zinc-500">
                    {snapshots.length ? <Loader2 size={18} className="animate-spin" /> : "Versions appear after the first save."}
                  </div>
                )}
                {snapshot?.previous && showingCurrent && (
                  <p className="border-t border-white/10 px-3 py-2 text-[11px] text-zinc-500">
                    <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-500/40" /> Lines new since the previous version
                  </p>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Journey;
