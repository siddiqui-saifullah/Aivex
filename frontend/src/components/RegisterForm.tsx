import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Mail, Lock, User, AtSign } from "lucide-react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { registerUser } from "../services/user.service";
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

  const { setUser } = useUser();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const { success, error } = useToast();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await registerUser({ name, username, email, password });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
      success("Account created successfully!");
      navigate(target, { replace: true });
    } catch (err) {
      error(getErrorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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

      <Button variant="primary" loading={loading} className="w-full">
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
