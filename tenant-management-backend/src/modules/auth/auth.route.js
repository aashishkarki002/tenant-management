import { Router } from "express";
import {
  registerUser,
  registerStaff,
  loginUser,
  verifyEmail,
  resendEmailVerification,
  changePassword,
  logoutUser,
  refreshToken,
  getMe,
  updateAdmin,
} from "./auth.controller.js";
import { protect } from "../../middleware/protect.js";

const router = Router();

// Public routes
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/verify-email", verifyEmail);
router.post("/resend-email-verification", resendEmailVerification);
router.post("/refresh-token", refreshToken);

// Protected routes — require a valid access token
// FIX: change-password and logout were using auth.middleware.js (refresh token guard).
// They now correctly use protect (access token guard).
// Using the wrong token type meant the active session was never actually verified.
router.post("/logout", protect, logoutUser);
router.patch("/change-password", protect, changePassword);
router.get("/get-me", protect, getMe);
router.patch("/update-admin", protect, updateAdmin);

// Admin-only routes
router.post("/register-staff", protect, registerStaff);

export default router;
