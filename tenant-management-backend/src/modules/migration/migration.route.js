import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";
import {
  preflight,
  startMigration,
  rollback,
  status,
  auditLog,
} from "./migration.controller.js";

const router = Router();
const superAdmin = [protect, authorize("super_admin")];

router.post("/preflight/:blockId", ...superAdmin, preflight);
router.post("/start", ...superAdmin, startMigration);
router.post("/rollback/:snapshotId", ...superAdmin, rollback);
router.get("/status/:blockId", ...superAdmin, status);
router.get("/audit-log", ...superAdmin, auditLog);

export default router;
