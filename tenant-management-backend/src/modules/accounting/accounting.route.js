import { Router } from "express";
import { getAccountingSummaryController } from "./accounting.controller.js";
import { protect } from "../../middleware/protect.js";

const router = Router();

// Dashboard summary for Accounting.jsx
router.get("/summary", protect, getAccountingSummaryController);

export default router;

