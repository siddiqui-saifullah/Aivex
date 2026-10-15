import { Outlet } from "react-router-dom";
import PublicHeader from "../components/PublicHeader";
import Footer from "../components/Footer";

const AuthLayout = () => {
  const theme = "dark";

  return (
    <div className="min-h-screen flex flex-col bg-black text-zinc-100 font-sans selection:bg-teal-500/30">
      <PublicHeader />

      <main className="flex-1 flex items-center justify-center relative p-6 pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] animate-pulse-slow" />
          <div className="absolute bottom-[20%] right-[10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] animate-pulse-slow delay-700" />
        </div>

        {/* Auth Card */}
        <div className="w-full max-w-md relative z-10">
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/50">
            <Outlet context={{ theme }} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AuthLayout;
