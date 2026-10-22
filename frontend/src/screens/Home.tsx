import { MessageSquare, Layout, ArrowRight, Folder, Zap, Cpu, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { StatBox, FeatureCard } from "../components/ui";
import IDEImage from "../images/IDEimage.webp";
import livedemo from "../images/livedemo.mp4";
import ChatDemo from "../images/ChatDemo.mp4";
import livedemoPoster from "../images/livedemo-poster.webp";
import ChatDemoPoster from "../images/ChatDemo-poster.webp";
import LazyVideo from "../components/ui/LazyVideo";
import { useUser } from "../context/user.context";

const Home = () => {
  const { user } = useUser();
  // Signed-in visitors go straight back to their work
  const primaryCta = user ? { to: "/dashboard", label: "Open Dashboard" } : { to: "/register", label: "Start Coding Now" };

  return (
    <div className="min-h-dvh bg-black text-zinc-100 selection:bg-teal-500/30 font-sans overflow-x-hidden">
      {/* --- HERO SECTION --- */}
      <section className="relative pt-32 pb-16 md:pt-48 md:pb-32 px-6 border-b border-white/5">
        {/* Background Gradients */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[1200px] h-[1000px] bg-teal-500/10 rounded-full blur-[120px] animate-pulse-slow" />
          <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-purple-500/05 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-7xl mx-auto flex flex-col items-center text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-white/10 text-xs font-medium text-teal-400 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
            </span>
            v1.6 Live Beta
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
            Your Full-Stack IDE <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-teal-400 to-emerald-500">
              with AI Superpowers.
            </span>
          </h1>

          <p className="text-lg text-zinc-400 max-w-2xl mb-12 leading-relaxed">
            Build websites, APIs and apps with an AI pair programmer that edits
            your files and remembers your project. HTML, CSS and JS preview
            instantly, Node.js runs in your browser, and C, C++, Java and Python
            run in the cloud. No setup.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mb-20">
            <Link
              to={primaryCta.to}
              className="w-full sm:w-auto px-8 py-4 bg-linear-to-r from-teal-500 to-emerald-600 text-white rounded-full font-bold text-lg hover:shadow-[0_0_30px_-5px_rgba(20,184,166,0.4)] transition-all hover:scale-105 flex items-center justify-center gap-2 border border-white/10"
            >
              {primaryCta.label}
              <ArrowRight size={20} />
            </Link>
            {!user && (
              <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-4 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-full font-medium hover:bg-zinc-800 hover:text-white transition-all flex items-center justify-center"
              >
                Log In
              </Link>
            )}
          </div>

          {/* --- HERO IDE VISUAL --- */}
          <div className="relative w-full max-w-6xl perspective-1000 group">
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-linear-to-r from-teal-500 to-emerald-600 rounded-xl blur-lg opacity-20 group-hover:opacity-30 transition duration-1000"></div>

            {/* Image Container */}
            <div className="relative rounded-xl border border-white/10 bg-zinc-900 shadow-2xl overflow-hidden">
              <img
                src={IDEImage}
                alt="Aivex IDE Interface"
                className="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity duration-500"
              />

              {/* Optional: Overlay gradient to blend bottom if needed */}
              <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent pointer-events-none" />
            </div>
          </div>
        </div>
      </section>
      {/* --- FEATURES GRID --- */}
      <section id="features" className="py-24 bg-zinc-950 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Everything in one tab</h2>
            <p className="text-zinc-400">Write, run, preview and ship together, from any device.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<MessageSquare size={24} className="text-white" />}
              title="AI that edits your code"
              desc="Ask @Vex to build features, fix bugs or explain code. It sees your open file and selection, saves its changes and remembers your project."
            />
            <FeatureCard
              icon={<Zap size={24} className="text-white" />}
              title="Instant web preview"
              desc="HTML, CSS and JS sites open in a fraction of a second and update as you type, with console output right in the editor."
            />
            <FeatureCard
              icon={<Layout size={24} className="text-white" />}
              title="Node.js in your browser"
              desc="Run Express servers and full-stack apps without installing anything, with a live preview you can open in a new tab."
            />
            <FeatureCard
              icon={<Cpu size={24} className="text-white" />}
              title="C in your browser, and more"
              desc="C and C++ compile and run right in your browser, with interactive input (scanf, cin). Java, Python and more run on the cloud runner."
            />
            <FeatureCard
              icon={<Users size={24} className="text-white" />}
              title="Real-time collaboration"
              desc="Invite teammates, chat in the project, see who is typing and build together on the same files."
            />
            <FeatureCard
              icon={<Folder size={24} className="text-white" />}
              title="A real file system"
              desc="Folders, multiple files, tabs, quick open (Ctrl+P) and one-click ZIP download of your whole project."
            />
          </div>
        </div>
      </section>
      {/* --- VIDEO PLACEHOLDER #1 (Main Demo) --- */}
      <section className="py-12 bg-black border-y border-white/5">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-zinc-400 font-medium">See Aivex in action</h3>
            <span className="text-xs font-mono text-teal-500 bg-teal-500/10 px-2 py-1 rounded">
              LIVE DEMO
            </span>
          </div>

          <div className="relative mx-auto w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-teal-900/10 bg-zinc-900 aspect-video group cursor-pointer">
            <LazyVideo
              src={livedemo}
              poster={livedemoPoster}
              label="Aivex live demo"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* --- WORKFLOW / CHAT SHOWCASE --- */}
      <section className="py-24 bg-zinc-900/30 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-16">
          {/* Text Content */}
          <div className="flex-1 space-y-8 relative z-10">
            <h3 className="text-4xl font-bold leading-tight">
              One environment. <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-teal-400 to-emerald-400">
                Limitless possibilities.
              </span>
            </h3>
            <p className="text-lg text-zinc-400 leading-relaxed">
              From a first HTML page to a full-stack app, Aivex gives you the
              runtime, the AI and the team chat in one place, with nothing to
              install.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <StatBox number="10+" label="Languages" />
              <StatBox number="<1s" label="Web preview" />
              <StatBox number="0" label="Setup steps" />
              <StatBox number="Live" label="Team chat" />
            </div>
          </div>

          {/* --- VIDEO PLACEHOLDER #2 (Chat Workflow) --- */}
          <div className="flex-1 w-full max-w-sm">
            <div className="relative rounded-xl border border-white/10 bg-black shadow-2xl overflow-hidden aspect-9/16 group">
              <LazyVideo
                src={ChatDemo}
                poster={ChatDemoPoster}
                label="Aivex chat workflow demo"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>
      {/* --- FINAL CTA --- */}
      <section className="py-32 relative">
        <div className="absolute inset-0 bg-linear-to-b from-transparent to-teal-900/10 pointer-events-none" />
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Build your next idea today.
          </h2>
          <p className="text-zinc-400 mb-10 text-lg">
            Join the beta and start shipping in under 30 seconds.
          </p>
          <Link
            to={primaryCta.to}
            className="inline-flex items-center gap-2 px-10 py-5 bg-white text-black rounded-full font-bold text-xl hover:scale-105 transition-transform shadow-2xl shadow-white/20"
          >
            {user ? "Open Dashboard" : "Start Building Free"}
            <ArrowRight size={20} />
          </Link>
          <p className="mt-6 text-zinc-500 text-sm">No credit card required</p>
        </div>
      </section>
    </div>
  );
};
export default Home;
