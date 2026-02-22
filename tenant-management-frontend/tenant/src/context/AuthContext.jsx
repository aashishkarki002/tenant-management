import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../../plugins/axios";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (force = false) => {
    // Skip fetch if on login or signup page to prevent redirect loops.
    if (!force) {
      const path = window.location.pathname.toLowerCase();
      if (path.startsWith("/login") || path.startsWith("/signup")) {
        setLoading(false);
        setUser(null);
        return;
      }
    }

    try {
      const response = await api.get("/api/auth/get-me");
      if (response.data.success && response.data.admin) {
        setUser(response.data.admin);
        console.log("[AuthContext] fetchMe succeeded, user set");
      } else {
        console.warn("[AuthContext] fetchMe: success=false or no admin, user=null", response.data);
        setUser(null);
      }
    } catch (error) {
      console.error("[AuthContext] fetchMe failed:", error?.response?.status, error?.message, error);
      if (error.response?.status !== 401) {
        console.error("[AuthContext] Error details:", error);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // FIX: logout now calls the backend to:
  //  1. Revoke the refresh token in the database.
  //  2. Clear the httpOnly cookies server-side (res.clearCookie).
  // Previously it only cleared localStorage which had no meaningful effect
  // because tokens were stored in httpOnly cookies, not localStorage.
  const logout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch (error) {
      // Even if the API call fails (network issue, already logged out),
      // we still clear local state so the UI reflects the logged-out state.
      console.error("Logout API error:", error);
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, fetchMe, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};