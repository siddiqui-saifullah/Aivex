import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, Loader2 } from "lucide-react";
import {
  getAdminInstitutes,
  grantAdminSeats,
  setInquiryStatus,
  type AdminSeatPack,
  type InstituteInquiry,
} from "../../services/admin.service";
import { useToast } from "../../context/toast.context";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { timeAgo } from "../../utils/timeAgo";

const field = "w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-teal-500/60 focus:outline-none";
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Admin: college enquiries, and seats for colleges that pay by invoice. */
const InstitutesPanel = () => {
  const toast = useToast();
  const [data, setData] = useState<{ inquiries: InstituteInquiry[]; packs: AdminSeatPack[] } | null>(null);
  const [form, setForm] = useState({ email: "", institute: "", seats: "50", days: "365" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getAdminInstitutes().then(setData).catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  const grant = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await grantAdminSeats({ email: form.email.trim(), institute: form.institute.trim(), seats: Number(form.seats), days: Number(form.days) });
      toast.success(`${form.seats} seats given to ${form.email}`);
      setForm((f) => ({ ...f, email: "", institute: "" }));
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not give the seats"));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (q: InstituteInquiry) => {
    await setInquiryStatus(q._id, q.status === "new" ? "done" : "new").catch(() => undefined);
    load();
  };

  const open = data?.inquiries.filter((q) => q.status === "new").length ?? 0;

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-zinc-950 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-300">
        <Building2 size={16} className="text-teal-300" /> Institutes
        {open > 0 && <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[11px] normal-case tracking-normal text-teal-200">{open} new</span>}
      </h2>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-zinc-200">Enquiries</p>
          {!data ? (
            <div className="h-24 animate-pulse rounded-lg bg-zinc-900" />
          ) : data.inquiries.length === 0 ? (
            <p className="text-sm text-zinc-500">No enquiries yet.</p>
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto">
              {data.inquiries.map((q) => (
                <li key={q._id} className={`rounded-lg border p-3 text-sm ${q.status === "new" ? "border-teal-500/30 bg-teal-500/[0.03]" : "border-white/10 opacity-70"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-white">{q.institute}{q.students ? <span className="text-zinc-500"> · {q.students} students</span> : null}</p>
                      <p className="truncate text-xs text-zinc-400">{q.name} · <a href={`mailto:${q.email}`} className="text-teal-300 hover:underline">{q.email}</a> · {timeAgo(q.createdAt)}</p>
                    </div>
                    <button onClick={() => toggle(q)} className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:border-white/25">
                      {q.status === "new" ? "Mark done" : "Reopen"}
                    </button>
                  </div>
                  {q.message && <p className="mt-2 whitespace-pre-wrap break-words text-zinc-300">{q.message}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-zinc-200">Give seats (paid by invoice)</p>
          <form onSubmit={grant} className="space-y-2">
            <input required type="email" placeholder="Teacher's account email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
            <input placeholder="Institute name" value={form.institute} onChange={(e) => setForm({ ...form, institute: e.target.value })} className={field} />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-zinc-500">Seats<input required type="number" min={1} value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} className={`${field} mt-1`} /></label>
              <label className="text-xs text-zinc-500">Days<input required type="number" min={1} max={1100} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} className={`${field} mt-1`} /></label>
            </div>
            <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50">
              {busy && <Loader2 size={14} className="animate-spin" />} Give seats
            </button>
          </form>

          {data && data.packs.length > 0 && (
            <>
              <p className="mb-2 mt-5 text-sm font-medium text-zinc-200">Seat packs</p>
              <ul className="max-h-60 divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10 text-sm">
                {data.packs.map((p) => (
                  <li key={p._id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0 truncate text-zinc-300">
                      {p.institute || "—"} <span className="text-zinc-500">· {p.owner?.email ?? "deleted user"}</span>
                    </span>
                    <span className={`shrink-0 text-xs tabular-nums ${new Date(p.validUntil) > new Date() ? "text-zinc-300" : "text-zinc-600"}`}>
                      {p.seats} seats · {p.source === "admin" ? "invoice" : "online"} · until {formatDate(p.validUntil)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default InstitutesPanel;
