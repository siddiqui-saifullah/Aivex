import { Link, useNavigate } from "react-router-dom";
import { MoveLeft, Home } from "lucide-react";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-black text-white flex items-center justify-center overflow-hidden">
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      {/* Soft Brand Glow */}
      <div className="absolute w-[600px] h-[600px] bg-[#14b8a6]/10 rounded-full blur-[120px] animate-pulse" />

      <div className="relative z-10 text-center max-w-xl px-6 space-y-8">
        {/* 404 Heading */}
        <h1 className="text-8xl md:text-9xl font-bold tracking-tight">404</h1>

        <p className="text-zinc-400 leading-relaxed">
          The requested resource could not be located within the current system.
        </p>

        <div className="text-sm text-zinc-500 font-mono tracking-wide">
          STATUS: PAGE_NOT_FOUND
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all"
          >
            <MoveLeft size={18} />
            Go Back
          </button>

          <Link
            to="/"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#14b8a6] text-black font-semibold hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(20,184,166,0.3)]"
          >
            <Home size={18} />
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
