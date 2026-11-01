import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BarChart3, CreditCard, GraduationCap, Loader2, LogOut, ShieldCheck, Trash2, UserRound } from "lucide-react";
import BillingTab from "../components/billing/BillingTab";
import GitHubSettingsCard from "../components/github/GitHubSettingsCard";
import Button from "../components/ui/Button";
import { DeleteAccountModal } from "../components/profile/AccountModals";
import {
  changePassword,
  logOut,
  updateProfile,
  userProfile,
  type ProfileStats,
} from "../services/user.service";
import { getAiUsage, type AiUsage } from "../services/ai.service";
import { useUser } from "../context/user.context";
import { useToast } from "../context/toast.context";
import { getErrorMessage } from "../utils/getErrorMessage";
import { colorFor } from "../utils/userColor";
import type { User } from "../types";

type Tab = "profile" | "account" | "teaching" | "usage" | "billing";

const TABS: { id: Tab; label: string; icon: typeof UserRound }[] = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "account", label: "Account", icon: ShieldCheck },
  { id: "teaching", label: "Teaching", icon: GraduationCap },
  { id: "usage", label: "Usage", icon: BarChart3 },
  { id: "billing", label: "Plan & billing", icon: CreditCard },
];

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-teal-500/60 focus:outline-none focus:ring-1 focus:ring-teal-500/40 disabled:text-zinc-500";

/** Plain, quiet primary action (white on dark), as on most settings pages. */
const SaveButton = ({ loading, disabled, children }: { loading?: boolean; disabled?: boolean; children: ReactNode }) => (
  <button
    type="submit"
    disabled={loading || disabled}
    className="inline-flex min-w-16 items-center justify-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
  >
    {loading && <Loader2 size={14} className="animate-spin" />}
    {children}
  </button>
);

const initialsOf = (name?: string) =>
  (name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

/** A settings block: title, description, content, and a footer with a hint and the action. */
const Card = ({ title, description, children, hint, action, danger = false }: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  danger?: boolean;
}) => (
  <section className={`overflow-hidden rounded-xl border bg-zinc-950 ${danger ? "border-red-500/30" : "border-white/10"}`}>
    <div className="p-5 sm:p-6">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
    {(hint || action) && (
      <footer
        className={`flex flex-col gap-3 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${
          danger ? "border-red-500/20 bg-red-500/5" : "border-white/10 bg-zinc-900/40"
        }`}
      >
        <p className="text-xs text-zinc-500">{hint}</p>
        {action && <div className="flex shrink-0 justify-end gap-2">{action}</div>}
      </footer>
    )}
  </section>
);

/** Text field saved on its own, like most SaaS settings pages. */
const FieldCard = ({ title, description, hint, initial, prefix, multiline, maxLength, validate, onSave }: {
  title: string;
  description: string;
  hint: string;
  initial: string;
  prefix?: string;
  multiline?: boolean;
  maxLength: number;
  validate: (value: string) => string | null;
  onSave: (value: string) => Promise<void>;
}) => {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = value.trim() !== initial.trim();

  useEffect(() => setValue(initial), [initial]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validate(value.trim());
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      await onSave(value.trim());
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, `Could not save your ${title.toLowerCase()}`));
    } finally {
      setSaving(false);
    }
  };

  const field = multiline ? (
    <textarea
      value={value}
      rows={3}
      maxLength={maxLength}
      onChange={(e) => {
        setValue(e.target.value);
        setError("");
      }}
      aria-label={title}
      className={`${inputClass} resize-none`}
    />
  ) : (
    <div className="flex max-w-md overflow-hidden rounded-lg border border-white/10 focus-within:border-teal-500/60 focus-within:ring-1 focus-within:ring-teal-500/40">
      {prefix && <span className="flex items-center border-r border-white/10 bg-zinc-900 px-3 text-sm text-zinc-500">{prefix}</span>}
      <input
        value={value}
        maxLength={maxLength}
        onChange={(e) => {
          setValue(e.target.value);
          setError("");
        }}
        aria-label={title}
        className="w-full bg-black px-3 py-2 text-sm text-white focus:outline-none"
      />
    </div>
  );

  return (
    <form onSubmit={submit}>
      <Card
        title={title}
        description={description}
        hint={error ? <span className="text-red-400">{error}</span> : multiline ? `${hint} (${value.trim().length}/${maxLength})` : hint}
        action={
          <SaveButton loading={saving} disabled={!dirty}>
            Save
          </SaveButton>
        }
      >
        {field}
      </Card>
    </form>
  );
};

