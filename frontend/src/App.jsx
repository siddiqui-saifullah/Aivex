import AppRoutes from "./routes/AppRoutes"
import { UserProvider } from "./context/user.context"
import { ThemeProvider } from "./context/ThemeContext"
import { ToastProvider } from "./context/toast.context"
import ErrorBoundary from "./components/shared/ErrorBoundary"
import ToastContainer from "./components/ToastContainer"

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <UserProvider>
          <ToastProvider>
            <AppRoutes />
            <ToastContainer />
          </ToastProvider>
        </UserProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App;
