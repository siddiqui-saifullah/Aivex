import { useState, useContext } from "react";
import { Eye, EyeOff, Mail, Lock, User, AtSign } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import axios from "../config/axios";
import InputField from "./ui/InputField";
import Button from "./ui/Button";
import { UserContext } from "../context/user.context";
import { useToast } from "../context/toast.context";

const RegisterForm = ({ theme }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { setUser } = useContext(UserContext);
  const navigate = useNavigate();
  const { success, error } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios
        .post("/users/register", {
          name,
          username,
          email,
          password,
        })
        .then((res) => {
          localStorage.setItem("token", res.data.token);
          localStorage.setItem("user", JSON.stringify(res.data.user));
          setUser(res.data.user);
          success("Account created successfully!");
          navigate("/");
        })
        .catch((err) => {
          error(err.response?.data?.message || "Registration failed");
        });
    } catch (err) {
      error("An error occurred");
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
          to="/login"
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
