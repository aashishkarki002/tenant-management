import { Router } from "express";
import {
  // Existing
  getStaffsController,
  updateStaffController,
  deleteStaffController,
  // New
  createStaffProfileController,
  getMyStaffProfileController,
  getStaffByIdController,
  updateStaffProfileController,
} from "./staffs.controller.js";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";

const router = Router();

// ─── EXISTING ROUTES (paths preserved exactly) ────────────────────────────────

router.get(
  "/get-staffs",
  protect,
  authorize("admin", "super_admin", "staff"),
  getStaffsController,
);

router.patch(
  "/update-staff/:id",
  protect,
  authorize("super_admin"),
  updateStaffController,
);

router.delete(
  "/delete-staff/:id",
  protect,
  authorize("super_admin"),
  deleteStaffController,
);

// ─── NEW ROUTES (StaffProfile) ────────────────────────────────────────────────

// NOTE: /me must be defined BEFORE /:id routes to avoid Express
// matching the literal string "me" as a Mongo ObjectId param.
router.get("/me", protect, getMyStaffProfileController);

router.get(
  "/get-staff/:id",
  protect,
  authorize("admin", "super_admin"),
  getStaffByIdController,
);

router.post(
  "/profile",
  protect,
  authorize("admin", "super_admin"),
  createStaffProfileController,
);

router.patch(
  "/update-profile/:id",
  protect,
  authorize("admin", "super_admin"),
  updateStaffProfileController,
);

export default router;
