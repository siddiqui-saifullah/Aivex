import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { GraduationCap, Loader2 } from "lucide-react";
import Button from "../components/ui/Button";
import { joinClassroom } from "../services/classroom.service";
import { getErrorMessage } from "../utils/getErrorMessage";
import { useToast } from "../context/toast.context";

/** /join/:code invite links (and /join to type a code). */
const JoinClass = () => {
  const { code: codeParam = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [code, setCode] = useState(codeParam.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(codeParam));
  const attempted = useRef(false);

  const join = async (value: string) => {
    setLoading(true);
    setError("");
    try {
      const joined = await joinClassroom(value);
      toast.success(joined.alreadyJoined ? "Opening your class project" : "Joined! Here is your project");
      navigate(`/projects/${joined.projectId}`, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Could not join the class"));
      setLoading(false);
    }
  };

  // Invite link: join straight away (once, even in StrictMode)
  useEffect(() => {
    if (!codeParam || attempted.current) return;
    attempted.current = true;
    join(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.length === 6) join(code);
  };

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-black px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-300">
          {loading ? <Loader2 size={26} className="animate-spin" /> : <GraduationCap size={26} />}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{loading ? "Joining class…" : "Join a class"}</h1>
          <p className="mt-1 text-sm text-zinc-400">Enter the 6-character code from your teacher.</p>
        </div>
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
            setError("");
          }}
          disabled={loading}
          autoFocus={!codeParam}
          placeholder="ABC123"
          aria-label="Class code"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-4 text-center font-mono text-3xl tracking-[0.4em] text-white placeholder-zinc-700 focus:border-teal-500/50 focus:outline-none"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" variant="primary" fullWidth loading={loading} disabled={code.length !== 6}>
          Join class
        </Button>
      </form>
    </div>
  );
};

export default JoinClass;
