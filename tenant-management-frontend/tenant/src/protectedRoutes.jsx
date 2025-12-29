import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { useEffect } from "react";

export default function ProtectedRoutes({ children }) {
    const { user, loading, fetchMe } = useAuth();
    const location = useLocation();
    
    // Check for token in localStorage as an additional security check
    const token = localStorage.getItem("token");
    
    // Re-check authentication when route changes (if we have a token but no user)
    useEffect(() => {
        if (token && !user && !loading) {
            // Try to fetch user if we have a token but no user state
            fetchMe(true);
        }
    }, [location.pathname, token, user, loading, fetchMe]);
    
    // Show loading state while checking authentication
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }
    
    // Redirect to login if no user OR no token
    if (!user || !token) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }
    
    return children;
}