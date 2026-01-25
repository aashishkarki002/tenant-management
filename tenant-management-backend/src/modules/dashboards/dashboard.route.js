import { Router } from "express";
import { getDashboardStats } from "./dashboard.service.js";
import { protect } from "../../middleware/protect.js";
const router = Router();

router.get("/stats", protect, getDashboardStats);

export default router;