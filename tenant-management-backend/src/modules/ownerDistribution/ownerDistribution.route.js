import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";
import { listDistributions, createDistribution } from "./ownerDistribution.controller.js";

const router = Router();
router.get("/",  protect, authorize("admin","super_admin"), listDistributions);
router.post("/", protect, authorize("admin","super_admin"), createDistribution);
export default router;
