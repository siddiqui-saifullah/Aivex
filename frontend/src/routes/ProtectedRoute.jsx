import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { UserContext } from "../context/user.context";
import Loader from "../components/ui/Loader";

const ProtectedRoute = ({ children }) => {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error("ProtectedRoute must be used inside UserProvider");
  }

  const { user, loading } = context;

  if (loading) {
    return <div><Loader /></div>; 
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
