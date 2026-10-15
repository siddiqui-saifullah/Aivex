import { User, Mail, AtSign, Calendar, Shield, Pencil, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { userProfile } from "../services/user.service";
import Button from "../components/ui/Button";
import ProfileSkeleton from "../components/Loders/ProfileSkeleton";
import { logOut } from "../services/user.service";
import { useUser } from "../context/user.context";
import { useToast } from "../context/toast.context";
import {
  ChangePasswordModal,
  DeleteAccountModal,
  EditProfileModal,
} from "../components/profile/AccountModals";
import type { User as UserType } from "../types";

const Profile = () => {
  const navigate = useNavigate();
  const { setUser: setSessionUser } = useUser();
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState<"edit" | "password" | "delete" | null>(null);
  const toast = useToast();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await userProfile();
        setUser(data.user);
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

    // Redirect
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
    <div className="min-h-screen bg-black text-zinc-100 px-6 py-12">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Profile</h1>
          <p className="text-zinc-400 text-sm">
            Manage your account information and preferences.
          </p>
        </div>

        {/* Profile Card */}
        <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6 flex items-center gap-6">
          {/* Avatar */}
          <div
            className="w-20 h-20 rounded-full bg-linear-to-br from-teal-500 to-emerald-500
            flex items-center justify-center text-black text-2xl font-bold"
          >
            {user.name?.charAt(0)?.toUpperCase()}
          </div>

          {/* Basic Info */}
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white">{user.name}</h2>
            <p className="text-zinc-400 text-sm">@{user.username}</p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Pencil}
              onClick={() => setOpenModal("edit")}
            >
              Edit Profile
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={KeyRound}
              onClick={() => setOpenModal("password")}
            >
              Password
            </Button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Account Info */}
          <InfoCard
            title="Account Information"
            items={[
              { icon: User, label: "Full Name", value: user.name },
              { icon: AtSign, label: "Username", value: user.username },
              { icon: Mail, label: "Email", value: user.email },
            ]}
          />

          {/* Security / Meta */}
          <InfoCard
            title="Account Status"
            items={[
              { icon: Shield, label: "Role", value: "User" },
              {
                icon: Calendar,
                label: "Joined",
                value: user.createdAt ? new Date(user.createdAt).toDateString() : "—",
              },
            ]}
          />
        </div>

        {/* Danger Zone */}
        <div className="border border-red-500/20 bg-red-500/5 rounded-2xl p-6">
          <h3 className="text-red-400 font-semibold mb-2">Danger Zone</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Sensitive actions related to your account.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              Logout
            </Button>
            <Button variant="danger" size="sm" onClick={() => setOpenModal("delete")}>
              Delete Account
            </Button>
          </div>
        </div>
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

interface InfoCardItem {
  icon: LucideIcon;
  label: string;
  value?: string;
}

const InfoCard = ({ title, items }: { title: string; items: InfoCardItem[] }) => (
  <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 space-y-4">
    <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
      {title}
    </h3>

    <div className="space-y-3">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center gap-3 text-sm">
          <Icon size={16} className="text-teal-400" />
          <span className="text-zinc-400 w-24">{label}</span>
          <span className="text-zinc-100 truncate">{value}</span>
        </div>
      ))}
    </div>
  </div>
);

export default Profile;
