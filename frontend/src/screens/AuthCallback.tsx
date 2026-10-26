import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { exchangeOAuthCode } from "../services/user.service";
import { getErrorMessage } from "../utils/getErrorMessage";
import { useUser } from "../context/user.context";
import { useToast } from "../context/toast.context";

/** Where Google/GitHub sign-in lands: trade the one-time code for a session. */
const AuthCallback = () => {
  const { theme } = useOutletContext<{ theme: "dark" | "light" }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useUser();
  const { success } = useToast();
  const [failure, setFailure] = useState<string | null>(params.get("error"));
  const started = useRef(false);

  useEffect(() => {
    const code = params.get("code");
    if (!code || started.current) return;
    started.current = true; // the code works once (StrictMode runs effects twice)
    const next = params.get("next") ?? "";
    const target = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    exchangeOAuthCode(code)
      .then((data) => {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);
        success(`Welcome, ${data.user.name}!`);
        navigate(target, { replace: true });
      })
      .catch((err) => setFailure(getErrorMessage(err, "Sign-in failed")));
  }, [params, navigate, setUser, success]);

  const muted = theme === "dark" ? "text-zinc-400" : "text-slate-500";
  const message = failure ?? (params.get("code") ? null : "Sign-in failed");

  return (
    <div className="space-y-4 text-center">
      {message ? (
        <>
          <h1 className="text-2xl font-bold text-red-400">Couldn't sign you in</h1>
          <p className={`text-sm ${muted}`}>{message}</p>
          <Link
            to="/login"
            className={`inline-block font-semibold ${theme === "dark" ? "text-teal-400 hover:text-teal-300" : "text-indigo-500 hover:text-indigo-400"}`}
          >
            Back to sign in
          </Link>
        </>
      ) : (
        <p className={`text-sm ${muted}`}>Signing you in…</p>
      )}
    </div>
  );
};

export default AuthCallback;
