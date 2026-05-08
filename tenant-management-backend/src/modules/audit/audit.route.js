import { Router } from "express";
import { getAuditLogs, getEventTypes } from "./audit.controller.js";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";

const router = Router();

// All audit routes are read-only — no POST/PUT/DELETE ever mounted here
router.get(
  "/",
  protect,
  authorize("admin", "super_admin"),
  getAuditLogs,
);

router.get(
  "/event-types",
  protect,
  authorize("admin", "super_admin"),
  getEventTypes,
);

export default router;
