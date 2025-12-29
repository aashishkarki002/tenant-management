import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import LoginForm from "@/components/login-form";

export default function Login() {
  const { user, loading } = useAuth();
  const token = localStorage.getItem("token");

  // Redirect to home if already logged in
  useEffect(() => {
    if (!loading && user && token) {
      // User is already authenticated, will redirect via return statement
    }
  }, [user, token, loading]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect if already authenticated
  if (user && token) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}