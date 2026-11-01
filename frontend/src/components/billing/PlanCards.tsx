import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import { formatInr, startCheckout, type BillingPeriod, type Plan, type PlanId } from "../../services/billing.service";
import { useToast } from "../../context/toast.context";
import { getErrorMessage } from "../../utils/getErrorMessage";

const RANK: Record<PlanId, number> = { free: 0, student: 1, pro: 2, premium: 3 };
const POPULAR: PlanId = "pro";

/** Monthly / yearly switch. */
export const PeriodToggle = ({ period, onChange }: { period: BillingPeriod; onChange: (p: BillingPeriod) => void }) => (
  <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-full border border-white/10 bg-zinc-950 p-1 text-sm">
    {(["monthly", "yearly"] as const).map((p) => (
      <button
        key={p}
        role="radio"
        aria-checked={period === p}
        onClick={() => onChange(p)}
        className={`rounded-full px-4 py-1.5 font-medium transition ${period === p ? "bg-white text-black" : "text-zinc-400 hover:text-white"}`}
      >
        {p === "monthly" ? "Monthly" : "Yearly"}
        {p === "yearly" && <span className={`ml-1.5 text-xs ${period === p ? "text-teal-700" : "text-teal-400"}`}>2 months free</span>}
      </button>
    ))}
  </div>
);

/**
 * The four plans. Signed-out visitors go to sign up; signed-in users pay on
 * Razorpay's page. `current` marks the user's active plan.
 */
const PlanCards = ({ plans, period, enabled, signedIn, current = null, compact = false }: {
  plans: Plan[];
  period: BillingPeriod;
  /** Payments are set up on the server. */
  enabled: boolean;
  signedIn: boolean;
  current?: PlanId | null;
  compact?: boolean;
}) => {
  const toast = useToast();
  const [busy, setBusy] = useState<PlanId | null>(null);

  const buy = async (plan: PlanId) => {
    setBusy(plan);
    try {
      await startCheckout(plan, period);
      // The browser is leaving for Razorpay; keep the spinner
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not start the payment"));
      setBusy(null);
    }
  };

  return (
    <div className={`grid gap-4 ${compact ? "sm:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-4"}`}>
      {plans.map((plan) => {
        const price = plan.price[period];
        const perMonth = period === "yearly" ? Math.round(plan.price.yearly / 12) : plan.price.monthly;
        const popular = plan.id === POPULAR;
        const isCurrent = current === plan.id;
        const lower = current != null && RANK[plan.id] < RANK[current];

        let action;
        if (plan.id === "free") {
          action = signedIn
            ? <span className="block rounded-lg border border-white/10 py-2 text-center text-sm text-zinc-500">{isCurrent ? "Your plan" : "Included"}</span>
            : <Link to="/register" className="block rounded-lg border border-white/15 py-2 text-center text-sm font-medium text-white hover:border-white/30">Start free</Link>;
        } else if (!signedIn) {
          action = (
            <Link
              to={`/register?next=${encodeURIComponent("/settings/billing")}`}
              className={`block rounded-lg py-2 text-center text-sm font-semibold ${popular ? "bg-teal-500 text-black hover:bg-teal-400" : "bg-white text-black hover:bg-zinc-200"}`}
            >
              Get {plan.name}
            </Link>
          );
        } else {
          const label = isCurrent ? `Extend ${plan.name}` : lower ? "Available after your plan ends" : `Upgrade to ${plan.name}`;
          action = (
            <button
              onClick={() => buy(plan.id)}
              disabled={!enabled || lower || busy !== null}
              className={`flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                popular ? "bg-teal-500 text-black hover:bg-teal-400" : "bg-white text-black hover:bg-zinc-200"
              }`}
            >
              {busy === plan.id && <Loader2 size={14} className="animate-spin" />}
              {enabled ? label : "Coming soon"}
            </button>
          );
        }

        return (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border p-5 ${
              popular ? "border-teal-500/50 bg-teal-500/[0.04] shadow-lg shadow-teal-500/10" : "border-white/10 bg-zinc-950"
            }`}
          >
            {popular && (
              <span className="absolute -top-2.5 left-5 rounded-full bg-teal-500 px-2.5 py-0.5 text-[11px] font-semibold text-black">Most popular</span>
            )}
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              {isCurrent && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-zinc-300">Current</span>}
            </div>
            <p className="mt-1 text-sm text-zinc-400">{plan.tagline}</p>
            <div className="mt-5">
              <span className="text-3xl font-bold tabular-nums text-white">{formatInr(price)}</span>
              <span className="ml-1 text-sm text-zinc-500">{price === 0 ? "forever" : period === "yearly" ? "/year" : "/month"}</span>
              <p className="mt-1 h-4 text-xs text-zinc-500">
                {price > 0 && period === "yearly" ? `${formatInr(perMonth)}/month, billed yearly` : ""}
              </p>
            </div>
            <ul className="mt-5 flex-1 space-y-2.5 text-sm text-zinc-300">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-teal-400" /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">{action}</div>
          </div>
        );
      })}
    </div>
  );
};

export default PlanCards;
