import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  Cpu,
  Download,
  FolderTree,
  GraduationCap,
  KeyRound,
  Lightbulb,
  MessageSquare,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import LazyVideo from "../components/ui/LazyVideo";
import { useUser } from "../context/user.context";
import { usePageMeta } from "../hooks/usePageMeta";
import livedemo from "../images/livedemo.mp4";
import livedemoPoster from "../images/livedemo-poster.webp";
import chatDemo from "../images/ChatDemo.mp4";
import chatDemoPoster from "../images/ChatDemo-poster.webp";
import cRun from "../images/features/feature-c.mp4";
import cRunPoster from "../images/features/feature-c-poster.webp";
import classroomClip from "../images/features/feature-classroom.mp4";
import classroomPoster from "../images/features/feature-classroom-poster.webp";
import hintsClip from "../images/features/feature-hints.mp4";
import hintsPoster from "../images/features/feature-hints-poster.webp";
import ideShot from "../images/IDEimage.webp";
import classShot from "../images/features/shot-class.webp";

const TITLE = "Features · Aivex – AI coding IDE and classroom in your browser";
const DESCRIPTION =
  "Explore Aivex: an AI pair programmer that edits your files, instant HTML/CSS/JS preview, Node.js and C/C++ in the browser, real-time collaboration, and a classroom with assignments, code review and AI rules.";

