import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { loginUser } from "../services/user.service";
import { getErrorMessage } from "../utils/getErrorMessage";
import InputField from "./ui/InputField";
import Button from "./ui/Button";
import { useUser } from "../context/user.context";
import { useToast } from "../context/toast.context";
import OAuthButtons from "./OAuthButtons";
import { safeNextPath } from "../utils/safeNextPath";

const LoginForm = ({ theme }: { theme: "dark" | "light" }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Back to where the user was going (e.g. a class invite link); same-site paths only
  const next = params.get("next");
  const target = safeNextPath(next);
  const { setUser } = useUser();
  const { success, error } = useToast();

  // submithandeler
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await loginUser(email, password);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
      success("Login successful!");
      navigate(target, { replace: true });
    } catch (err) {
      error(getErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <OAuthButtons theme={theme} next={target} />

      <InputField
        theme={theme}
        icon={<Mail size={20} />}
        type="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <div className="space-y-1">
        <div className="relative">
          <InputField
            theme={theme}
            icon={<Lock size={20} />}
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
                  theme === "dark"
                    ? "text-zinc-500 hover:text-teal-400"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
        </div>
        <div className="flex justify-end">
          {/* No email service yet: resets are handled by support */}
          <Link
            to="/contact"
            title="Contact support to reset your password"
            className={`text-xs font-medium transition-colors ${
              theme === "dark"
                ? "text-teal-400 hover:text-teal-300"
                : "text-indigo-500 hover:text-indigo-400"
            }`}
          >
            Forgot password?
          </Link>
        </div>
      </div>

      <Button variant="primary" loading={loading} className="w-full">
        Sign In
      </Button>

      <p
        className={`text-center text-sm ${theme === "dark" ? "text-zinc-500" : "text-slate-600"}`}
      >
        Don't have an account?{" "}
        <span
          className={`font-semibold cursor-pointer transition-colors ${
            theme === "dark"
              ? "text-teal-400 hover:text-teal-300"
              : "text-indigo-500 hover:text-indigo-400"
          }`}
        >
          <Link to={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}>Register</Link>
        </span>
      </p>
    </form>
  );
};

export default LoginForm;
