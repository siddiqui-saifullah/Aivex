import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import PlanCards, { PeriodToggle } from "./PlanCards";
import InstituteManager from "./InstituteManager";
import {
  formatInr,
  getBilling,
  getPlans,
  verifyPayment,
  type BillingPeriod,
  type BillingSummary,
  type Plan,
} from "../../services/billing.service";
import { useToast } from "../../context/toast.context";
import { getErrorMessage } from "../../utils/getErrorMessage";

const RAZORPAY_PARAMS = [
  "razorpay_payment_id",
  "razorpay_payment_link_id",
  "razorpay_payment_link_reference_id",
  "razorpay_payment_link_status",
  "razorpay_signature",
];

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const Section = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <section className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950 p-5 sm:p-6">
    <h2 className="text-base font-semibold text-white">{title}</h2>
    {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

/** Settings → Plan & billing: the current plan, upgrades and receipts. */
const BillingTab = ({ teachingMode = false }: { teachingMode?: boolean }) => {
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  // Back from Razorpay's payment page with the payment's details
  const [confirming, setConfirming] = useState(() => Boolean(params.get("razorpay_payment_link_id")));
  const [error, setError] = useState("");
  const handled = useRef(false);

  const load = useCallback(() => {
    getBilling().then(setBilling).catch((err) => setError(getErrorMessage(err, "Could not load your plan")));
  }, []);

  useEffect(() => {
    getPlans().then((d) => setPlans(d.plans)).catch(() => undefined);
  }, []);

  // Back from Razorpay's payment page: confirm the payment, then tidy the URL
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const back = Object.fromEntries(RAZORPAY_PARAMS.map((k) => [k, params.get(k) ?? ""]));
    if (!back.razorpay_payment_link_id) {
      load();
      return;
    }
    verifyPayment(back)
      .then((summary) => {
        if (summary.paid?.kind === "seats") {
          toast.success(`Payment received. ${summary.paid.seats} seats are active${summary.paid.validUntil ? ` until ${formatDate(summary.paid.validUntil)}` : ""}.`, 8000);
          return;
        }
        const name = summary.plan[0].toUpperCase() + summary.plan.slice(1);
        toast.success(
          summary.expiresAt ? `Payment received. You're on ${name} until ${formatDate(summary.expiresAt)}.` : "Payment received.",
          8000,
        );
      })
      .catch((err) => toast.error(getErrorMessage(err, "We couldn't confirm the payment"), 10000))
      .finally(() => {
        setConfirming(false);
        navigate("/settings/billing", { replace: true });
        load();
      });
  }, [params, load, navigate, toast]);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (confirming || !billing) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-950 p-6 text-sm text-zinc-400">
        <Loader2 size={16} className="animate-spin" />
        {confirming ? "Confirming your payment…" : "Loading your plan…"}
      </div>
    );
  }

  const current = plans?.find((p) => p.id === billing.plan);
  const usage = billing.usage;

  return (
    <div className="space-y-6">
      <Section title="Current plan">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xl font-semibold text-white">
              {current?.name ?? billing.plan}
              {billing.plan !== "free" && <CheckCircle2 size={18} className="text-teal-400" />}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {billing.admin
                ? "Admin account: no daily limits."
                : billing.institute
                  ? `Provided by ${billing.institute.institute || "your institute"}${billing.institute.teacher ? ` through ${billing.institute.teacher}'s class` : ""}, until ${formatDate(billing.institute.expiresAt)}.`
                : billing.expiresAt
                  ? `Active until ${formatDate(billing.expiresAt)}. It doesn't renew on its own.`
                  : "Free forever. Upgrade any time for more Vex AI help."}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black px-4 py-3 text-sm">
            <p className="text-xs text-zinc-500">Vex questions today</p>
            <p className="mt-0.5 font-semibold tabular-nums text-white">
              {usage.limit == null ? "Unlimited" : `${usage.used} of ${usage.limit} used`}
            </p>
          </div>
        </div>
      </Section>

      <Section
        title={billing.plan === "free" ? "Upgrade" : "Change or extend your plan"}
        description="Pay once for a month or a year with UPI, cards or netbanking. Buying again adds the days on; upgrading keeps the value of your unused days."
      >
        <div className="mb-5">
          <PeriodToggle period={period} onChange={setPeriod} />
        </div>
        {plans ? (
          <PlanCards plans={plans} period={period} enabled={billing.enabled} signedIn current={billing.plan} compact />
        ) : (
          <div className="h-80 animate-pulse rounded-xl bg-zinc-900" />
        )}
        {!billing.enabled && <p className="mt-4 text-xs text-amber-300/80">Paid plans open soon.</p>}
      </Section>

      {(teachingMode || billing.payments.some((p) => p.kind === "seats")) && <InstituteManager />}

      <Section title="Payment history" description="Your receipts are also emailed by Razorpay.">
        {billing.payments.length === 0 ? (
          <p className="text-sm text-zinc-500">No payments yet.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="px-5 py-2 font-medium sm:px-0">Date</th>
                  <th className="py-2 font-medium">Plan</th>
                  <th className="py-2 font-medium">Amount</th>
                  <th className="py-2 pr-5 font-medium sm:pr-0">Valid until</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-300">
                {billing.payments.map((p) => (
                  <tr key={p._id}>
                    <td className="px-5 py-2.5 sm:px-0">{formatDate(p.paidAt)}</td>
                    <td className="py-2.5">{p.kind === "seats" ? `${p.seats} seats` : p.plan[0].toUpperCase() + p.plan.slice(1)} · {p.period}</td>
                    <td className="py-2.5 tabular-nums">{formatInr(p.amount / 100)}</td>
                    <td className="py-2.5 pr-5 sm:pr-0">{p.validUntil ? formatDate(p.validUntil) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
};

export default BillingTab;
