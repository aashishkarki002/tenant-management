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
  updateProfilePicture,
  removeProfilePicture,
  forgotPassword,
  verifyResetCode,
  resetPassword,
} from "./auth.controller.js";
import { protect } from "../../middleware/protect.js";
import upload from "../../middleware/upload.js";

const router = Router();

// Public routes
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/verify-email", verifyEmail);
router.post("/resend-email-verification", resendEmailVerification);
router.post("/refresh-token", refreshToken);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-code", verifyResetCode);
router.post("/reset-password", resetPassword);

// Protected routes
router.post("/logout", protect, logoutUser);
router.patch("/change-password", protect, changePassword);
router.get("/get-me", protect, getMe);
router.patch("/update-admin", protect, updateAdmin);

// Profile picture — multipart/form-data, field name: "profilePicture"
router.patch(
  "/update-profile-picture",
  protect,
  upload.single("profilePicture"),
  updateProfilePicture,
);
router.patch("/remove-profile-picture", protect, removeProfilePicture);

// Admin-only routes
router.post("/register-staff", protect, registerStaff);

export default router;
