import { User, Mail, AtSign, Calendar, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { userProfile } from "../services/user.service";
import Button from "../components/ui/Button";
import ProfileSkeleton from "../components/Loders/ProfileSkeleton";
import { logOut } from "../services/user.service";
import { useUser } from "../context/user.context";

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await userProfile();
        setUser(data.user);
      } catch (err) {
        setError("Failed to load user profile");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleLogout = () => {
    logOut();
    // Clear local storage
    localStorage.removeItem("user");
    localStorage.removeItem("token");

    // Update context
    setUser(null);

    // Redirect
    navigate("/login");
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

          {/* Actions (future ready) */}
          {/* <Button variant="secondary" size="sm">
            Edit Profile
          </Button> */}
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
                value: new Date(user.createdAt).toDateString(),
              },
            ]}
          />
        </div>

        {/* Danger Zone (future) */}
        <div className="border border-red-500/20 bg-red-500/5 rounded-2xl p-6">
          <h3 className="text-red-400 font-semibold mb-2">Danger Zone</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Sensitive actions related to your account.
          </p>

          <Button variant="danger" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};

const InfoCard = ({ title, items }) => (
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
