import { Router } from "express";
import {
  getLedger,
  getLedgerSummary,
  getTenantLedger,
  getAccountLedger,
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
  "/get-tenant-ledger",
  protect,
  authorize("admin", "super_admin"),
  getTenantLedger,
);
router.get(
  "/get-account-ledger",
  protect,
  authorize("admin", "super_admin"),
  getAccountLedger,
);
export default router;
