import { Route, BrowserRouter, Routes, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import Loader from "../components/ui/Loader";

// Lazy load all page components
const Home = lazy(() => import("../screens/Home"));
const Login = lazy(() => import("../screens/Login"));
const Register = lazy(() => import("../screens/Register"));
const AuthCallback = lazy(() => import("../screens/AuthCallback"));
const Dashboard = lazy(() => import("../screens/Dashboard"));
const Profile = lazy(() => import("../screens/Profile"));
const Project = lazy(() => import("../screens/Project"));
const Classroom = lazy(() => import("../screens/Classroom"));
const Assignment = lazy(() => import("../screens/Assignment"));
const JoinClass = lazy(() => import("../screens/JoinClass"));
const Admin = lazy(() => import("../screens/Admin"));
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
import GuestOnly from "./GuestOnly";
import PageTitle from "./PageTitle";

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <PageTitle />
      <Suspense fallback={<Loader />}>
        <Routes>
          {/* Public */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<GuestOnly><Home /></GuestOnly>} />
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
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
            <Route path="/auth/callback" element={<AuthCallback />} />
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
            <Route path="/classes/:classroomId" element={<Classroom />} />
            <Route path="/classes/:classroomId/assignments/:assignmentId" element={<Assignment />} />
            <Route path="/join" element={<JoinClass />} />
            <Route path="/join/:code" element={<JoinClass />} />
            <Route path="/admin" element={<Admin />} />
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
