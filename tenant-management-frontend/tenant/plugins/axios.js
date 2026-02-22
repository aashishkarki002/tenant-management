import axios from "axios";

// Use VITE_API_URL for local dev (e.g. http://localhost:3000)
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const api = axios.create({
  baseURL,
  // FIX: withCredentials sends httpOnly cookies (accessToken + refreshToken)
  // on every request automatically. Do NOT also try to send tokens via
  // Authorization header from localStorage — that was the other half of the
  // broken dual-strategy. Pick one. We pick cookies (more secure: XSS-proof).
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve();
  });
  failedQueue = [];
};

// FIX: Removed the request interceptor that read localStorage("token") and
// injected it as a Bearer header. The backend now reads the httpOnly accessToken
// cookie exclusively via protect.js. Mixing both strategies caused every
// protected request to fail because localStorage was always empty.

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // FIX: Removed the early `if (error.response) return Promise.reject(error)`
    // guard that was here before. That line short-circuited ALL response errors
    // before the 401 check below it could ever run, making the entire refresh
    // token flow dead/unreachable code.

    const isRefreshTokenRequest =
      originalRequest.url?.includes("/refresh-token");
    const isLogoutRequest = originalRequest.url?.includes("/logout");
    const path = window.location.pathname.toLowerCase();
    const isPublicRoute =
      path.startsWith("/login") || path.startsWith("/signup");

    // Attempt token refresh on 401 (access token expired)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isRefreshTokenRequest &&
      !isLogoutRequest &&
      !isPublicRoute
    ) {
      originalRequest._retry = true;

      // If a refresh is already in flight, queue this request and wait.
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        // The refresh endpoint reads the refreshToken httpOnly cookie automatically.
        // withCredentials:true ensures it is sent.
        await api.post("/api/auth/refresh-token");

        // The backend sets a fresh accessToken cookie in the response.
        // No localStorage involved — the cookie will be sent on the retry automatically.
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);

        // Refresh failed (token revoked, expired, or reused) — send to login.
        if (!isPublicRoute) {
          console.warn("[axios] 401 + refresh failed, redirecting to /login. Failed request:", originalRequest.url);
          window.location.href = "/login";
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
