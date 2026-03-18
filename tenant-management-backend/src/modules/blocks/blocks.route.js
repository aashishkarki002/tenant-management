import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";
import { getAllBlocksWithStats } from "./blocks.controller.js";

const router = Router();

router.get(
  "/get-allblocks",
  protect,
  authorize("admin", "super_admin", "staff"),
  getAllBlocksWithStats,
);

export default router;
