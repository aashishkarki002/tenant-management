import { Router } from "express";
import {
  getYearStatus,
  getCloseHistory,
  closeYear,
  reopenYear,
} from "./yearEndClose.controller.js";
import { protect } from "../../../middleware/protect.js";
import { authorize } from "../../../middleware/authorize.js";

const router = Router();

router.get(
  "/status",
  protect,
  authorize("admin", "super_admin"),
  getYearStatus,
);

router.get(
  "/history",
  protect,
  authorize("admin", "super_admin"),
  getCloseHistory,
);

router.post(
  "/close",
  protect,
  authorize("super_admin"),
  closeYear,
);

router.post(
  "/reopen",
  protect,
  authorize("super_admin"),
  reopenYear,
);

export default router;
