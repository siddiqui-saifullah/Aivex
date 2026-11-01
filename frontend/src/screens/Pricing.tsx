import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import PlanCards, { PeriodToggle } from "../components/billing/PlanCards";
import { getBilling, getPlans, type BillingPeriod, type Plan, type PlanId } from "../services/billing.service";
import { useUser } from "../context/user.context";
import { usePageMeta } from "../hooks/usePageMeta";

const TITLE = "Pricing · Aivex: plans for students, builders and teachers";
const DESCRIPTION =
  "Aivex is free to start. Upgrade to Student, Pro or Premium for more Vex AI help every day: code, fixes and explanations, from ₹99 a month. Pay with UPI, cards or netbanking.";

const FAQ = [
  {
    q: "What counts as a Vex question?",
    a: "Every message to @Vex: writing or changing code, fixing an error, or explaining something. \"Improve my prompt\" has its own daily allowance. If Vex fails to answer, the question isn't counted. Pro and Premium also have a monthly fair-use limit (1,200 and 4,000 questions).",
  },
  {
    q: "When does my daily allowance reset?",
    a: "Every day at midnight, India time. Unused questions don't carry over.",
  },
  {
    q: "Does it renew automatically?",
    a: "No. You pay for one month or one year at a time, and your account goes back to Free when it ends. Buy again any time to extend it: the new days are added on.",
  },
  {
    q: "What if I upgrade in the middle of a plan?",
    a: "The days you have left on your old plan are converted at their value and added to the new plan, so you never lose what you paid for.",
  },
  {
    q: "How can I pay?",
    a: "Payments are handled by Razorpay: UPI, debit and credit cards, netbanking and wallets. Aivex never sees your card details.",
  },
  {
    q: "Is the IDE itself free?",
    a: "Yes. The editor, live preview, Node.js and C/C++ runs, collaboration and classrooms are free on every plan. Plans only change how much you can use Vex AI each day and which model answers first.",
  },
  {
    q: "Which AI models answer?",
    a: "Free and Student questions are answered by free open models (through providers such as OpenRouter and Groq), with Google Gemini as a backup so you always get an answer. Pro uses Gemini 2.5 Flash with deeper thinking. Premium gets 30 answers a day from Gemini 2.5 Pro, then Gemini 2.5 Flash.",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      name: "Aivex",
      description: DESCRIPTION,
      brand: { "@type": "Brand", name: "Aivex" },
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "INR" },
        { "@type": "Offer", name: "Student", price: "99", priceCurrency: "INR" },
        { "@type": "Offer", name: "Pro", price: "299", priceCurrency: "INR" },
        { "@type": "Offer", name: "Premium", price: "799", priceCurrency: "INR" },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-medium text-zinc-100 hover:text-white"
      >
        {q}
        <ChevronDown size={18} className={`shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <p className={`pb-5 leading-relaxed text-zinc-400 ${open ? "" : "hidden"}`}>{a}</p>
    </div>
  );
};

const Pricing = () => {
  usePageMeta({ title: TITLE, description: DESCRIPTION, path: "/pricing", jsonLd: JSON_LD });
  const { user } = useUser();
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [current, setCurrent] = useState<PlanId | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getPlans()
      .then((d) => {
        setPlans(d.plans);
        setEnabled(d.enabled);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (!user) return;
    getBilling().then((b) => setCurrent(b.plan)).catch(() => undefined);
  }, [user]);

  return (
    <div className="min-h-dvh overflow-x-hidden bg-black text-zinc-100">
      <header className="relative px-4 pb-10 pt-32 sm:px-6 md:pt-40">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute left-1/2 top-0 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-teal-500/10 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-teal-400">Pricing</p>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl">
            More AI help, at a <span className="bg-linear-to-r from-teal-300 to-emerald-400 bg-clip-text text-transparent">student price</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-400">
            The IDE is free forever. Pick a plan when you want Vex to write, fix and explain more code every day.
          </p>
          <div className="mt-8">
            <PeriodToggle period={period} onChange={setPeriod} />
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6" aria-label="Plans">
          {failed ? (
            <p className="text-center text-sm text-zinc-400">Couldn't load the plans. Please refresh the page.</p>
          ) : !plans ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-96 animate-pulse rounded-2xl border border-white/5 bg-zinc-950" />)}
            </div>
          ) : (
            <PlanCards plans={plans} period={period} enabled={enabled} signedIn={Boolean(user)} current={current} />
          )}
          <p className="mt-6 text-center text-xs text-zinc-500">
            Prices in Indian rupees, including taxes. One-time payment for a month or a year, no auto-renew. Secure payments by Razorpay.
          </p>
          {plans && !enabled && (
            <p className="mt-2 text-center text-xs text-amber-300/80">Paid plans open soon. Everything on Free works today.</p>
          )}
        </section>

        <section className="border-t border-white/5 py-20" aria-labelledby="pricing-faq">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 id="pricing-faq" className="text-3xl font-bold text-white">Questions about plans</h2>
            <div className="mt-6">
              {FAQ.map((f) => <FaqItem key={f.q} {...f} />)}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Pricing;
