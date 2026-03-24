// middleware/protect.js
import { verifyAccessToken } from "../utils/jwt.js";

/**
 * protect — access token guard for all protected routes.
 *
 * Token resolution order (industry standard):
 *   1. Authorization: Bearer <token>   → API clients / Postman
 *   2. req.cookies.accessToken          → Browser (httpOnly cookie)
 *
 * On success  → attaches req.admin = { id, role } and calls next()
 * On failure  → 401 (never 403 — identity is unknown at this stage)
 */
export const protect = (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - No token provided",
      });
    }

    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Invalid or expired access token",
      });
    }

    // Attach minimal identity — never the full DB document.
    // authorize.js reads req.admin.role for RBAC.
    req.admin = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (err) {
    console.error("[protect]", err.message);
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
};

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Extracts the raw JWT string from the request.
 * Kept separate so the resolution logic is easy to unit-test.
 */
function extractToken(req) {
  // 1. Bearer header — preferred for non-browser clients
  const authHeader = req.headers?.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7); // faster than split(" ")[1]
  }

  // 2. httpOnly cookie — preferred for browser clients
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }

  return null;
}
