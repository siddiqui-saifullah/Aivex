import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, GraduationCap, KeyRound, LogOut, Plus, Users } from "lucide-react";
import { CreateClassModal, JoinClassModal } from "../classroom/ClassModals";
import { createClassroom, getClassrooms, joinClassroom, leaveClassroom } from "../../services/classroom.service";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { useToast } from "../../context/toast.context";
import { plural } from "../../utils/plural";
import { STACK_FORMATTER } from "../../constants/options";
import type { ClassroomSummary, Project } from "../../types";

/** Dashboard strip: classes the user teaches or is enrolled in, plus create / join. */
const ClassroomSection = ({ ownProjects, onChanged }: { ownProjects: Project[]; onChanged?: () => void }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [classes, setClasses] = useState<ClassroomSummary[] | null>(null);
  const [modal, setModal] = useState<"create" | "join" | null>(null);

  useEffect(() => {
    let alive = true;
    getClassrooms()
      .then((list) => alive && setClasses(list))
      // Older server without classes: just show the actions
      .catch(() => alive && setClasses([]));
    return () => {
      alive = false;
    };
  }, []);

  const leave = async (c: ClassroomSummary) => {
    if (!window.confirm(`Leave “${c.name}”? Your project stays yours as a personal project, and your teacher can no longer open it.`)) return;
    try {
      await leaveClassroom(c._id);
      setClasses((list) => list?.filter((x) => x._id !== c._id) ?? null);
      toast.success(`You left ${c.name}`);
      onChanged?.();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not leave the class"));
    }
  };

  const open = (c: ClassroomSummary) => {
    navigate(`/classes/${c._id}`);
  };

  return (
    <section className="mb-10" aria-labelledby="classes-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GraduationCap size={18} className="text-teal-400" />
          <h2 id="classes-heading" className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
            Classes
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModal("join")}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5"
          >
            <KeyRound size={14} /> Join with code
          </button>
          <button
            onClick={() => setModal("create")}
            className="flex items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-sm text-teal-300 hover:bg-teal-500/15"
          >
            <Plus size={14} /> Create class
          </button>
        </div>
      </div>

      {classes === null ? (
        <div className="h-20 animate-pulse rounded-xl bg-zinc-900/60" />
      ) : classes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-sm text-zinc-500">
          Teaching? Create a class: students join with a code, each gets the starter code, and you can watch and help
          everyone live. Learning? Join with the code your teacher gave you.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <div key={c._id} className="group relative">
            <button
              onClick={() => open(c)}
              className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-zinc-900/50 p-4 text-left transition hover:border-teal-500/30 hover:bg-zinc-900"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-300">
                <GraduationCap size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-100">{c.name}</p>
                <p className="flex items-center gap-1.5 truncate text-xs text-zinc-500">
                  {c.role === "teacher" ? (
                    <>
                      <Users size={12} /> {plural(c.studentCount, "student")} · code{" "}
                      <span className="font-mono text-teal-300">{c.code}</span>
                    </>
                  ) : (
                    <>Teacher: {c.teacher.name || c.teacher.username} · {STACK_FORMATTER[c.stack] ?? c.stack}</>
                  )}
                </p>
              </div>
              <ArrowRight size={16} className="shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-teal-300" />
            </button>
            {c.role === "student" && (
              <button
                onClick={() => leave(c)}
                title={`Leave ${c.name}`}
                aria-label={`Leave ${c.name}`}
                className="absolute right-10 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-600 opacity-100 hover:bg-white/5 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
              >
                <LogOut size={14} />
              </button>
            )}
            </div>
          ))}
        </div>
      )}

      {modal === "create" && (
        <CreateClassModal
          templates={ownProjects}
          onClose={() => setModal(null)}
          onCreate={async (data) => {
            const created = await createClassroom(data);
            toast.success(`Class created · code ${created.code}`);
            navigate(`/classes/${created._id}`);
          }}
        />
      )}
      {modal === "join" && (
        <JoinClassModal
          onClose={() => setModal(null)}
          onJoin={async (code) => {
            const joined = await joinClassroom(code);
            toast.success(joined.alreadyJoined ? "Opening your class project" : "Joined! Here is your project");
            navigate(`/classes/${joined.classroomId}`);
          }}
        />
      )}
    </section>
  );
};

export default ClassroomSection;
