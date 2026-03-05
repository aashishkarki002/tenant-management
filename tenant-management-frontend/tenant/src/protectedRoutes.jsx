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

  if (!user) {
    console.warn("[ProtectedRoutes] Redirecting to login — user is null. Path:", location.pathname);
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export function GuestRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingFallback />;

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

/**
 * RoleRoute — restricts a route to specific roles.
 *
 * Industry standard: Frontend guards are UX-only.
 * The backend `authorize` middleware is the real security boundary.
 *
 * Usage:
 *   <RoleRoute allowedRoles={["admin", "super_admin"]}>
 *     <AccountingPage />
 *   </RoleRoute>
 *
 * Staff hitting an admin-only route gets redirected to "/" (their dashboard).
 */
export function RoleRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingFallback />;

  // Not logged in — let ProtectedRoutes handle the /login redirect
  if (!user) return <Navigate to="/login" replace />;

  if (!allowedRoles.includes(user.role)) {
    console.warn(
      `[RoleRoute] Access denied — role "${user.role}" not in [${allowedRoles}]. Redirecting to /.`
    );
    return <Navigate to="/" replace />;
  }

  return children;
}