import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../../plugins/axios";

const AuthContext = createContext(null);

// How many milliseconds before expiry to fire the proactive refresh.
const REFRESH_AHEAD_MS = 2 * 60 * 1000; // 2 minutes

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Refs so timer/expiry state never causes re-renders.
  const tokenExpiresAtRef = useRef(null);
  const refreshTimerRef = useRef(null);

  // Schedule a silent token refresh REFRESH_AHEAD_MS before the access token expires.
  // Recursive: each successful refresh schedules the next one.
  const scheduleProactiveRefresh = useCallback((expiresAt) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    const delay = expiresAt - Date.now() - REFRESH_AHEAD_MS;
    if (delay <= 0) return; // already near/past expiry — let reactive 401 handle it

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.post("/api/auth/refresh-token");
        const newExpiry = res.data?.accessTokenExpiresAt;
        if (newExpiry) {
          tokenExpiresAtRef.current = newExpiry;
          scheduleProactiveRefresh(newExpiry);
        }
      } catch {
        // Refresh failed — the 401 interceptor in axios will handle it
        // when the next real API call fires.
      }
    }, delay);
  }, []);

  const fetchMe = useCallback(async (force = false) => {
    // Skip fetch on public routes to prevent redirect loops.
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
        const expiresAt = response.data.accessTokenExpiresAt;
        if (expiresAt) {
          tokenExpiresAtRef.current = expiresAt;
          scheduleProactiveRefresh(expiresAt);
        }
        console.log("[AuthContext] fetchMe succeeded, user set");
      } else {
        console.warn("[AuthContext] fetchMe: success=false or no admin, user=null", response.data);
        setUser(null);
      }
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error("[AuthContext] fetchMe failed:", error?.response?.status, error?.message);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [scheduleProactiveRefresh]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // PWA: when the app returns to the foreground (tab visible / window focused),
  // refresh immediately if the access token will expire within REFRESH_AHEAD_MS.
  // This prevents the first post-resume request from hitting a 401.
  useEffect(() => {
    const handleResume = () => {
      if (document.visibilityState !== "visible") return;
      const expiresAt = tokenExpiresAtRef.current;
      if (!expiresAt) return;
      if (expiresAt - Date.now() < REFRESH_AHEAD_MS) {
        api.post("/api/auth/refresh-token")
          .then((res) => {
            const newExpiry = res.data?.accessTokenExpiresAt;
            if (newExpiry) {
              tokenExpiresAtRef.current = newExpiry;
              scheduleProactiveRefresh(newExpiry);
            }
          })
          .catch(() => {
            // Refresh failed — cookies may have been cleared by the OS (iOS PWA).
            // Re-check auth state immediately so the UI reflects logged-out rather
            // than waiting for the next API call to trigger the 401 → /login redirect.
            tokenExpiresAtRef.current = null;
            fetchMe(true);
          });
      }
    };

    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("focus", handleResume);
    return () => {
      document.removeEventListener("visibilitychange", handleResume);
      window.removeEventListener("focus", handleResume);
    };
  }, [scheduleProactiveRefresh, fetchMe]);

  // Cancel the scheduled refresh on unmount.
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const logout = async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    tokenExpiresAtRef.current = null;
    try {
      await api.post("/api/auth/logout");
    } catch (error) {
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
