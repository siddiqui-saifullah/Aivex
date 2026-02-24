import { Linkedin, Coffee, Heart, Code, Terminal, Globe } from "lucide-react";
import DevloperImage from "../assets/saifullahsiddiqui.webp";
import { XIcon, GithubIcon } from "../assets/fileIcons";
import { GoalItem, SocialLink } from "../components/ui";

const About = () => {
  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors duration-300 font-sans selection:bg-teal-500/30">
      {/* --- HERO SECTION --- */}
      <section className="relative pt-32 pb-12 px-6 overflow-hidden">
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-element)] border border-[var(--border-color)] text-xs font-medium text-teal-500 mb-6">
            <Heart size={12} className="fill-current" />
            <span>Passion Project</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
            Not a startup. Just a student <br className="hidden md:block" />
            with a <span className="text-teal-500">passion for code</span>.
          </h1>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
            Aivex isn't backed by VC funding or a big team. It's built by one
            person who believes coding tools should be accessible, fast, and
            intelligent.
          </p>
        </div>
      </section>

      {/* --- THE REAL STORY --- */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-8 md:p-12 shadow-xl shadow-teal-900/5">
          <div className="flex flex-col md:flex-row gap-10 items-start">
            {/* Developer Image */}
            <div className="shrink-0 mx-auto md:mx-0">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-[var(--bg-main)] shadow-lg overflow-hidden bg-zinc-800">
                {/* Developer Image */}
                <img
                  src={DevloperImage}
                  alt="Saifullah Siddiqui"
                  className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                />
              </div>
              <div className="text-center mt-4">
                <h3 className="font-bold text-lg">Saifullah Siddiqui</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Developer & Student
                </p>
              </div>
            </div>

            {/* The Honest Truth Text */}
            <div className="flex-1 space-y-6 text-base md:text-lg text-[var(--text-secondary)] leading-relaxed">
              <p>
                <span className="text-[var(--text-primary)] font-semibold">
                  Hi, I'm Saifullah.
                </span>{" "}
                I'm a student, and I built Aivex because I was frustrated with
                how complex setting up coding environments can be.
              </p>
              <p>
                To be completely honest,{" "}
                <strong>this isn't just a "CV project"</strong> that I'll
                abandon after getting a job. I use this tool myself. I love
                building it. My dream is to turn this into a serious platform
                that helps thousands of developers.
              </p>
              <p>
                However, running cloud servers, AI models, and keeping the
                platform fast costs real money. I don't want to clutter this
                with ads, and I want to keep the core features free and
                open-source forever.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- WHY SUPPORT? --- */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">
                Why I need your support
              </h2>
              <div className="space-y-6">
                <GoalItem
                  icon={<Terminal size={24} />}
                  title="Server Costs"
                  desc="Hosting containerized environments is expensive. Your support keeps the servers running 24/7."
                />
                <GoalItem
                  icon={<Code size={24} />}
                  title="Open Source Development"
                  desc="I want to open-source more parts of Aivex so the community can contribute and learn."
                />
                <GoalItem
                  icon={<Heart size={24} />}
                  title="Ad-Free Experience"
                  desc="I refuse to sell user data or put annoying ads on the platform. I rely on community support instead."
                />
              </div>
            </div>

            {/* Donate Card */}
            <div className="bg-linear-to-br from-teal-900/10 to-emerald-900/10 border border-teal-500/20 rounded-3xl p-8 text-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-32 bg-teal-500/20 rounded-full blur-[80px] group-hover:bg-teal-500/30 transition-all" />

              <div className="relative z-10">
                <div className="w-16 h-16 bg-white text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-yellow-500/20 text-2xl">
                  ☕
                </div>
                <h3 className="text-2xl font-bold mb-3 text-[var(--text-primary)]">
                  Buy me a coffee
                </h3>
                <p className="text-[var(--text-secondary)] mb-8">
                  If Aivex has helped you, or if you just believe in what I'm
                  doing, consider buying me a coffee. It helps me stay awake and
                  keep coding!
                </p>

                <a
                  href="#"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-teal-500 hover:bg-teal-400 text-black font-bold rounded-full transition-transform hover:scale-105 shadow-lg shadow-teal-500/25"
                >
                  <Coffee size={20} />
                  Keeps the servers alive
                </a>

                <p className="mt-4 text-xs text-[var(--text-muted)]">
                  Every contribution goes directly into server costs and
                  development.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- SOCIALS --- */}
      <section className="py-12 border-t border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-[var(--text-secondary)] mb-6">
            Follow my journey building Aivex in public
          </p>
          <div className="flex justify-center gap-4">
            <SocialLink
              href="https://saifullahsiddiqui.com"
              icon={<Globe size={20} />}
              label="Website"
            />
            <SocialLink
              href="https://x.com/iamsiddiquisaif"
              icon={XIcon()}
              label="X"
            />
            <SocialLink
              href="https://github.com/siddiqui-saifullah"
              icon={GithubIcon()}
              label="GitHub"
            />
            <SocialLink
              href="https://linkedin.com/in/siddiqui-saifullah"
              icon={<Linkedin size={20} />}
              label="LinkedIn"
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
