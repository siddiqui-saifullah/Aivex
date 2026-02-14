import {
  Mail,
  MessageCircle,
  Send,
  Linkedin,
  Globe,
  Heart,
} from "lucide-react";
import { XIcon, GithubIcon } from "../assets/fileIcons";
import { GoalItem, SocialLink } from "../components/ui";

const Contact = () => {
  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors duration-300 font-sans selection:bg-teal-500/30">
      {/* --- HERO SECTION --- */}
      <section className="relative pt-32 pb-12 px-6 overflow-hidden">
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-element)] border border-[var(--border-color)] text-xs font-medium text-teal-500 mb-6">
            <MessageCircle size={12} className="fill-current" />
            <span>Always Open</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
            Have a question? <br className="hidden md:block" />
            Let's <span className="text-teal-500">start a conversation</span>.
          </h1>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
            Whether you've found a bug, have a feature request, or just want to
            say hi—I'm always listening. As a solo developer, your feedback
            directly shapes the future of Aivex.
          </p>
        </div>
      </section>

      {/* --- CONTACT METHODS --- */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-stretch">
            {/* Direct Contact Info */}
            <div className="flex flex-col justify-center">
              <h2 className="text-3xl font-bold mb-6">Get in touch</h2>
              <div className="space-y-8">
                <GoalItem
                  icon={<Mail size={24} />}
                  title="Email"
                  desc="The best way for long-form thoughts or business inquiries. I check this daily."
                />
                <div className="pl-14">
                  <a
                    href="mailto:mail.grawity@gmail.com"
                    className="text-xl md:text-2xl font-mono text-teal-500 hover:text-teal-400 transition-colors"
                  >
                    mail.grawity@gmail.com
                  </a>
                </div>

                <GoalItem
                  icon={<GithubIcon size={24} />}
                  title="GitHub Issues"
                  desc="Found a technical glitch? Open an issue on GitHub so we can track and fix it together."
                />

                <GoalItem
                  icon={<Globe size={24} />}
                  title="Public Roadmap"
                  desc="Stay updated on what's being built next or suggest your own ideas to the community."
                />
              </div>
            </div>

            {/* Support/Message Card */}
            <div className="bg-linear-to-br from-teal-900/10 to-emerald-900/10 border border-teal-500/20 rounded-3xl p-8 text-center relative overflow-hidden group flex flex-col justify-center">
              <div className="absolute top-0 right-0 p-32 bg-teal-500/20 rounded-full blur-[80px] group-hover:bg-teal-500/30 transition-all" />

              <div className="relative z-10">
                <div className="w-16 h-16 bg-white text-teal-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-teal-500/20">
                  <Send size={28} />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-[var(--text-primary)]">
                  Quick Response
                </h3>
                <p className="text-[var(--text-secondary)] mb-8">
                  I usually respond within 24-48 hours. If you're a developer
                  looking to contribute or a user with a critical issue, mention
                  it in the subject line!
                </p>

                <a
                  href="mailto:mail.grawity@gmail.com"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-teal-500 hover:bg-teal-400 text-black font-bold rounded-full transition-transform hover:scale-105 shadow-lg shadow-teal-500/25 w-full justify-center"
                >
                  <Mail size={20} />
                  Send me an Email
                </a>

                <p className="mt-4 text-xs text-[var(--text-muted)] flex items-center justify-center gap-1">
                  Built with{" "}
                  <Heart size={10} className="text-red-500 fill-current" /> by a
                  student developer.
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
            Find me where the developers hang out
          </p>
          <div className="flex justify-center gap-4">
            <SocialLink
              href="https://x.com/SaifLearns"
              icon={XIcon()}
              label="X"
            />
            <SocialLink
              href="https://github.com/saifullah-siddique/Aivex"
              icon={GithubIcon()}
              label="GitHub"
            />
            <SocialLink
              href="https://linkedin.com/in/siddique-saifullah"
              icon={<Linkedin size={20} />}
              label="LinkedIn"
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
