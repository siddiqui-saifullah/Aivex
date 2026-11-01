import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Building2, Loader2, Users } from "lucide-react";
import { PeriodToggle } from "./PlanCards";
import { formatInr, getInstitute, startSeatCheckout, type BillingPeriod, type InstituteSummary } from "../../services/billing.service";
import { useToast } from "../../context/toast.context";
import { getErrorMessage } from "../../utils/getErrorMessage";

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Settings → Plan & billing, for teachers: seats for their classes. Students
 * in the teacher's classes get the Student plan's AI, in joining order.
 */
const InstituteManager = () => {
  const toast = useToast();
  const [data, setData] = useState<InstituteSummary | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>("yearly");
  const [seats, setSeats] = useState("30");
  const [institute, setInstitute] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getInstitute()
      .then((d) => {
        setData(d);
        const last = d.packs[0]?.institute;
        if (last) setInstitute(last);
        // Enough seats for everyone already in the classes
        if (d.students.length > 30) setSeats(String(Math.min(d.maxSeats, d.students.length)));
      })
      .catch(() => undefined);
  }, []);

  if (!data) return <div className="h-48 animate-pulse rounded-xl border border-white/5 bg-zinc-950" />;

  const n = Number(seats);
  const valid = Number.isInteger(n) && n >= data.minSeats && n <= data.maxSeats;
  const total = valid ? n * data.price[period] : 0;
  const waiting = data.students.filter((s) => !s.covered).length;
  const active = data.packs.filter((p) => p.active);

  const buy = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || institute.trim().length < 2) return;
    setBusy(true);
    try {
      await startSeatCheckout({ seats: n, period, institute: institute.trim() });
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not start the payment"));
      setBusy(false);
    }
  };

  return (
    <section id="institute" className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Building2 size={20} className="mt-0.5 shrink-0 text-teal-300" />
        <div>
          <h2 className="text-base font-semibold text-white">Institute plan</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Buy seats for your classes. Every student in them gets the Student plan (30 Vex questions a day), in the order they joined.
          </p>
        </div>
      </div>

      {data.packs.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-black px-4 py-3">
            <p className="text-xs text-zinc-500">Seats</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">{Math.min(data.students.length, data.capacity)} / {data.capacity} used</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black px-4 py-3">
            <p className="text-xs text-zinc-500">Students waiting for a seat</p>
            <p className={`mt-0.5 text-lg font-semibold tabular-nums ${waiting ? "text-amber-300" : "text-white"}`}>{waiting}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black px-4 py-3">
            <p className="text-xs text-zinc-500">Valid until</p>
            <p className="mt-0.5 text-lg font-semibold text-white">{active[0] ? formatDate(active[0].validUntil) : "Expired"}</p>
          </div>
        </div>
      )}

      {data.students.length > 0 && (
        <details className="mt-4 rounded-lg border border-white/10 bg-black">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm text-zinc-300">
            <Users size={14} /> Students with seats ({data.students.length})
          </summary>
          <ul className="max-h-64 divide-y divide-white/5 overflow-y-auto border-t border-white/10 text-sm">
            {data.students.map((s) => (
              <li key={s._id} className="flex items-center justify-between gap-2 px-4 py-2">
                <span className="truncate text-zinc-200">{s.name} <span className="text-zinc-500">@{s.username}</span></span>
                <span className={`shrink-0 text-xs ${s.covered ? "text-teal-300" : "text-amber-300"}`}>{s.covered ? "Covered" : "Waiting"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <form onSubmit={buy} className="mt-5 space-y-4 border-t border-white/10 pt-5">
        <p className="text-sm font-medium text-white">{data.packs.length ? "Add seats or renew" : "Buy seats"}</p>
        <PeriodToggle period={period} onChange={setPeriod} />
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <label className="text-xs text-zinc-400">
            Institute name
            <input
              value={institute}
              onChange={(e) => setInstitute(e.target.value)}
              maxLength={100}
              required
              placeholder="e.g. City Engineering College"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-teal-500/60 focus:outline-none"
            />
          </label>
          <label className="text-xs text-zinc-400">
            Seats
            <input
              type="number"
              min={data.minSeats}
              max={data.maxSeats}
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm tabular-nums text-white focus:border-teal-500/60 focus:outline-none"
            />
          </label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-400">
            {valid
              ? <>{n} × {formatInr(data.price[period])} = <span className="font-semibold text-white">{formatInr(total)}</span> {period === "yearly" ? "for 1 year" : "for 1 month"}</>
              : `Choose ${data.minSeats} to ${data.maxSeats} seats.`}
          </p>
          <button
            type="submit"
            disabled={!valid || busy || !data.enabled || institute.trim().length < 2}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-black hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {data.enabled ? "Pay with Razorpay" : "Coming soon"}
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          New seats add to the ones you have. Paying by invoice or need more than {data.maxSeats} seats?{" "}
          <Link to="/pricing#institute" className="text-teal-300 hover:underline">Contact us</Link>.
        </p>
      </form>
    </section>
  );
};

export default InstituteManager;
