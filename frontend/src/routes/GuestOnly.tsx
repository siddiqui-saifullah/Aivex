import type { ReactNode } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useUser } from "../context/user.context";
import { safeNextPath } from "../utils/safeNextPath";

/**
 * Pages for signed-out visitors (landing, login, register): a signed-in user
 * goes straight to the dashboard, or to the link they came from (?next=).
 */
const GuestOnly = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const [params] = useSearchParams();
  if (user) return <Navigate to={safeNextPath(params.get("next"))} replace />;
  return children;
};

export default GuestOnly;
