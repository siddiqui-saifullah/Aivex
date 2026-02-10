import { useEffect, useState, useContext } from "react";
import { ArrowRight } from "lucide-react";
import { UserContext } from "../context/user.context";
import { Link, useNavigate } from "react-router-dom";

const PublicHeader = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 border-b ${
        isScrolled
          ? "bg-black/80 backdrop-blur-xl border-white/10 py-4 shadow-2xl shadow-black/50"
          : "bg-transparent border-transparent py-6"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <img src="/aivex.svg" alt="Aivex" className="w-8 h-8" />
          <span className="font-bold text-xl tracking-tight text-white">
            Aivex
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
          <a
            href="/#features"
            className="hover:text-white transition-colors hover:bg-white/5 px-3 py-1.5 rounded-full"
          >
            Features
          </a>
          <a
            href="/#how-it-works"
            className="hover:text-white transition-colors hover:bg-white/5 px-3 py-1.5 rounded-full"
          >
            How it Works
          </a>
          <a
            href="#"
            className="hover:text-white transition-colors hover:bg-white/5 px-3 py-1.5 rounded-full"
          >
            Docs
          </a>
        </div>

        {/* Right actions (auth-aware) */}
        <div className="flex items-center gap-4">
          {!user ? (
            <>
              <Link
                to="/login"
                className="hidden md:block text-sm font-medium text-zinc-300 hover:text-white transition-colors px-4 py-2"
              >
                Login
              </Link>

              <Link to="/register">
                <button className="bg-linear-to-r from-teal-500 to-emerald-500 text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-teal-500/20 hover:shadow-teal-500/40 hover:scale-105 transition-all duration-300">
                  Get Started
                </button>
              </Link>
            </>
          ) : (
            <Link to="/dashboard">
              <button className="bg-zinc-900 border border-white/10 hover:border-teal-500/50 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-zinc-800 transition-all flex items-center gap-2 group">
                Go to Dashboard
                <ArrowRight
                  size={16}
                  className="text-teal-400 group-hover:translate-x-1 transition-transform"
                />
              </button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default PublicHeader;
