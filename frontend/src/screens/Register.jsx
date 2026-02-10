import { useOutletContext } from "react-router-dom";
import RegisterForm from "../components/RegisterForm";

const Register = () => {
  const { theme } = useOutletContext();

  return (
    <>
      <div className="text-center mb-8">
        <h1
          className={`text-3xl font-bold bg-clip-text text-transparent mb-2 ${
            theme === "dark"
              ? "bg-linear-to-r from-teal-200 via-teal-400 to-emerald-400"
              : "bg-linear-to-r from-indigo-500 to-purple-500"
          }`}
        >
          Create Account
        </h1>
        <p
          className={`text-sm ${
            theme === "dark" ? "text-zinc-400" : "text-slate-500"
          }`}
        >
          Fill in the details below to get started
        </p>
      </div>

      <RegisterForm theme={theme} />
    </>
  );
};

export default Register;
