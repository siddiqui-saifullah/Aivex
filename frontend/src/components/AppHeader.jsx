import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Code2,
  LogOut,
  LayoutDashboard,
  User,
  ChevronDown,
  Flag,
} from "lucide-react";
import { useUser } from "../context/user.context";
import { logOut } from "../services/user.service.js";
import ReportIssueModal from "./dashboard/modals/ReportIssueModal";

const AppHeader = () => {
  const { user, setUser } = useUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false); // State for Report Modal
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { projectId } = useParams();

  // Closing dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logOut();
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setUser(null);
    navigate("/login");
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 h-16 bg-black border-b border-white/10">
        <div className="h-full px-6 flex items-center justify-between">
          {/* Left: Brand (Link to Dashboard) */}
          <Link
            to="/"
            className="flex items-center gap-3 select-none hover:opacity-90 transition-opacity"
          >
            <img src="/aivex.svg" alt="Aivex" className="w-8 h-8" />
            <span className="text-lg font-semibold text-white hidden sm:block">
              Aivex
            </span>
          </Link>

          {/* Right: Navigation & Profile */}
          <div className="flex items-center gap-6">
            {/* Protected Route Links */}
            <nav className="hidden md:flex items-center gap-4">
              <Link
                to="/dashboard"
                className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium"
              >
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </Link>
            </nav>

            {/* Actions Group */}
            <div className="flex items-center gap-3">
              {/* Report Issue Button - Always visible or conditionally based on projectId */}
              <button
                onClick={() => setIsReportModalOpen(true)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors group relative"
                title="Report an Issue"
              >
                <Flag size={18} />
                <span className="sr-only">Report Issue</span>
              </button>

              {/* User Profile Dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center gap-3 hover:bg-zinc-900 rounded-full py-1.5 px-2 pr-3 transition-all border border-transparent hover:border-zinc-800"
                >
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300">
                    <User size={16} />
                  </div>

                  <div className="hidden sm:flex flex-col items-start">
                    <span className="text-sm font-medium text-zinc-200 leading-none">
                      {user?.name || "User"}
                    </span>
                  </div>

                  <ChevronDown
                    size={14}
                    className={`text-zinc-500 transition-transform duration-200 ${
                      isMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-zinc-950 border border-zinc-800 shadow-xl shadow-black/50 py-1 animation-in fade-in zoom-in-95 duration-100">
                    {/* User Info Section */}
                    <div
                      onClick={() => {
                        navigate("/profile");
                        setIsMenuOpen(false);
                      }}
                      className="px-4 py-3 border-b border-zinc-800 mb-1 cursor-pointer hover:bg-zinc-900/50 transition-colors"
                    >
                      <p className="text-sm font-medium text-white">
                        {user?.name}
                      </p>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">
                        @{user?.username || ""}
                      </p>
                    </div>

                    {/* Menu Items */}
                    <div className="px-1">
                      <Link
                        to="/dashboard"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors md:hidden"
                      >
                        <LayoutDashboard size={16} />
                        Dashboard
                      </Link>

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <LogOut size={16} />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Render the Report Modal */}
      <ReportIssueModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        projectId={projectId} // Will be undefined on Dashboard, valid inside Project
      />
    </>
  );
};

export default AppHeader;
