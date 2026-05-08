import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";
import { listBudget, upsertBudget, removeBudget, budgetVsActual } from "./budget.controller.js";

const router = Router();

router.get("/",           protect, authorize("admin","super_admin"), listBudget);
router.post("/",          protect, authorize("admin","super_admin"), upsertBudget);
router.delete("/",        protect, authorize("admin","super_admin"), removeBudget);
router.get("/vs-actual",  protect, authorize("admin","super_admin","staff"), budgetVsActual);

export default router;
