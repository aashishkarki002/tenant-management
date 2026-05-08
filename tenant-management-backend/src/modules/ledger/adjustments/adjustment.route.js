import { Router } from "express";
import { postAdjustment, listAdjustments } from "./adjustment.controller.js";
import { protect } from "../../../middleware/protect.js";
import { authorize } from "../../../middleware/authorize.js";

const router = Router();

router.post(
  "/",
  protect,
  authorize("admin", "super_admin"),
  postAdjustment,
);

router.get(
  "/",
  protect,
  authorize("admin", "super_admin", "staff"),
  listAdjustments,
);

export default router;
