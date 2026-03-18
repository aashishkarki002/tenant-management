import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";
import {
  preflight,
  createDraft,
  confirm,
  reverse,
  listBySd,
  getOne,
} from "./sdRefund.controller.js";

const router = Router();

// Preflight: see remaining balance + open dues (read-only, staff allowed)
router.get(
  "/preflight/:sdId",
  protect,
  authorize("admin", "super_admin", "staff"),
  preflight,
);

// List all refunds for a given SD
router.get(
  "/by-sd/:sdId",
  protect,
  authorize("admin", "super_admin", "staff"),
  listBySd,
);

// Get single refund detail
router.get("/:refundId", protect, authorize("admin", "super_admin"), getOne);

// Create draft — admin writes
router.post("/draft", protect, authorize("admin", "super_admin"), createDraft);

// Confirm + post to ledger
router.post(
  "/:refundId/confirm",
  protect,
  authorize("admin", "super_admin"),
  confirm,
);

// Reverse (super_admin only, 24h window)
router.post("/:refundId/reverse", protect, authorize("super_admin"), reverse);

export default router;

// =============================================================================
// app.js registration snippet (add this to your existing app.js)
// =============================================================================
//
// import sdRefundRoutes from "./modules/sdRefund/sdRefund.route.js";
// app.use("/api/sd-refund", sdRefundRoutes);
//
// Also add "SdRefund" to your Transaction referenceType enum if Transaction
// model has a strict enum, and add "MAINTENANCE_REVENUE" to ACCOUNT_CODES:
//   MAINTENANCE_REVENUE: "4300"
// and ensure Account "4300" is seeded for every OwnershipEntity.
