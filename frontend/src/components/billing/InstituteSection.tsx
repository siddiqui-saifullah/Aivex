import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Building2, CheckCircle2, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { formatInr, INSTITUTE_PRICE, sendInstituteInquiry } from "../../services/billing.service";
import { useUser } from "../../context/user.context";
import { getErrorMessage } from "../../utils/getErrorMessage";

const POINTS = [
  { icon: Sparkles, text: "Every student in your classes gets 30 Vex questions a day" },
  { icon: ShieldCheck, text: "You set the AI rule per assignment: allowed, hints only, or off" },
  { icon: BarChart3, text: "Submissions, marks, feedback and each student's coding journey" },
];

const input = "mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-teal-500/60 focus:outline-none";

/** Pricing page: the institute plan, and a form for colleges that want a quote. */
const InstituteSection = () => {
  const { user } = useUser();
  const [form, setForm] = useState({ name: "", email: "", institute: "", students: "", message: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setState("sending");
    try {
      await sendInstituteInquiry({ ...form, students: Number(form.students) || 0 });
      setState("sent");
    } catch (err) {
      setError(getErrorMessage(err, "Could not send your message"));
      setState("idle");
    }
  };

  return (
    <section id="institute" className="scroll-mt-24 border-t border-white/5 py-20" aria-labelledby="institute-title">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-teal-400">
            <Building2 size={16} /> For colleges
          </p>
          <h2 id="institute-title" className="text-3xl font-bold text-white md:text-4xl">Institute plan</h2>
          <p className="mt-4 text-lg text-zinc-400">
            AI help for a whole class, about ₹33 a month per student on the yearly plan.
          </p>
          <p className="mt-6">
            <span className="text-4xl font-bold text-white">{formatInr(INSTITUTE_PRICE.yearly)}</span>
            <span className="ml-1 text-zinc-500">per student / year</span>
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            or {formatInr(INSTITUTE_PRICE.monthly)} per student / month · minimum {INSTITUTE_PRICE.minSeats} seats
          </p>
          <ul className="mt-6 space-y-3 text-zinc-300">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3">
                <Icon size={18} className="mt-0.5 shrink-0 text-teal-400" /> {text}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to={user ? "/settings/billing" : `/register?next=${encodeURIComponent("/settings/billing")}`}
              className="inline-flex items-center justify-center rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-teal-400"
            >
              Buy seats online
            </Link>
            <a href="#institute-form" className="inline-flex items-center justify-center rounded-lg border border-white/15 px-5 py-2.5 text-sm font-medium text-white hover:border-white/30">
              Talk to us
            </a>
          </div>
          <p className="mt-3 text-xs text-zinc-500">Teachers buy seats in Settings → Plan &amp; billing (turn on teaching mode first).</p>
        </div>

        <div id="institute-form" className="scroll-mt-24 rounded-2xl border border-white/10 bg-zinc-950 p-6">
          {state === "sent" ? (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 size={36} className="text-teal-400" />
              <p className="mt-4 text-lg font-semibold text-white">Thanks, we'll be in touch</p>
              <p className="mt-1 text-sm text-zinc-400">We usually reply within a day.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Get a quote</h3>
                <p className="mt-1 text-sm text-zinc-400">For a department or the whole college, invoices and bank transfer.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs text-zinc-400">Your name<input required minLength={2} maxLength={80} value={form.name} onChange={set("name")} className={input} /></label>
                <label className="text-xs text-zinc-400">Email<input required type="email" maxLength={254} value={form.email} onChange={set("email")} className={input} /></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <label className="text-xs text-zinc-400">Institute<input required minLength={2} maxLength={120} value={form.institute} onChange={set("institute")} className={input} /></label>
                <label className="text-xs text-zinc-400">Students<input type="number" min={0} value={form.students} onChange={set("students")} className={input} /></label>
              </div>
              <label className="block text-xs text-zinc-400">
                Message (optional)
                <textarea rows={3} maxLength={2000} value={form.message} onChange={set("message")} className={`${input} resize-none`} />
              </label>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={state === "sending"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-60"
              >
                {state === "sending" && <Loader2 size={14} className="animate-spin" />} Send
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

export default InstituteSection;
