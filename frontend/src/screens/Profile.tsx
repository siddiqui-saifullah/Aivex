import {
  AtSign,
  Calendar,
  Check,
  Copy,
  Crown,
  FolderGit2,
  KeyRound,
  LogOut,
  Mail,
  MessageSquare,
  Pencil,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  logOut,
  userProfile,
  type ProfileStats,
  type RecentProject,
} from "../services/user.service";
import Button from "../components/ui/Button";
import ProfileSkeleton from "../components/Loders/ProfileSkeleton";
import { useUser } from "../context/user.context";
import { useToast } from "../context/toast.context";
import { useFormatDate } from "../hooks/useFormatDate";
import { STACK_FORMATTER } from "../constants/options";
import { plural } from "../utils/plural";
import {
  ChangePasswordModal,
  DeleteAccountModal,
  EditProfileModal,
} from "../components/profile/AccountModals";
import type { User as UserType } from "../types";

/** Stable avatar gradient per user, so people are recognisable at a glance. */
const AVATAR_GRADIENTS = [
  "from-teal-500 to-emerald-500",
  "from-cyan-500 to-blue-500",
  "from-violet-500 to-fuchsia-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-lime-500 to-green-500",
];
const gradientFor = (seed: string) => {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

const initialsOf = (name?: string) =>
  (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

const StatTile = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) => (
  <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
    <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wider">
      <Icon size={14} className="text-teal-400" />
      {label}
    </div>
    <p className="mt-2 text-2xl font-bold text-white tabular-nums">{value}</p>
  </div>
);

const Profile = () => {
  const navigate = useNavigate();
  const { setUser: setSessionUser } = useUser();
  const toast = useToast();
  const { formatDate } = useFormatDate();

  const [user, setUser] = useState<UserType | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState<"edit" | "password" | "delete" | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await userProfile();
        setUser(data.user);
        setStats(data.stats ?? null);
        setRecentProjects(data.recentProjects ?? []);
      } catch {
        setError("Failed to load user profile");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleLogout = async () => {
    // Revoke the token server-side, then clear local storage
    await logOut();

    // Update the session context (not just this page's state), otherwise
    // protected routes still treat the user as logged in
    setSessionUser(null);
    navigate("/login");
  };

  const handleProfileSaved = (updated: UserType) => {
    setUser(updated);
    // Keep the header / session in sync with the new name and username
    const sessionUser = { _id: updated._id, name: updated.name, username: updated.username };
    localStorage.setItem("user", JSON.stringify(sessionUser));
    setSessionUser(sessionUser);
    setOpenModal(null);
    toast.success("Profile updated");
  };

  const handleAccountDeleted = () => {
    setSessionUser(null);
    toast.info("Your account has been deleted");
    navigate("/");
  };

  const copyUsername = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.username).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-red-400">
        {error}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">
        User not found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 px-4 sm:px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/60">
          <div
            className={`h-24 sm:h-28 bg-linear-to-r ${gradientFor(user._id)} opacity-30`}
            aria-hidden
          />
          <div className="px-5 sm:px-8 pb-6 flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
            <div
              className={`-mt-10 sm:-mt-12 w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-2xl bg-linear-to-br ${gradientFor(user._id)} ring-4 ring-zinc-950 flex items-center justify-center text-black text-2xl sm:text-3xl font-bold`}
            >
              {initialsOf(user.name)}
            </div>

            <div className="flex-1 min-w-0 sm:pt-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">{user.name}</h1>
              <button
                onClick={copyUsername}
                className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200"
                title="Copy username"
              >
                @{user.username}
                {copied ? <Check size={13} className="text-teal-400" /> : <Copy size={13} />}
              </button>
              <p className="mt-2 text-sm text-zinc-300 max-w-xl">
                {user.bio || (
                  <span className="text-zinc-500">
                    No bio yet.{" "}
                    <button onClick={() => setOpenModal("edit")} className="text-teal-400 hover:underline">
                      Add one
                    </button>
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 sm:pt-4">
              <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setOpenModal("edit")}>
                Edit Profile
              </Button>
              <Button variant="outline" size="sm" icon={KeyRound} onClick={() => setOpenModal("password")}>
                Password
              </Button>
            </div>
          </div>
        </section>

        {/* Stats */}
        {stats && (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" aria-label="Activity">
            <StatTile icon={Crown} label="Projects owned" value={stats.projectsOwned} />
            <StatTile icon={FolderGit2} label="Projects joined" value={stats.projectsJoined} />
            <StatTile icon={Users} label="Collaborators" value={stats.collaborators} />
            <StatTile icon={MessageSquare} label="Messages sent" value={stats.messagesSent} />
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent projects */}
          <section className="lg:col-span-2 rounded-2xl border border-white/10 bg-zinc-900/50 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                Recent projects
              </h2>
              <Link to="/dashboard" className="text-xs text-teal-400 hover:underline">
                View all
              </Link>
            </div>

            {recentProjects.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No projects yet.{" "}
                <Link to="/dashboard" className="text-teal-400 hover:underline">
                  Create your first one
                </Link>
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {recentProjects.map((project) => (
                  <li key={project._id}>
                    <Link
                      to={`/projects/${project._id}`}
                      className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-white/5 transition"
                    >
                      <div className="w-9 h-9 shrink-0 rounded-lg bg-black border border-white/10 flex items-center justify-center text-teal-400">
                        <FolderGit2 size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-100 truncate">{project.name}</p>
                        <p className="text-xs text-zinc-500">
                          {project.stack ? `${STACK_FORMATTER[project.stack] ?? project.stack} · ` : ""}
                          {plural(project.usersCount, "member")} · updated {formatDate(project.updatedAt)}
                        </p>
                      </div>
                      {project.isOwner && (
                        <span className="text-[11px] text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-2 py-0.5">
                          Owner
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Account details */}
          <section className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 sm:p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Account</h2>
            <dl className="space-y-3 text-sm">
              {[
                { icon: Mail, label: "Email", value: user.email },
                { icon: AtSign, label: "Username", value: user.username },
                {
                  icon: Calendar,
                  label: "Joined",
                  value: user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—",
                },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon size={16} className="text-teal-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-xs text-zinc-500">{label}</dt>
                    <dd className="text-zinc-100 truncate">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>
        </div>

        {/* Danger Zone */}
        <section className="border border-red-500/20 bg-red-500/5 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-red-400 font-semibold">Danger Zone</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Sign out of this device, or permanently delete your account and the projects you own.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="sm" icon={LogOut} onClick={handleLogout}>
              Logout
            </Button>
            <Button variant="danger" size="sm" icon={Trash2} onClick={() => setOpenModal("delete")}>
              Delete Account
            </Button>
          </div>
        </section>
      </div>

      {openModal === "edit" && (
        <EditProfileModal
          user={user}
          onClose={() => setOpenModal(null)}
          onSaved={handleProfileSaved}
        />
      )}
      {openModal === "password" && (
        <ChangePasswordModal
          onClose={() => setOpenModal(null)}
          onChanged={() => {
            setOpenModal(null);
            toast.success("Password updated");
          }}
        />
      )}
      {openModal === "delete" && (
        <DeleteAccountModal
          onClose={() => setOpenModal(null)}
          onDeleted={handleAccountDeleted}
        />
      )}
    </div>
  );
};

export default Profile;
