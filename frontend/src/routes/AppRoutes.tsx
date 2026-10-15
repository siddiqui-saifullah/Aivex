import { Route, BrowserRouter, Routes, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import Loader from "../components/ui/Loader";

// Lazy load all page components
const Home = lazy(() => import("../screens/Home"));
const Login = lazy(() => import("../screens/Login"));
const Register = lazy(() => import("../screens/Register"));
const Dashboard = lazy(() => import("../screens/Dashboard"));
const Profile = lazy(() => import("../screens/Profile"));
const Project = lazy(() => import("../screens/Project"));
const About = lazy(() => import("../screens/About"));
const Privacy = lazy(() => import("../screens/Privacy"));
const Terms = lazy(() => import("../screens/Terms"));
const Contact = lazy(() => import("../screens/Contact"));
const DocsLayout = lazy(() => import("../modules/docs/DocsLayout"));
const NotFound = lazy(() => import("../screens/NotFound"));

// Lazy load layouts
const AuthLayout = lazy(() => import("../layouts/AuthLayout"));
const AppLayout = lazy(() => import("../layouts/AppLayout"));
const PublicLayout = lazy(() => import("../layouts/PublicLayout"));

import ProtectedRoute from "./ProtectedRoute";

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loader />}>
        <Routes>
          {/* Public */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/contact" element={<Contact />} />
            <Route
              path="/docs"
              element={<Navigate to="/docs/introduction" replace />}
            />
            <Route path="/docs/:slug" element={<DocsLayout />} />
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

          <Route element={<PublicLayout />}>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default AppRoutes;
