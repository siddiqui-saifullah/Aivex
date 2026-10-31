import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Mail, Lock, User, AtSign, KeyRound } from "lucide-react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { registerUser, resendSignupCode, verifySignup, type AuthResponse } from "../services/user.service";
import OAuthButtons from "./OAuthButtons";
import { safeNextPath } from "../utils/safeNextPath";
import { getErrorMessage } from "../utils/getErrorMessage";
import InputField from "./ui/InputField";
import Button from "./ui/Button";
import { useUser } from "../context/user.context";
import { useToast } from "../context/toast.context";

const RegisterForm = ({ theme }: { theme: "dark" | "light" }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Honeypot: hidden from people, bots fill it in and get rejected
  const [website, setWebsite] = useState("");
  // Step 2: the code emailed to this address
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);

  const { setUser } = useUser();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const target = safeNextPath(next);
  const { success, error } = useToast();

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const signIn = (data: AuthResponse) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    success("Account created successfully!");
    navigate(target, { replace: true });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await registerUser({ name, username, email, password, website });
      if ("verificationRequired" in data) {
        setPendingEmail(data.email);
        setCode("");
        setResendIn(60);
      } else {
        signIn(data);
      }
    } catch (err) {
      error(getErrorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pendingEmail) return;
    setLoading(true);
    try {
      signIn(await verifySignup(pendingEmail, code.trim()));
    } catch (err) {
      error(getErrorMessage(err, "Verification failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail || resendIn > 0) return;
    try {
      await resendSignupCode(pendingEmail);
      success("A new code is on its way");
      setResendIn(60);
    } catch (err) {
      error(getErrorMessage(err, "Couldn't send a new code"));
    }
  };

  const link = theme === "dark" ? "text-teal-400 hover:text-teal-300" : "text-indigo-500 hover:text-indigo-400";
  const muted = theme === "dark" ? "text-zinc-400" : "text-slate-600";

  if (pendingEmail) {
    return (
      <form onSubmit={handleVerify} className="space-y-5">
        <p className={`text-center text-sm ${muted}`}>
          We sent a 6-digit code to <span className="font-semibold">{pendingEmail}</span>. It expires in 10 minutes
          (check spam too).
        </p>
        <InputField
          theme={theme}
          icon={<KeyRound size={20} />}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code"
          aria-label="Verification code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          autoFocus
          required
        />
        <Button variant="primary" loading={loading} disabled={code.length !== 6} className="w-full">
          Verify and create account
        </Button>
        <div className={`flex items-center justify-between text-sm ${muted}`}>
          <button type="button" onClick={() => setPendingEmail(null)} className={`font-medium ${link}`}>
            Change details
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendIn > 0}
            className={`font-medium disabled:opacity-60 ${resendIn > 0 ? "" : link}`}
          >
            {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <OAuthButtons theme={theme} next={target} />

      {/* Honeypot: off-screen and skipped by keyboards and password managers */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      {/* Name and username side by side where there is room */}
      <div className="grid gap-3 sm:grid-cols-2">
        <InputField
          theme={theme}
          icon={<User size={20} />}
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <InputField
          theme={theme}
          icon={<AtSign size={20} />}
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>

      <InputField
        theme={theme}
        icon={<Mail size={20} />}
        type="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <InputField
        theme={theme}
        icon={<Lock size={20} />}
        type={showPassword ? "text" : "password"}
        placeholder="Create Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        rightElement={
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className={`absolute right-3 top-1/2 -translate-y-1/2 ${
              theme === "dark"
                ? "text-zinc-500 hover:text-teal-400"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        }
      />

      <Button variant="primary" loading={loading} className="w-full !mt-5">
        Create Account
      </Button>

      <p
        className={`text-center text-sm ${theme === "dark" ? "text-zinc-500" : "text-slate-600"}`}
      >
        Already have an account?{" "}
        <Link
          to={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className={`font-semibold ${
            theme === "dark"
              ? "text-teal-400 hover:text-teal-300"
              : "text-indigo-500 hover:text-indigo-400"
          }`}
        >
          Log in
        </Link>
      </p>
    </form>
  );
};

export default RegisterForm;