const Switch = ({ checked, onChange, disabled, label }: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
      checked ? "bg-teal-500" : "bg-zinc-700"
    }`}
  >
    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
  </button>
);

/* -------------------------------------------------------------------------- */
/* TABS                                                                       */
/* -------------------------------------------------------------------------- */
const ProfileTab = ({ user, onSaved }: { user: User; onSaved: (u: User) => void }) => {
  const toast = useToast();
  const save = (field: "name" | "username" | "bio", label: string) => async (value: string) => {
    const { user: updated } = await updateProfile({ [field]: field === "username" ? value.toLowerCase() : value });
    onSaved(updated);
    toast.success(`${label} updated`);
  };

  return (
    <div className="space-y-6">
      <Card
        title="Avatar"
        description="Your avatar shows your initials, in a colour that stays the same everywhere in Aivex."
        hint="Your teammates see it in chats, projects and classes."
      >
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-black"
          style={{ backgroundColor: colorFor(user._id) }}
          aria-hidden
        >
          {initialsOf(user.name)}
        </div>
      </Card>
      <FieldCard
        title="Display name"
        description="Your full name, as teammates and teachers see it."
        hint="3–50 letters and spaces."
        initial={user.name}
        maxLength={50}
        validate={(v) => (v.length < 3 || !/^[A-Za-z ]+$/.test(v) ? "Use at least 3 letters (letters and spaces only)" : null)}
        onSave={save("name", "Name")}
      />
      <FieldCard
        title="Username"
        description="Your unique handle. People use it to invite and @mention you."
        hint="3–20 characters: lowercase letters, numbers and underscores."
        initial={user.username}
        prefix="@"
        maxLength={20}
        validate={(v) => (!/^[a-z0-9_]{3,20}$/.test(v.toLowerCase()) ? "3–20 characters: lowercase letters, numbers and underscores" : null)}
        onSave={save("username", "Username")}
      />
      <FieldCard
        title="Bio"
        description="A line about you and what you build."
        hint="Optional"
        initial={user.bio ?? ""}
        multiline
        maxLength={160}
        validate={(v) => (v.length > 160 ? "Keep it under 160 characters" : null)}
        onSave={save("bio", "Bio")}
      />
    </div>
  );
};

const PasswordCard = ({ hasPassword, onChanged }: { hasPassword: boolean; onChanged: () => void }) => {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setError("Use at least 8 characters");
    if (next !== confirm) return setError("The new passwords don't match");
    setSaving(true);
    try {
      await changePassword(hasPassword ? current : undefined, next);
      toast.success(hasPassword ? "Password updated" : "Password set");
      setCurrent("");
      setNext("");
      setConfirm("");
      setError("");
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Could not change your password"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Card
        title={hasPassword ? "Password" : "Set a password"}
        description={
          hasPassword
            ? "Change the password you use to sign in with your email."
            : "You sign in with Google or GitHub. Set a password to also sign in with your email."
        }
        hint={error ? <span className="text-red-400">{error}</span> : "At least 8 characters."}
        action={
          <SaveButton loading={saving} disabled={!next || !confirm || (hasPassword && !current)}>
            {hasPassword ? "Update password" : "Set password"}
          </SaveButton>
        }
      >
        <div className="grid max-w-md gap-3">
          {hasPassword && (
            <input type="password" autoComplete="current-password" placeholder="Current password" aria-label="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
          )}
          <input type="password" autoComplete="new-password" placeholder="New password" aria-label="New password" value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
          <input type="password" autoComplete="new-password" placeholder="Confirm new password" aria-label="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        </div>
      </Card>
    </form>
  );
};

const AccountTab = ({ user, onPasswordSet }: { user: User; onPasswordSet: () => void }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const { setUser } = useUser();
  const [deleting, setDeleting] = useState(false);

  const signOut = async () => {
    await logOut();
    setUser(null);
    navigate("/login");
  };

  return (
    <div className="space-y-6">
      <Card
        title="Email"
        description="Used to sign in and for account emails such as verification codes."
        hint="To change your email, contact support."
      >
        <input value={user.email ?? ""} disabled aria-label="Email" className={`${inputClass} max-w-md`} />
      </Card>
      <PasswordCard hasPassword={user.hasPassword !== false} onChanged={onPasswordSet} />
      <GitHubSettingsCard />
      <Card
        title="Sign out"
        description="Sign out of Aivex on this device."
        action={
          <Button variant="secondary" size="sm" icon={LogOut} onClick={signOut}>
            Sign out
          </Button>
        }
      />
      <Card
        danger
        title="Delete account"
        description="Permanently delete your account and the projects you own. Projects you were invited to stay with their owners. This can't be undone."
        action={
          <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleting(true)}>
            Delete account
          </Button>
        }
      />
      {deleting && (
        <DeleteAccountModal
          hasPassword={user.hasPassword !== false}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            setUser(null);
            toast.info("Your account has been deleted");
            navigate("/");
          }}
        />
      )}
    </div>
  );
};

const TeachingTab = ({ user, onSaved }: { user: User; onSaved: (u: User) => void }) => {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const enabled = Boolean(user.teachingMode);

  const toggle = async (value: boolean) => {
    setSaving(true);
    try {
      const { user: updated } = await updateProfile({ teachingMode: value });
      onSaved(updated);
      toast.success(value ? "Teaching mode is on" : "Teaching mode is off");
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not change teaching mode"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title="Teaching mode"
        description="Teach with Aivex: create classes, post assignments with starter code and AI rules, and open any student's project to help them live."
        hint={
          enabled ? (
            <>Classes appear on your <Link to="/dashboard" className="text-teal-300 hover:underline">dashboard</Link>.</>
          ) : (
            "Students don't need this: they join with the code or link their teacher shares."
          )
        }
      >
        <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-black px-4 py-3">
          <div>
            <p className="text-sm font-medium text-zinc-100">{enabled ? "On" : "Off"}</p>
            <p className="text-xs text-zinc-500">
              {enabled ? "Create class and assignment tools are shown." : "Your dashboard shows only your projects."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin text-zinc-500" />}
            <Switch checked={enabled} onChange={toggle} disabled={saving} label="Teaching mode" />
          </div>
        </div>
      </Card>
      <Card
        title="Join a class"
        description="Got a code from your teacher? Join their class to get your own copy of the starter code."
        action={
          <Link to="/join" className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-200 hover:border-teal-500/40">
            Join with a code
          </Link>
        }
      />
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-lg border border-white/10 bg-black px-4 py-3">
    <p className="text-xs text-zinc-500">{label}</p>
    <p className="mt-1 text-xl font-semibold tabular-nums text-white">{value}</p>
  </div>
);

const UsageTab = ({ stats }: { stats: ProfileStats | null }) => {
  const [usage, setUsage] = useState<AiUsage | null>(null);

  useEffect(() => {
    getAiUsage().then(setUsage).catch(() => undefined);
  }, []);

  const pct = usage?.limit ? Math.min(100, (usage.used / usage.limit) * 100) : 0;
  const resets = usage ? new Date(usage.resetsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";

  return (
    <div className="space-y-6">
      <Card
        title="Vex AI"
        description="Questions you can ask Vex each day on your plan."
        hint={usage ? (usage.limit == null ? "Your account has no daily limit." : `Resets every day at ${resets}.`) : " "}
        action={usage && usage.limit != null && usage.plan !== "premium" ? (
          <Link to="/settings/billing" className="text-sm font-medium text-teal-300 hover:underline">Get more questions</Link>
        ) : undefined}
      >
        {!usage ? (
          <div className="h-10 animate-pulse rounded-lg bg-zinc-900" />
        ) : usage.limit == null ? (
          <p className="text-sm text-zinc-300">Unlimited</p>
        ) : (
          <div className="max-w-md">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="text-zinc-300">
                <span className="font-semibold tabular-nums text-white">{usage.used}</span> of {usage.limit} used {usage.period === "month" ? "this month" : "today"}
              </span>
              <span className={usage.remaining === 0 ? "text-amber-300" : "text-zinc-500"}>{usage.remaining} left</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-valuenow={usage.used} aria-valuemin={0} aria-valuemax={usage.limit}>
              <div className={`h-full rounded-full ${usage.remaining === 0 ? "bg-amber-400" : "bg-teal-500"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </Card>
      {stats && (
        <Card title="Activity" description="Your work on Aivex so far.">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Projects owned" value={stats.projectsOwned} />
            <Stat label="Projects joined" value={stats.projectsJoined} />
            <Stat label="Collaborators" value={stats.collaborators} />
            <Stat label="Messages sent" value={stats.messagesSent} />
          </div>
        </Card>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* PAGE                                                                       */
/* -------------------------------------------------------------------------- */
const Settings = () => {
  const [params] = useSearchParams();
  const { section } = useParams();
  const navigate = useNavigate();
  const wanted = section ?? params.get("tab");
  const tab = (TABS.some((t) => t.id === wanted) ? wanted : "profile") as Tab;
  const { setUser: setSessionUser } = useUser();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Settings · Aivex";
    userProfile()
      .then((data) => {
        setUser(data.user);
        setStats(data.stats ?? null);
      })
      .catch((err) => setError(getErrorMessage(err, "Could not load your settings")));
  }, []);

  // Keep the header and dashboard in sync with what was saved
  const handleSaved = (updated: User) => {
    setUser((u) => ({ ...u, ...updated }));
    const session = { _id: updated._id, name: updated.name, username: updated.username, teachingMode: Boolean(updated.teachingMode) };
    localStorage.setItem("user", JSON.stringify(session));
    setSessionUser(session);
  };

  return (
    <div className="min-h-dvh bg-black text-zinc-100">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-zinc-400">Manage your profile, account, plan and how you use Aivex.</p>
        </header>

        <div className="flex flex-col gap-6 md:flex-row md:gap-10">
          <nav aria-label="Settings" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:w-48 md:shrink-0 md:overflow-visible md:px-0">
            <ul className="flex gap-1 border-b border-white/10 md:sticky md:top-24 md:flex-col md:border-b-0">
              {TABS.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <button
                    onClick={() => navigate(id === "profile" ? "/settings" : `/settings/${id}`, { replace: true })}
                    aria-current={tab === id ? "page" : undefined}
                    className={`flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-sm transition md:rounded-lg ${
                      tab === id
                        ? "border-b-2 border-teal-400 text-white md:border-b-0 md:bg-white/5"
                        : "border-b-2 border-transparent text-zinc-400 hover:text-zinc-200 md:border-b-0 md:hover:bg-white/[0.03]"
                    }`}
                  >
                    <Icon size={16} className={tab === id ? "text-teal-300" : ""} />
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 flex-1">
            {error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : !user ? (
              <div className="space-y-6">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-40 animate-pulse rounded-xl border border-white/5 bg-zinc-950" />
                ))}
              </div>
            ) : tab === "profile" ? (
              <ProfileTab user={user} onSaved={handleSaved} />
            ) : tab === "account" ? (
              <AccountTab user={user} onPasswordSet={() => setUser({ ...user, hasPassword: true })} />
            ) : tab === "teaching" ? (
              <TeachingTab user={user} onSaved={handleSaved} />
            ) : tab === "billing" ? (
              <BillingTab teachingMode={Boolean(user.teachingMode)} />
            ) : (
              <UsageTab stats={stats} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
