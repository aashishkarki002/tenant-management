/**
 * SYSTEM SETTINGS ROUTES
 *
 * Mount in app.js:
 *   import systemSettingsRoutes from "./modules/systemConfig/systemSetting.route.js";
 *   app.use("/api/settings", systemSettingsRoutes);
 */

import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";
import {
  getAllSettings,
  saveEscalation,
  applyEscalationToAll,
  disableEscalationAll,
  saveLateFee,
  getOwnershipConfig,
  updateSystemMode,
} from "./systemSettingController.js";

const router = Router();

// ── READ ──────────────────────────────────────────────────────────────────────
// Fetch all system settings in one call (escalation + late fee + future)
router.get("/system", protect, getAllSettings);

// ── ESCALATION ────────────────────────────────────────────────────────────────
router.post("/system/escalation", protect, saveEscalation);
router.post("/system/escalation/apply-all", protect, applyEscalationToAll);
router.patch("/system/escalation/disable-all", protect, disableEscalationAll);

// ── LATE FEE ──────────────────────────────────────────────────────────────────
router.post("/system/late-fee", protect, saveLateFee);

// ── OWNERSHIP CONFIG ──────────────────────────────────────────────────────────
router.get("/ownership-config", protect, getOwnershipConfig);
router.patch("/system-mode", protect, authorize("super_admin"), updateSystemMode);

export default router;
