import { useState, useSyncExternalStore } from "react";
import { AlertTriangle, X } from "lucide-react";
import { isServerOutdated, onServerOutdatedChange } from "../../config/serverInfo";

const subscribe = (cb: () => void) => {
  const unsubscribe = onServerOutdatedChange(cb);
  return () => {
    unsubscribe();
  };
};

/** Explains why newer features fail when the backend deployment lags behind. */
const ServerOutdatedBanner = () => {
  const outdated = useSyncExternalStore(subscribe, isServerOutdated, () => null);
  const [dismissed, setDismissed] = useState(false);
  if (!outdated || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-60 max-w-sm flex items-start gap-2 rounded-xl px-4 py-3 text-xs bg-zinc-950 text-amber-300 border border-amber-500/30 shadow-xl shadow-black/50"
    >
      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
      <p className="flex-1">
        The server is running an older version, so some features (prompt enhancer,
        deleting messages, code runner) won't work until the backend is redeployed.
      </p>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="text-zinc-500 hover:text-zinc-200"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default ServerOutdatedBanner;
