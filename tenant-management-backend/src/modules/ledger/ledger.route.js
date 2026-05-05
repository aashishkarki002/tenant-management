import { Router } from "express";
import {
  getLedger,
  getLedgerSummary,
  getTenantLedger,
  getAccountLedger,
  getBalanceSheet,
  closePeriod,
  reopenPeriod,
  getClosedPeriods,
  rebuildBalance,
} from "./ledger.controller.js";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";

const router = Router();

router.get(
  "/get-ledger",
  protect,
  authorize("admin", "super_admin", "staff"),
  getLedger,
);
router.get(
  "/get-ledger-summary",
  protect,
  authorize("admin", "super_admin"),
  getLedgerSummary,
);
router.get(
  "/get-tenant-ledger/:tenantId",
  protect,
  authorize("admin", "super_admin", "staff"),
  getTenantLedger,
);
router.get(
  "/get-account-ledger",
  protect,
  authorize("admin", "super_admin"),
  getAccountLedger,
);
router.get(
  "/balance-sheet",
  protect,
  authorize("admin", "super_admin"),
  getBalanceSheet,
);

// ── Period closing (super_admin only — irreversible accounting action) ────────
router.get(
  "/closed-periods",
  protect,
  authorize("super_admin"),
  getClosedPeriods,
);
router.post(
  "/close-period",
  protect,
  authorize("super_admin"),
  closePeriod,
);
router.post(
  "/reopen-period",
  protect,
  authorize("super_admin"),
  reopenPeriod,
);

// ── Admin balance repair ──────────────────────────────────────────────────────
router.post(
  "/rebuild-balance",
  protect,
  authorize("super_admin"),
  rebuildBalance,
);

export default router;
