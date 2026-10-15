import { useState, type FormEvent, type ReactNode } from "react";
import { AtSign, KeyRound, Lock, Trash2, User as UserIcon } from "lucide-react";
import InputField from "../ui/InputField";
import Button from "../ui/Button";
import {
  changePassword,
  deleteAccount,
  updateProfile,
} from "../../services/user.service";
import { getErrorMessage } from "../../utils/getErrorMessage";
import type { User } from "../../types";

/* -------------------------------------------------------------------------- */
/* SHARED SHELL                                                               */
/* -------------------------------------------------------------------------- */

interface ModalShellProps {
  title: string;
  description: string;
  icon: ReactNode;
  tone?: "default" | "danger";
  onClose: () => void;
  children: ReactNode;
}

const ModalShell = ({
  title,
  description,
  icon,
  tone = "default",
  onClose,
  children,
}: ModalShellProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    />
    <div
      className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl p-6"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex items-start gap-4 mb-6">
        <div
          className={`shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
            tone === "danger" ? "bg-red-500/10 text-red-500" : "bg-teal-500/10 text-teal-500"
          }`}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="text-sm text-zinc-400 mt-1">{description}</p>
        </div>
      </div>
      {children}
    </div>
  </div>
);

const FieldLabel = ({ children }: { children: ReactNode }) => (
  <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
    {children}
  </label>
);

const ErrorText = ({ error }: { error: string }) =>
  error ? <p className="text-sm text-red-500">{error}</p> : null;

/* -------------------------------------------------------------------------- */
/* EDIT PROFILE                                                               */
/* -------------------------------------------------------------------------- */

interface EditProfileModalProps {
  user: User;
  onClose: () => void;
  onSaved: (user: User) => void;
}

export const EditProfileModal = ({ user, onClose, onSaved }: EditProfileModalProps) => {
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedUsername = username.trim().toLowerCase();

    if (trimmedName.length < 3 || !/^[A-Za-z ]+$/.test(trimmedName)) {
      setError("Name must be at least 3 characters (letters and spaces only)");
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(trimmedUsername)) {
      setError("Username must be 3–20 characters: lowercase letters, numbers, underscores");
      return;
    }

    // Only send what changed
    const updates: { name?: string; username?: string } = {};
    if (trimmedName !== user.name) updates.name = trimmedName;
    if (trimmedUsername !== user.username) updates.username = trimmedUsername;

    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await updateProfile(updates);
      onSaved(data.user);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update profile"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title="Edit Profile"
      description="Update how others see you."
      icon={<UserIcon size={24} />}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <FieldLabel>Full Name</FieldLabel>
          <InputField
            theme="dark"
            icon={<UserIcon size={18} />}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <FieldLabel>Username</FieldLabel>
          <InputField
            theme="dark"
            icon={<AtSign size={18} />}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <ErrorText error={error} />
        <div className="space-y-3 pt-2">
          <Button variant="primary" loading={loading} className="w-full">
            Save Changes
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="w-full text-zinc-500 hover:text-zinc-300"
          >
            Cancel
          </Button>
        </div>
      </form>
    </ModalShell>
  );
};

/* -------------------------------------------------------------------------- */
/* CHANGE PASSWORD                                                            */
/* -------------------------------------------------------------------------- */

interface ChangePasswordModalProps {
  onClose: () => void;
  onChanged: () => void;
}

export const ChangePasswordModal = ({ onClose, onChanged }: ChangePasswordModalProps) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await changePassword(currentPassword, newPassword);
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to change password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title="Change Password"
      description="Use at least 8 characters."
      icon={<KeyRound size={24} />}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <FieldLabel>Current Password</FieldLabel>
          <InputField
            theme="dark"
            type="password"
            icon={<Lock size={18} />}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </div>
        <div>
          <FieldLabel>New Password</FieldLabel>
          <InputField
            theme="dark"
            type="password"
            icon={<Lock size={18} />}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div>
          <FieldLabel>Confirm New Password</FieldLabel>
          <InputField
            theme="dark"
            type="password"
            icon={<Lock size={18} />}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <ErrorText error={error} />
        <div className="space-y-3 pt-2">
          <Button variant="primary" loading={loading} className="w-full">
            Update Password
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="w-full text-zinc-500 hover:text-zinc-300"
          >
            Cancel
          </Button>
        </div>
      </form>
    </ModalShell>
  );
};

/* -------------------------------------------------------------------------- */
/* DELETE ACCOUNT                                                             */
/* -------------------------------------------------------------------------- */

interface DeleteAccountModalProps {
  onClose: () => void;
  onDeleted: () => void;
}

export const DeleteAccountModal = ({ onClose, onDeleted }: DeleteAccountModalProps) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");
      await deleteAccount(password);
      onDeleted();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete account"));
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title="Delete Account"
      description="This permanently deletes your account."
      icon={<Trash2 size={24} />}
      tone="danger"
      onClose={onClose}
    >
      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-6 text-sm text-red-400 space-y-1">
        <p>Projects you own and their chats will be deleted.</p>
        <p>You will be removed from projects you were invited to.</p>
        <p className="text-red-400/70 text-xs">This action cannot be undone.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <FieldLabel>Confirm with your password</FieldLabel>
          <InputField
            theme="dark"
            type="password"
            icon={<Lock size={18} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </div>
        <ErrorText error={error} />
        <div className="space-y-3 pt-2">
          <Button
            variant="danger"
            loading={loading}
            disabled={!password}
            className="w-full"
          >
            Delete My Account
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="w-full text-zinc-500 hover:text-zinc-300"
          >
            Cancel
          </Button>
        </div>
      </form>
    </ModalShell>
  );
};
