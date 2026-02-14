import { Route, BrowserRouter, Routes } from "react-router-dom";
import Home from "../screens/Home";
import Login from "../screens/Login";
import Register from "../screens/Register";
import Dashboard from "../screens/Dashboard";
import Profile from "../screens/Profile";

import AuthLayout from "../layouts/AuthLayout";
import AppLayout from "../layouts/AppLayout";
import ProtectedRoute from "./ProtectedRoute";
import Project from "../screens/Project";
import About from "../screens/About";
import PublicLayout from "../layouts/PublicLayout";

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
        </Route>

        {/* Auth */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Protected App */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects/:projectId" element={<Project />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
