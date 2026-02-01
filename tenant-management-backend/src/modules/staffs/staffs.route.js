import { Router } from "express";
import { getStaffsController } from "./staffs.controller.js";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";
const router = Router();

router.get(
  "/get-staffs",
  protect,
  authorize("admin", "super_admin", "staff"),
  getStaffsController,
);

export default router;
