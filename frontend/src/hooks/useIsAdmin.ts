import { useEffect, useState } from "react";
import { checkIsAdmin } from "../services/admin.service";

const KEY = "aivex-is-admin";

/** Whether the signed-in user may see the admin dashboard (cached for the session). */
export const useIsAdmin = (userId: string | undefined) => {
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) === `${userId}:1`;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    checkIsAdmin().then((ok) => {
      if (!alive) return;
      setIsAdmin(ok);
      try {
        sessionStorage.setItem(KEY, `${userId}:${ok ? 1 : 0}`);
      } catch {
        /* storage unavailable */
      }
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  return isAdmin;
};
