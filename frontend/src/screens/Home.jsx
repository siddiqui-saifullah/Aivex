import { useEffect } from "react";
import { MessageSquare, Layout, ArrowRight, Play, Folder } from "lucide-react";
import { Link } from "react-router-dom";
import axios from "../config/axios";
import { StatBox, FeatureCard } from "../components/ui";
import IDEImage from "../images/IDEimage.webp";
import livedemo from "../images/livedemo.mp4";
import ChatDemo from "../images/ChatDemo.mp4";

const Home = () => {
  useEffect(() => {
    const awaikBackend = async () => {
      try {
        const result = await axios.get("/"); // To Wake render cooldown
        console.log(result.data.message);
      } catch (err) {
        console.log(err);
      }
    };

    awaikBackend();
  }, []);

  return (
    <div className="min-h-screen bg-black text-zinc-100 selection:bg-teal-500/30 font-sans overflow-x-hidden">
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
            Chat with Aivex to generate Express servers, debug errors, and
            manage files. All running in a secure, browser-based Node.js
            environment.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mb-20">
            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-4 bg-linear-to-r from-teal-500 to-emerald-600 text-white rounded-full font-bold text-lg hover:shadow-[0_0_30px_-5px_rgba(20,184,166,0.4)] transition-all hover:scale-105 flex items-center justify-center gap-2 border border-white/10"
            >
              Start Coding Now
              <ArrowRight size={20} />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-4 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-full font-medium hover:bg-zinc-800 hover:text-white transition-all flex items-center justify-center"
            >
              Log In
            </Link>
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
      <section className="py-24 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<MessageSquare size={24} className="text-white" />}
              title="AI Chat & Generate"
              desc="Ask @Aivex to scaffold projects, write functions, or explain code. Context-aware and integrated directly into the editor."
            />
            <FeatureCard
              icon={<Layout size={24} className="text-white" />}
              title="Live Browser Preview"
              desc="No localhost tunneling needed. Your server runs in the browser and exposes a preview URL instantly."
            />
            <FeatureCard
              icon={<Folder size={24} className="text-white" />}
              title="Full File System"
              desc="Not just a snippet runner. A complete file system with folders, static assets, and Node.js module support."
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
            <video
              src={livedemo}
              autoPlay
              muted
              loop
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
              Whether you are building a simple API or a complex React
              dashboard, Aivex provides the tools you need without the setup
              fatigue.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <StatBox number="Node.js" label="Runtime" />
              <StatBox number="WebContainer" label="Technology" />
            </div>
          </div>

          {/* --- VIDEO PLACEHOLDER #2 (Chat Workflow) --- */}
          <div className="flex-1 w-full max-w-sm">
            <div className="relative rounded-xl border border-white/10 bg-black shadow-2xl overflow-hidden aspect-9/16 group">
              <video
                src={ChatDemo}
                autoPlay
                muted
                loop
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
            to="/register"
            className="inline-flex items-center gap-2 px-10 py-5 bg-white text-black rounded-full font-bold text-xl hover:scale-105 transition-transform shadow-2xl shadow-white/20"
          >
            Start Building Free
            <ArrowRight size={20} />
          </Link>
          <p className="mt-6 text-zinc-500 text-sm">No credit card required</p>
        </div>
      </section>
    </div>
  );
};
export default Home;
