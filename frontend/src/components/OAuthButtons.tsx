import { useEffect, useState } from "react";
import { getAuthProviders, oauthStartUrl, type OAuthProvider } from "../services/user.service";

let providersPromise: Promise<Record<OAuthProvider, boolean>> | null = null;

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const LABELS: Record<OAuthProvider, { label: string; icon: () => React.JSX.Element }> = {
  google: { label: "Google", icon: GoogleIcon },
  github: { label: "GitHub", icon: GitHubIcon },
};

/** "Continue with Google / GitHub", for the providers the server has set up. */
const OAuthButtons = ({ theme, next }: { theme: "dark" | "light"; next: string }) => {
  const [providers, setProviders] = useState<OAuthProvider[]>([]);

  useEffect(() => {
    providersPromise ??= getAuthProviders().catch(() => ({ google: false, github: false }));
    let active = true;
    providersPromise.then((p) => {
      if (active) setProviders((Object.keys(p) as OAuthProvider[]).filter((k) => p[k]));
    });
    return () => {
      active = false;
    };
  }, []);

  if (providers.length === 0) return null;

  const muted = theme === "dark" ? "text-zinc-500" : "text-slate-500";
  const line = theme === "dark" ? "bg-zinc-800" : "bg-slate-200";

  return (
    <div className="space-y-3">
      <div className={`grid gap-2 ${providers.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {providers.map((provider) => {
        const { label, icon: Icon } = LABELS[provider];
        return (
          <a
            key={provider}
            href={oauthStartUrl(provider, next)}
            aria-label={`Continue with ${label}`}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
              theme === "dark"
                ? "border-zinc-800 bg-zinc-900/60 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Icon />
            {label}
          </a>
        );
      })}
      </div>
      <div className="flex items-center gap-3">
        <span className={`h-px flex-1 ${line}`} />
        <span className={`text-xs ${muted}`}>or use email</span>
        <span className={`h-px flex-1 ${line}`} />
      </div>
    </div>
  );
};

export default OAuthButtons;
