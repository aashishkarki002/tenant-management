import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { usePushNotifications } from "./hooks/usePushNotification";
import HashLoader from "react-spinners/HashLoader";

function LoadingFallback() {
  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      width: "100%",
    }}>
      <HashLoader color="#FF5733" size={50} />
    </div>
  );
}

export default function ProtectedRoutes({ children }) {

    const { user, loading } = useAuth();
    const location = useLocation();
    usePushNotifications(user);
    if (loading) return <LoadingFallback />;

    // Auth is cookie-based (httpOnly). There is no localStorage token.
    // The only source of truth is the `user` object from AuthContext,
    // which is populated by /api/auth/get-me on mount (using the cookie automatically).
    if (!user) {
        // Preserve the attempted URL so we can redirect back after login
        console.warn("[ProtectedRoutes] Redirecting to login — user is null. Path:", location.pathname);
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
}

export function GuestRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) return <LoadingFallback />;

    // If user is already authenticated (cookie valid, get-me succeeded),
    // send them to dashboard — they don't need to see login/signup.
    if (user) {
        return <Navigate to="/" replace />;
    }

    return children;
}