const FAQ = [
  {
    q: "Do I need to install anything?",
    a: "No. Aivex runs entirely in your browser. HTML, CSS and JavaScript preview instantly, Node.js runs in a browser sandbox, and C and C++ compile and run on your device. Java, Python and other languages run on our cloud runner.",
  },
  {
    q: "What can Vex AI do?",
    a: "Vex reads your project, your open file and your selection, then writes or edits the files for you, explains code and fixes bugs. It remembers what your project is about, so you don't repeat yourself. On the free plan you get 3 questions a day.",
  },
  {
    q: "Can I use Aivex to teach a class?",
    a: "Yes. Turn on teaching mode in Settings, create a class and share the join code. Post assignments with starter code, a due date and an AI rule, review each student's submission, give marks and feedback, and open any student's project to help them live.",
  },
  {
    q: "Can students just ask the AI for the answer?",
    a: "Not if you don't want them to. Each assignment has an AI rule: allowed, hints only, or off. In hints-only mode Vex explains and guides but never writes code into the project, and the rule is enforced on our servers, not just hidden in the page.",
  },
  {
    q: "Can I work with my friends or team?",
    a: "Yes. Invite people to a project to edit the same files live, see who is typing, chat in the project and @mention teammates or Vex.",
  },
  {
    q: "Is Aivex free?",
    a: "Yes, Aivex is free to use during the beta, including Vex AI with a daily limit and the classroom features.",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Aivex",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web browser",
      url: "https://aivex.in/",
      description: DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      featureList: [
        "AI pair programmer that edits project files",
        "Instant HTML, CSS and JavaScript preview",
        "Node.js in the browser",
        "C and C++ compiled in the browser with interactive input",
        "Real-time collaborative editing and project chat",
        "Classrooms with assignments, submissions, code review and marks",
        "Per-assignment AI rules: allowed, hints only or off",
      ],
      publisher: { "@type": "Organization", name: "Grawity" },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

const SECTIONS = [
  { id: "ai", label: "Vex AI" },
  { id: "preview", label: "Instant preview" },
  { id: "c-cpp", label: "C & C++" },
  { id: "collaboration", label: "Collaboration" },
  { id: "classroom", label: "Classroom" },
  { id: "ai-rules", label: "AI rules" },
];

/** A browser-window frame around a clip or screenshot. */
const Frame = ({ children, tall = false }: { children: ReactNode; tall?: boolean }) => (
  <div className={`relative ${tall ? "mx-auto w-full max-w-[300px]" : "w-full"}`}>
    <div className="absolute -inset-px rounded-2xl bg-linear-to-b from-teal-400/30 to-transparent opacity-60 blur-sm" aria-hidden />
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl shadow-teal-950/40">
      <div className="flex items-center gap-1.5 border-b border-white/5 bg-zinc-900/80 px-3 py-2" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
      </div>
      <div className={tall ? "aspect-9/16" : "aspect-video"}>{children}</div>
    </div>
  </div>
);

const Clip = ({ src, poster, label, tall }: { src: string; poster: string; label: string; tall?: boolean }) => (
  <Frame tall={tall}>
    <LazyVideo src={src} poster={poster} label={label} className="h-full w-full object-cover object-top" />
  </Frame>
);

const Shot = ({ src, alt }: { src: string; alt: string }) => (
  <Frame>
    <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover object-top" />
  </Frame>
);

const FeatureSection = ({ id, eyebrow, icon, title, body, points, media, flip = false }: {
  id: string;
  eyebrow: string;
  icon: ReactNode;
  title: string;
  body: string;
  points: string[];
  media: ReactNode;
  flip?: boolean;
}) => (
  <section id={id} className="scroll-mt-28 border-t border-white/5 py-20 md:py-28" aria-labelledby={`${id}-title`}>
    <div className={`mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2 lg:gap-16 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}>
      <div>
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-300">
          {icon} {eyebrow}
        </p>
        <h2 id={`${id}-title`} className="text-3xl font-bold leading-tight text-white md:text-4xl">{title}</h2>
        <p className="mt-4 text-lg leading-relaxed text-zinc-400">{body}</p>
        <ul className="mt-8 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex gap-3 text-zinc-300">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-teal-300">
                <Check size={13} strokeWidth={3} />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div>{media}</div>
    </div>
  </section>
);

const MORE = [
  { icon: FolderTree, title: "A real file system", text: "Folders, multiple files and tabs, with quick open on Ctrl+P." },
  { icon: Download, title: "Download as ZIP", text: "Take your whole project with you in one click." },
  { icon: Search, title: "Smart chat context", text: "Vex sees the file you have open and the code you selected." },
  { icon: Bell, title: "Notifications", text: "Invites, mentions, assignments and reviews, live in the bell." },
  { icon: KeyRound, title: "Google & GitHub sign-in", text: "One click to sign in, or use email with a verification code." },
  { icon: Smartphone, title: "Works on your phone", text: "Chat, files and code have their own tabs on small screens." },
  { icon: ShieldCheck, title: "Safe by design", text: "Spam filters, rate limits, reports and moderation built in." },
  { icon: Sparkles, title: "Improve my prompt", text: "Turn a rough idea into a precise request for Vex." },
];

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
      {/* Kept in the page when closed so search engines read every answer */}
      <p className={`pb-5 leading-relaxed text-zinc-400 ${open ? "" : "hidden"}`}>{a}</p>
    </div>
  );
};

const Features = () => {
  const { user } = useUser();
  usePageMeta({ title: TITLE, description: DESCRIPTION, path: "/features", jsonLd: JSON_LD });
  const cta = user ? { to: "/dashboard", label: "Open dashboard" } : { to: "/register", label: "Start coding free" };

  return (
    <div className="min-h-dvh overflow-x-hidden bg-black text-zinc-100">
      {/* Hero */}
      <header className="relative px-6 pb-16 pt-32 md:pb-24 md:pt-44">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute left-1/2 top-0 h-[700px] w-[1100px] -translate-x-1/2 rounded-full bg-teal-500/10 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-teal-400">Features</p>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-6xl">
            Code, learn and teach,
            <br />
            <span className="bg-linear-to-r from-teal-300 to-emerald-400 bg-clip-text text-transparent">all in one browser tab.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
            Aivex is an online IDE with an AI pair programmer, live collaboration and a classroom built in.
            Nothing to install: open it, write code and ship.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={cta.to}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 font-semibold text-black transition hover:bg-zinc-200 sm:w-auto"
            >
              {cta.label} <ArrowRight size={18} />
            </Link>
            <a
              href="#ai"
              className="inline-flex w-full items-center justify-center rounded-full border border-white/10 px-7 py-3.5 font-medium text-zinc-200 transition hover:border-white/25 sm:w-auto"
            >
              See it in action
            </a>
          </div>
          <nav aria-label="Feature sections" className="mt-12 flex flex-wrap justify-center gap-2">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-full border border-white/10 bg-zinc-950 px-3.5 py-1.5 text-sm text-zinc-400 transition hover:border-teal-500/40 hover:text-white"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <FeatureSection
          id="ai"
          eyebrow="Vex AI"
          icon={<MessageSquare size={13} />}
          title="An AI pair programmer that actually edits your code"
          body="Ask @Vex in the project chat. It reads your project, writes the change across files, saves it and shows it in the preview, so you go from idea to working feature in seconds."
          points={[
            "Edits, creates and deletes files for you, with one-click re-apply from chat history",
            "Knows the file you have open and the lines you selected",
            "Remembers your project's purpose and decisions between sessions",
            "Explains code and errors in plain language",
          ]}
          media={<Clip src={livedemo} poster={livedemoPoster} label="Vex AI adding a dark mode toggle to a website, shown live in the preview" />}
        />

        <FeatureSection
          id="preview"
          flip
          eyebrow="Instant preview"
          icon={<Zap size={13} />}
          title="See your website as you type"
          body="Plain HTML, CSS and JavaScript sites render in a fraction of a second, right next to your code. Full-stack Node.js apps run in a browser sandbox with a preview you can open in a new tab."
          points={[
            "Live preview that follows every keystroke",
            "Console output and errors in the editor",
            "Express servers and npm packages without a local install",
          ]}
          media={<Shot src={ideShot} alt="Aivex IDE with a portfolio website open in the live preview" />}
        />

        <FeatureSection
          id="c-cpp"
          eyebrow="C & C++"
          icon={<Cpu size={13} />}
          title="C and C++ that compile in your browser"
          body="Your code compiles on your own device, so runs start almost instantly and keep working on a slow connection. Programs can ask for input, just like in a terminal."
          points={[
            "Interactive input with scanf and cin",
            "Compile time and run time shown after every run",
            "Java, Python and more run on the cloud runner",
          ]}
          media={<Clip src={cRun} poster={cRunPoster} label="A C program compiling in the browser and reading keyboard input" />}
        />

        <FeatureSection
          id="collaboration"
          flip
          eyebrow="Collaboration"
          icon={<Users size={13} />}
          title="Build together, in real time"
          body="Invite friends or teammates to a project. Edit the same files live, talk in the project chat, @mention people and Vex, and get notified when something needs you."
          points={[
            "Live editing with everyone's cursors",
            "Project chat with mentions and typing indicators",
            "Invites, member management and ownership transfer",
            "A phone layout with chat, files and code tabs",
          ]}
          media={<Clip tall src={chatDemo} poster={chatDemoPoster} label="Team chat on a phone with a teammate and Vex AI" />}
        />

        <FeatureSection
          id="classroom"
          eyebrow="Aivex Classroom"
          icon={<GraduationCap size={13} />}
          title="Teach coding inside the same IDE"
          body="Turn on teaching mode, create a class and share a 6-letter code. Every student gets their own copy of the starter code, and you see who is online, who submitted and who needs help."
          points={[
            "Assignments with instructions, starter code, due dates and marks",
            "Submissions are frozen snapshots, with every version kept",
            "Review code, give feedback and marks, or request changes",
            "Students ask for help and you jump into their project live",
          ]}
          media={<Clip src={classroomClip} poster={classroomPoster} label="A teacher reviewing a student's submission and giving marks" />}
        />

        <FeatureSection
          id="ai-rules"
          flip
          eyebrow="AI rules for classes"
          icon={<Lightbulb size={13} />}
          title="AI that helps students learn, not copy"
          body="Choose how much Vex can help on each assignment. In hints-only mode it explains concepts and points to the next step, but never writes the solution into the project."
          points={[
            "Three rules per assignment: allowed, hints only, or off",
            "Enforced on our servers, not just hidden in the page",
            "Teachers can always use Vex themselves",
          ]}
          media={<Clip src={hintsClip} poster={hintsPoster} label="Vex giving step-by-step hints on a hints-only assignment" />}
        />

        {/* More */}
        <section className="border-t border-white/5 bg-zinc-950/60 py-20 md:py-28" aria-labelledby="more-title">
          <div className="mx-auto max-w-7xl px-6">
            <h2 id="more-title" className="max-w-2xl text-3xl font-bold text-white md:text-4xl">And everything else you'd expect</h2>
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
              {MORE.map(({ icon: Icon, title, text }) => (
                <div key={title} className="bg-black p-6">
                  <Icon size={20} className="text-teal-300" />
                  <h3 className="mt-4 font-semibold text-white">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Teacher overview */}
        <section className="border-t border-white/5 py-20 md:py-28" aria-labelledby="overview-title">
          <div className="mx-auto max-w-5xl px-6 text-center">
            <h2 id="overview-title" className="text-3xl font-bold text-white md:text-4xl">Your whole class at a glance</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
              Students who need help, submissions waiting for review and every assignment's progress, on one page.
            </p>
            <div className="mt-12">
              <Shot src={classShot} alt="Teacher's class page with help requests, assignments and submissions to review" />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-white/5 py-20 md:py-28" aria-labelledby="faq-title">
          <div className="mx-auto max-w-3xl px-6">
            <h2 id="faq-title" className="text-3xl font-bold text-white md:text-4xl">Questions, answered</h2>
            <div className="mt-8">
              {FAQ.map((f) => (
                <FaqItem key={f.q} {...f} />
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative border-t border-white/5 py-24">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent to-teal-900/10" aria-hidden />
          <div className="relative mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl font-bold text-white md:text-5xl">Start building in 30 seconds</h2>
            <p className="mt-4 text-lg text-zinc-400">Free during the beta. No credit card, no installs.</p>
            <Link
              to={cta.to}
              className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-semibold text-black transition hover:bg-zinc-200"
            >
              {cta.label} <ArrowRight size={20} />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Features;
