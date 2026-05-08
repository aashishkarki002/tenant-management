import { Router } from "express";
import {
  computeSettlement,
  executeSettlement,
  getByTenant,
  listSettlements,
} from "./vacateSettlement.controller.js";
import { protect } from "../../../middleware/protect.js";
import { authorize } from "../../../middleware/authorize.js";

const router = Router();

router.post(
  "/compute",
  protect,
  authorize("admin", "super_admin"),
  computeSettlement,
);

router.post(
  "/execute",
  protect,
  authorize("admin", "super_admin"),
  executeSettlement,
);

router.get(
  "/tenant/:tenantId",
  protect,
  authorize("admin", "super_admin", "staff"),
  getByTenant,
);

router.get(
  "/",
  protect,
  authorize("admin", "super_admin"),
  listSettlements,
);

export default router;
