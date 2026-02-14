import { useState, useContext } from "react";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import axios from "../config/axios.js";
import InputField from "./ui/InputField.jsx";
import Button from "./ui/Button.jsx";
import { UserContext } from "../context/user.context.jsx";
import { useToast } from "../context/toast.context";

const LoginForm = ({ theme }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();
  const { setUser } = useContext(UserContext);
  const { success, error } = useToast();

  // submithandeler
  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    axios
      .post("/users/login", {
        email,
        password,
      })
      .then((res) => {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        setUser(res.data.user);
        success("Login successful!");
        navigate("/dashboard");
      })
      .catch((err) => {
        error(err.response?.data?.message || "Login failed");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
          <a
            href="#"
            className={`text-xs font-medium transition-colors ${
              theme === "dark"
                ? "text-teal-400 hover:text-teal-300"
                : "text-indigo-500 hover:text-indigo-400"
            }`}
          >
            Forgot password?
          </a>
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
          <Link to="/register">Register</Link>
        </span>
      </p>
    </form>
  );
};

export default LoginForm;
