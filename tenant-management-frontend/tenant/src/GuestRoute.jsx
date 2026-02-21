import { Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

/**
 * Wraps login/signup pages. Redirects to dashboard if user is already logged in.
 * Auth is cookie-based — no localStorage token check needed or valid.
 */
export default function GuestRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}