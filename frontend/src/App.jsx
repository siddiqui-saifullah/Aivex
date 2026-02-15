import AppRoutes from "./routes/AppRoutes";
import { UserProvider } from "./context/user.context";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/toast.context";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import ToastContainer from "./components/ToastContainer";
import { Analytics } from "@vercel/analytics/react";

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <UserProvider>
          <ToastProvider>
            <AppRoutes />
            <ToastContainer />
            <Analytics />
          </ToastProvider>
        </UserProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
