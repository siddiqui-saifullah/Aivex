import { useContext, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { UserContext } from "../context/user.context";
import Loader from "../components/ui/Loader";

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const context = useContext(UserContext);
  const location = useLocation();

  if (!context) {
    throw new Error("ProtectedRoute must be used inside UserProvider");
  }

  const { user, loading } = context;

  if (loading) {
    return <div><Loader /></div>; 
  }

  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return children;
};

export default ProtectedRoute;
