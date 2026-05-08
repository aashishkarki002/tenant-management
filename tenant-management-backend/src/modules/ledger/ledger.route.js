import { Router } from "express";
import {
  getLedger,
  getLedgerSummary,
  getTenantLedger,
  getAccountLedger,
  getBalanceSheet,
  getTrialBalance,
  getArAging,
  getPropertyPL,
  getBankReconciliation,
  getTdsFilingSummary,
  getCamReconciliation,
  getPettyCashLedger,
  getTenantStatement,
  listAccounts,
  createAccountEntry,
  updateAccountEntry,
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
router.get(
  "/trial-balance",
  protect,
  authorize("admin", "super_admin"),
  getTrialBalance,
);
router.get(
  "/ar-aging",
  protect,
  authorize("admin", "super_admin", "staff"),
  getArAging,
);

// ── Extended reporting ────────────────────────────────────────────────────────
router.get("/property-pl",         protect, authorize("admin","super_admin"),        getPropertyPL);
router.get("/bank-reconciliation",  protect, authorize("admin","super_admin"),        getBankReconciliation);
router.get("/tds-filing",           protect, authorize("admin","super_admin","staff"), getTdsFilingSummary);
router.get("/cam-reconciliation",   protect, authorize("admin","super_admin"),        getCamReconciliation);
router.get("/petty-cash",           protect, authorize("admin","super_admin","staff"), getPettyCashLedger);
router.get("/tenant-statement/:tenantId", protect, authorize("admin","super_admin","staff"), getTenantStatement);

// ── Chart of Accounts CRUD ────────────────────────────────────────────────────
router.get("/accounts",    protect, authorize("admin","super_admin","staff"), listAccounts);
router.post("/accounts",   protect, authorize("admin","super_admin"),         createAccountEntry);
router.put("/accounts/:id",protect, authorize("admin","super_admin"),         updateAccountEntry);

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
